<?php

declare(strict_types=1);

/**
 * API routes and dispatcher.
 *
 * Every state-changing route uses prepared SQL statements and is guarded by a
 * session-bound CSRF token. Request/response shapes match the frontend.
 */

/**
 * Issue a 6-digit email OTP: invalidate previous codes, store a user-scoped
 * hash, e-mail the code, and return it for dev/testing when no mail transport
 * is configured. 15-minute expiry.
 *
 * @return array{code:string,expiresAt:string,delivered:bool}
 */
function issue_email_otp(int $userId, string $email): array
{
    // Invalidate any previous unused codes so only the newest one works.
    db_exec('DELETE FROM email_verifications WHERE user_id = ? AND used_at IS NULL', [$userId]);

    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = now_iso_at(time() + 900);
    db_exec(
        'INSERT INTO email_verifications (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
        [$userId, sha256($userId . ':' . $code), iso_to_sql($expiresAt), iso_to_sql(now_iso())],
    );

    $body = "Your Open Ballot verification code is:\n\n    {$code}\n\n"
        . "Enter this 6-digit code to verify your email. It expires in 15 minutes.\n"
        . "If you did not request this, you can ignore this email.";

    $delivered = mail_configured();
    if ($delivered) {
        @send_mail($email, "{$code} is your Open Ballot verification code", $body);
    }
    // When no transporter is configured the code is not e-mailed; the caller
    // surfaces it as devCode so the flow can be tested without SMTP.

    return ['code' => $code, 'expiresAt' => iso_to_sql($expiresAt), 'delivered' => $delivered];
}

function api_routes(): array
{
    static $routes = null;
    if (is_array($routes)) {
        return $routes;
    }

    $routes = [];
    $add = function (string $method, string $pattern, callable $handler, array $options = []) use (&$routes): void {
        $names = [];
        $parts = explode('/', $pattern);
        foreach ($parts as $index => $segment) {
            if ($segment !== '' && $segment[0] === ':') {
                $names[] = substr($segment, 1);
                $parts[$index] = '([^/]+)';
            } else {
                $parts[$index] = preg_quote($segment, '#');
            }
        }
        $routes[] = [
            'method' => $method,
            'regex' => '#^' . implode('/', $parts) . '$#',
            'names' => $names,
            'handler' => $handler,
            'options' => $options,
        ];
    };
    // Shorthand for admin-guarded routes.
    $admin = function (string $method, string $pattern, callable $handler) use ($add): void {
        $add($method, $pattern, $handler, ['admin' => true]);
    };

    /* -------------------------------------------------------------- */
    /* Public: stats                                                   */
    /* -------------------------------------------------------------- */

    $add('GET', '/api/status', static function (array $ctx): void {
        $checks = [];
        try {
            db_scalar('SELECT 1');
            $checks[] = ['name' => 'Database', 'ok' => true];
        } catch (Throwable) {
            $checks[] = ['name' => 'Database', 'ok' => false];
        }
        try {
            $open = (int) db_scalar("SELECT COUNT(*) FROM elections WHERE status = 'open'");
            $checks[] = ['name' => 'Election service', 'ok' => true, 'info' => "$open open"];
        } catch (Throwable) {
            $checks[] = ['name' => 'Election service', 'ok' => false];
        }
        $checks[] = ['name' => 'Application', 'ok' => true];
        $status = array_filter($checks, static fn (array $c): bool => !$c['ok']) === [] ? 'operational' : 'degraded';
        record_health_snapshot($status, $checks);
        send_json(200, [
            'status' => $status,
            'checks' => $checks,
            'time' => now_iso(),
        ]);
    });

    $add('GET', '/api/health', static function (array $ctx): void {
        send_json(200, ['ok' => true, 'time' => now_iso(), 'app' => config('app_name')]);
    });

    // Debug endpoints for rate limiting
    $admin('POST', '/api/debug/rate-limit', static function (array $ctx): void {
        $body = $ctx['body'];
        $key = as_text($body['key'] ?? 'test_' . time());
        $max = (int) ($body['max'] ?? 5);
        $window = (int) ($body['window'] ?? 900);
        
        try {
            $result = rate_limit($key, $max, 900);
            send_json(200, [
                'ok' => true,
                'result' => $result,
                'key' => $key,
                'db_connected' => true
            ]);
        } catch (Throwable $e) {
            send_json(500, [
                'ok' => false,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    });

    $admin('GET', '/api/debug/rate-limit/check', static function (array $ctx): void {
        try {
            $rows = db_all("SELECT * FROM rate_limits ORDER BY window_start DESC LIMIT 20");
            send_json(200, ['ok' => true, 'rows' => $rows]);
        } catch (Throwable $e) {
            send_json(500, ['ok' => false, 'error' => $e->getMessage()]);
        }
    });

    $admin('POST', '/api/debug/rate-limit/clear', static function (array $ctx): void {
        try {
            db_exec('TRUNCATE TABLE rate_limits');
            send_json(200, ['ok' => true, 'message' => 'Cleared']);
        } catch (Throwable $e) {
            send_json(500, ['error' => $e->getMessage()]);
        }
    });

    $add('GET', '/api/stats', static function (array $ctx): void {
        $elections = db_all('SELECT * FROM elections');
        $statuses = array_map(static fn (array $row): string => effective_status($row), $elections);
        send_json(200, [
            'appName' => config('app_name'),
            'openElections' => count(array_keys($statuses, 'open', true)),
            'scheduledElections' => count(array_keys($statuses, 'scheduled', true)),
            'completedElections' => count(array_keys($statuses, 'closed', true)),
            'ballotsCast' => (int) db_scalar('SELECT COUNT(*) FROM votes'),
            'registeredVoters' => count_active_users(),
        ]);
    });

    /* -------------------------------------------------------------- */
    /* Authentication                                                  */
    /* -------------------------------------------------------------- */

    $add('POST', '/api/auth/register', static function (array $ctx): void {
        if (env_value('REGISTRATION_OPEN', '1') !== '1') {
            fail(403, 'Registration is closed. Contact an administrator for an account.', 'registration_closed');
        }
        ensure_limit('register:' . $ctx['ip'], 5, 3600, 'Too many accounts created from this address. Try again later.');

        $body = $ctx['body'];
        $name = require_text($body['name'] ?? null, 2, 80, 'Full name');
        $email = normalize_email($body['email'] ?? null);
        $password = validate_password($body['password'] ?? null);
        $ageConfirmed = (bool) ($body['ageConfirmed'] ?? false);
        $termsAccepted = (bool) ($body['termsAccepted'] ?? false);
        $marketingOptIn = (bool) ($body['marketingOptIn'] ?? false);

        if (!$ageConfirmed) {
            // DPDP Act, 2023 (India), s.9 — a child is any person under 18 years
            // of age. Open Ballot does not process the personal data of children
            // without verifiable parental consent.
            fail(400, 'You must confirm you are at least 18 years old to register.', 'age_required');
        }
        if (!$termsAccepted) {
            fail(400, 'You must accept the Terms of Service and Privacy Policy to register.', 'terms_required');
        }

        if (db_one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            fail(409, 'An account with that email already exists.', 'email_taken');
        }

        $now = now_iso();
        $id = db_insert(
            "INSERT INTO users (name, email, password_hash, role, active, created_at, age_confirmed, terms_accepted, terms_accepted_at, digest_optin)
             VALUES (?, ?, ?, 'voter', 1, ?, ?, ?, ?, ?)",
            [$name, $email, hash_password($password), iso_to_sql($now), (int) $ageConfirmed, (int) $termsAccepted, iso_to_sql($now), (int) $marketingOptIn],
        );

        // Members of a domain-verified organization are attached automatically.
        // An invitation link (invite-only organizations) takes precedence.
        $claim_domain_membership = claim_domain_membership($id, $email);
        $inviteToken = as_text($body['inviteToken'] ?? null);
        $inviteOrg = accept_invite_for_user($id, $email, $inviteToken);

        // Issue a 6-digit email OTP (best effort; dev code returned when no mailer).
        $otp = issue_email_otp($id, $email);

        $user = public_user(db_one('SELECT * FROM users WHERE id = ?', [$id]));
        $csrf = create_session($user, $ctx['ip']);
        audit($id, 'auth.register', ['email' => $email, 'organizationId' => $user['organizationId']], $ctx['ip']);
        $payload = ['user' => $user, 'csrf' => $csrf, 'emailVerified' => false];
        if (!$otp['delivered']) {
            $payload['devCode'] = $otp['code']; // testing only: no mail transport configured
        }
        send_json(201, $payload);
    });

    $add('GET', '/api/search', static function (array $ctx): void {
        ensure_limit('search:' . $ctx['ip'], 60, 60, 'Too many searches. Wait a moment.');
        $q = mb_substr(trim((string) query_value($ctx['query'], 'q', '')), 0, 80);
        if ($q === '') {
            send_json(200, ['results' => []]);
            return;
        }
        $like = '%' . $q . '%';
        // Only public, non-organization elections are searchable. Organization
        // elections remain invisible to the public directory and search.
        $rows = db_all(
            'SELECT e.id, e.title, e.description, e.status, e.kind, e.slug
             FROM elections e
             WHERE e.organization_id IS NULL AND e.status <> \'draft\'
               AND (LOWER(e.title) LIKE LOWER(?) OR LOWER(e.description) LIKE LOWER(?)
                    OR EXISTS (SELECT 1 FROM candidates c WHERE c.election_id = e.id AND LOWER(c.name) LIKE LOWER(?)))
             ORDER BY e.created_at DESC LIMIT 10',
            [$like, $like, $like],
        );
        $results = array_map(static fn (array $r): array => [
            'id' => (int) $r['id'],
            'title' => (string) $r['title'],
            'description' => mb_substr((string) $r['description'], 0, 140),
            'status' => effective_status($r),
            'kind' => (string) $r['kind'],
            'url' => (string) $r['kind'] === 'poll' ? '/p/' . $r['slug'] : '/election/' . $r['id'],
        ], $rows);
        send_json(200, ['results' => $results]);
    });

    /* -------------------------------------------------------------- */
    /* Public polls (same engine, shareable link, anonymous voters)     */
    /* -------------------------------------------------------------- */

    $add('POST', '/api/polls', static function (array $ctx): void {
        if ($ctx['user'] === null) {
            fail(401, 'Sign in to create a poll.', 'auth_required');
        }
        ensure_limit('poll-create:' . $ctx['ip'], 10, 3600, 'Too many polls created. Try again later.');
        $body = $ctx['body'];
        $title = require_text($body['title'] ?? null, 3, 120, 'Question');
        $description = optional_text($body['description'] ?? null, 2000, 'Description');
        $options = $body['options'] ?? null;
        if (!is_array($options)) {
            fail(400, 'Provide at least two options.', 'invalid_options');
        }
        $options = array_values(array_filter(array_map('trim', $options), static fn ($v): bool => is_string($v) && $v !== ''));
        if (count($options) < 2 || count($options) > 12) {
            fail(400, 'Provide between 2 and 12 options.', 'invalid_options');
        }
        foreach ($options as $option) {
            if (mb_strlen($option) > 80) {
                fail(400, 'Each option must be 80 characters or fewer.', 'invalid_options');
            }
        }
        $closesAt = array_key_exists('closesAt', $body) ? parse_date($body['closesAt'], 'Closing time') : null;
        if ($closesAt !== null && strtotime($closesAt) <= time()) {
            fail(400, 'Closing time must be in the future.', 'invalid_date');
        }
        $visibility = array_key_exists('resultsVisibility', $body)
            ? one_of($body['resultsVisibility'], ['always', 'after_vote', 'after_close', 'hidden'])
            : 'after_vote';

        $requestedType = (string) ($body['ballotType'] ?? 'single');
        $ballotType = in_array($requestedType, ['single', 'ranked'], true) ? $requestedType : 'single';
        $base = strtolower((string) preg_replace('/[^a-z0-9]+/', '-', $title));
        $base = trim($base, '-');
        $slug = substr($base !== '' ? $base : 'poll', 0, 60) . '-' . bin2hex(random_bytes(3));
        $now = now_iso();
        $pollId = 0;
        db_transaction(static function () use (&$pollId, $title, $description, $visibility, $closesAt, $slug, $ballotType, $body, $ctx, $now): void {
            $pollId = db_insert(
                'INSERT INTO elections
                   (title, description, status, results_visibility, max_choices, ballot_type, kind, slug, allow_anonymous, opens_at, closes_at, created_by, organization_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 1, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)',
                [
                    $title,
                    $description,
                    'open',
                    $visibility,
                    $ballotType,
                    'poll',
                    $slug,
                    iso_to_sql($now),
                    $closesAt === null ? null : iso_to_sql($closesAt),
                    (int) $ctx['user']['id'],
                    user_organization_id($ctx['user']),
                    iso_to_sql($now),
                    iso_to_sql($now),
                ],
            );
            $position = 0;
            foreach ($body['options'] as $option) {
                $option = trim((string) $option);
                if ($option === '') {
                    continue;
                }
                db_insert(
                    'INSERT INTO candidates (election_id, name, party, bio, position, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [$pollId, $option, '', '', $position++, iso_to_sql($now)],
                );
            }
        });
        audit((int) $ctx['user']['id'], 'poll.create', ['pollId' => $pollId, 'slug' => $slug], $ctx['ip']);
        $shareLink = (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/p/' . $slug);
        $row = get_election($pollId);
        send_json(201, [
            'poll' => serialize_election($row, $ctx['user']),
            'candidates' => poll_candidates($pollId),
            'shareLink' => $shareLink,
        ]);
    });

    $add('GET', '/api/polls/mine', static function (array $ctx): void {
        if ($ctx['user'] === null) {
            fail(401, 'Sign in to see your polls.', 'auth_required');
        }
        $rows = db_all("SELECT * FROM elections WHERE kind = 'poll' AND created_by = ? ORDER BY created_at DESC", [(int) $ctx['user']['id']]);
        send_json(200, ['polls' => array_map(static fn (array $r): array => serialize_election($r, $ctx['user']), $rows)]);
    });

    $add('GET', '/api/polls/:slug', static function (array $ctx): void {
        $row = db_one("SELECT * FROM elections WHERE slug = ? AND kind = 'poll'", [$ctx['params']['slug']]);
        if ($row === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        $token = voter_token_for((int) $row['id']);
        $voted = db_one('SELECT id FROM participation WHERE election_id = ? AND voter_token = ?', [(int) $row['id'], $token]) !== null;
        $payload = serialize_election($row, null);
        $payload['hasVoted'] = $voted;
        $payload['subscribed'] = $ctx['user'] === null ? false
            : db_one('SELECT poll_id FROM poll_subscriptions WHERE poll_id = ? AND user_id = ?', [(int) $row['id'], (int) $ctx['user']['id']]) !== null;
        send_json(200, ['poll' => $payload, 'candidates' => poll_candidates((int) $row['id'])]);
    });

    $add('POST', '/api/polls/:slug/vote', static function (array $ctx): void {
        ensure_limit('poll-vote:' . $ctx['ip'], 30, 3600, 'Too many votes. Please wait a moment.');
        $row = db_one("SELECT * FROM elections WHERE slug = ? AND kind = 'poll'", [$ctx['params']['slug']]);
        if ($row === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        if (effective_status($row) !== 'open') {
            fail(403, 'This poll is no longer accepting votes.', 'closed');
        }
        $candidateId = (int) ($ctx['body']['candidateId'] ?? 0);
        if (db_one('SELECT id FROM candidates WHERE id = ? AND election_id = ?', [$candidateId, (int) $row['id']]) === null) {
            fail(400, 'Choose an option from this poll.', 'invalid_option');
        }
        $token = voter_token_for((int) $row['id']);
        $code = new_receipt_code();
        $hash = receipt_hash($code);
        $voteId = random_token(16);
        try {
            db_transaction(static function () use ($row, $candidateId, $token, $voteId, $hash): void {
                db_exec(
                    'INSERT INTO participation (election_id, voter_id, voter_token, voted_at) VALUES (?, NULL, ?, ?)',
                    [(int) $row['id'], $token, iso_to_sql(now_iso())],
                );
                db_exec(
                    'INSERT INTO votes (id, election_id, candidate_id, receipt_hash) VALUES (?, ?, ?, ?)',
                    [$voteId, (int) $row['id'], $candidateId, $hash],
                );
                db_exec('INSERT INTO vote_choices (vote_id, candidate_id, rank) VALUES (?, ?, 0)', [$voteId, $candidateId]);
            });
        } catch (PDOException $error) {
            if (db_is_duplicate($error)) {
                fail(409, 'You have already voted in this poll.', 'already_voted');
            }
            throw $error;
        }
        audit(null, 'poll.vote', ['pollId' => (int) $row['id']], $ctx['ip']);
        if ($ctx['user'] !== null) {
            notify((int) $ctx['user']['id'], 'poll.vote', 'Your vote was recorded',
                'Keep your receipt to verify your vote at any time.', '/verify?code=' . $code);
        }
        send_json(201, ['receipt' => $code, 'poll' => serialize_election(get_election((int) $row['id']), null)]);
    });

    $add('GET', '/api/polls/:slug/results', static function (array $ctx): void {
        $row = db_one("SELECT * FROM elections WHERE slug = ? AND kind = 'poll'", [$ctx['params']['slug']]);
        if ($row === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        if (!results_are_visible($row, null, false)) {
            fail(403, 'Results are not public for this poll yet.', 'results_hidden');
        }
        send_json(200, ['poll' => serialize_election($row, null), 'results' => election_results((int) $row['id'])]);
    });

    $add('POST', '/api/polls/:slug/subscribe', static function (array $ctx): void {
        if ($ctx['user'] === null) {
            fail(401, 'Sign in to get a reminder.', 'auth_required');
        }
        $row = db_one("SELECT * FROM elections WHERE slug = ? AND kind = 'poll'", [$ctx['params']['slug']]);
        if ($row === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        $exists = db_one(
            'SELECT poll_id FROM poll_subscriptions WHERE poll_id = ? AND user_id = ?',
            [(int) $row['id'], (int) $ctx['user']['id']],
        );
        if ($exists === null) {
            db_exec(
                'INSERT INTO poll_subscriptions (poll_id, user_id, created_at) VALUES (?, ?, ?)',
                [(int) $row['id'], (int) $ctx['user']['id'], iso_to_sql(now_iso())],
            );
        }
        send_json(201, ['subscribed' => true]);
    });

    $add('DELETE', '/api/polls/:slug/subscribe', static function (array $ctx): void {
        if ($ctx['user'] === null) {
            fail(401, 'Sign in to manage reminders.', 'auth_required');
        }
        $row = db_one("SELECT id FROM elections WHERE slug = ? AND kind = 'poll'", [$ctx['params']['slug']]);
        if ($row === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        db_exec('DELETE FROM poll_subscriptions WHERE poll_id = ? AND user_id = ?', [(int) $row['id'], (int) $ctx['user']['id']]);
        send_json(200, ['subscribed' => false]);
    });

    $add('POST', '/api/polls/:slug/clone', static function (array $ctx): void {
        if ($ctx['user'] === null) {
            fail(401, 'Sign in to copy a poll.', 'auth_required');
        }
        $source = db_one("SELECT * FROM elections WHERE slug = ? AND kind = 'poll'", [$ctx['params']['slug']]);
        if ($source === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        if ((int) $source['created_by'] !== (int) $ctx['user']['id'] && !is_platform_admin($ctx['user'])) {
            fail(403, 'Only the poll creator can copy it.', 'forbidden');
        }
        $base = strtolower((string) preg_replace('/[^a-z0-9]+/', '-', (string) $source['title']));
        $base = trim($base, '-');
        $slug = substr($base !== '' ? $base : 'poll', 0, 55) . '-copy-' . bin2hex(random_bytes(3));
        $now = now_iso();
        $newId = db_insert(
            'INSERT INTO elections
               (title, description, status, results_visibility, max_choices, ballot_type, kind, slug, allow_anonymous, closes_at, created_by, organization_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)',
            [
                (string) $source['title'] . ' (copy)',
                (string) $source['description'],
                'open',
                (string) $source['results_visibility'],
                (int) $source['max_choices'],
                (string) ($source['ballot_type'] ?? 'single'),
                'poll',
                $slug,
                $source['closes_at'],
                (int) $ctx['user']['id'],
                user_organization_id($ctx['user']),
                iso_to_sql($now),
                iso_to_sql($now),
            ],
        );
        $options = db_all('SELECT name, party, bio, position FROM candidates WHERE election_id = ? ORDER BY position, id', [(int) $source['id']]);
        foreach ($options as $option) {
            db_insert(
                'INSERT INTO candidates (election_id, name, party, bio, position, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [$newId, $option['name'], $option['party'], $option['bio'], $option['position'], iso_to_sql($now)],
            );
        }
        audit((int) $ctx['user']['id'], 'poll.clone', ['from' => (int) $source['id'], 'to' => $newId], $ctx['ip']);
        send_json(201, [
            'poll' => serialize_election(get_election($newId), $ctx['user']),
            'shareLink' => env_value('APP_URL', 'http://127.0.0.1:3000') . '/p/' . $slug,
        ]);
    });

    $add('GET', '/api/polls/:slug/results.csv', static function (array $ctx): void {
        $row = db_one("SELECT * FROM elections WHERE slug = ? AND kind = 'poll'", [$ctx['params']['slug']]);
        if ($row === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        if (!results_are_visible($row, null, false)) {
            fail(403, 'Results are not public for this poll yet.', 'results_hidden');
        }
        $results = election_results((int) $row['id']);
        $sanitize = static function (string $value): string {
            $value = preg_match('/^[=+\-@]/', $value) === 1 ? "'" . $value : $value;
            return str_replace(["\r", "\n"], ' ', $value);
        };
        $handle = fopen('php://temp', 'w+');
        fputcsv($handle, ['option', 'votes', 'percent']);
        foreach ($results['candidates'] as $candidate) {
            fputcsv($handle, [$sanitize((string) $candidate['name']), (int) $candidate['votes'], (float) $candidate['share']]);
        }
        rewind($handle);
        $csv = (string) stream_get_contents($handle);
        fclose($handle);
        if (headers_sent()) {
            return;
        }
        http_response_code(200);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="open-ballot-results.csv"');
        header('Cache-Control: no-store');
        header('Content-Length: ' . strlen($csv));
        echo $csv;
    });

    $add('POST', '/api/polls/:slug/report', static function (array $ctx): void {
        ensure_limit('poll-report:' . $ctx['ip'], 10, 3600, 'Too many reports submitted. Try again later.');
        $row = db_one("SELECT * FROM elections WHERE slug = ? AND kind = 'poll'", [$ctx['params']['slug']]);
        if ($row === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        $reason = one_of($ctx['body']['reason'] ?? 'other', ['spam', 'misleading', 'harassment', 'other']);
        $details = optional_text($ctx['body']['details'] ?? null, 500, 'Details');
        $token = voter_token_for((int) $row['id']);
        try {
            db_exec(
                'INSERT INTO poll_reports (poll_id, reporter_token, reason, details, created_at) VALUES (?, ?, ?, ?, ?)',
                [(int) $row['id'], $token, $reason, $details, iso_to_sql(now_iso())],
            );
        } catch (PDOException $error) {
            if (db_is_duplicate($error)) {
                fail(409, 'You have already reported this poll.', 'already_reported');
            }
            throw $error;
        }
        audit(null, 'poll.report', ['pollId' => (int) $row['id'], 'reason' => $reason], $ctx['ip']);
        send_json(201, ['ok' => true]);
    });

    $admin('GET', '/api/admin/polls', static function (array $ctx): void {
        if (!is_platform_admin($ctx['user'])) {
            fail(403, 'Platform administrator access required.', 'forbidden');
        }
        $rows = db_all(
            'SELECT e.*, u.name AS creator_name,
                    (SELECT COUNT(*) FROM poll_reports r WHERE r.poll_id = e.id AND r.status = \'open\') AS open_reports
             FROM elections e LEFT JOIN users u ON u.id = e.created_by
             WHERE e.kind = \'poll\'
             ORDER BY open_reports DESC, e.created_at DESC',
        );
        send_json(200, ['polls' => array_map(static fn (array $r): array => serialize_election($r, $ctx['user']) + [
            'creator' => $r['creator_name'] ?? 'Unknown',
            'openReports' => (int) $r['open_reports'],
        ], $rows)]);
    });

    $admin('GET', '/api/admin/polls/:id/reports', static function (array $ctx): void {
        if (!is_platform_admin($ctx['user'])) {
            fail(403, 'Platform administrator access required.', 'forbidden');
        }
        $id = (int) $ctx['params']['id'];
        if (db_one("SELECT id FROM elections WHERE id = ? AND kind = 'poll'", [$id]) === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        $rows = db_all('SELECT * FROM poll_reports WHERE poll_id = ? ORDER BY created_at DESC', [$id]);
        send_json(200, ['reports' => array_map(static fn (array $r): array => [
            'id' => (int) $r['id'],
            'reason' => (string) $r['reason'],
            'details' => (string) $r['details'],
            'status' => (string) $r['status'],
            'createdAt' => sql_to_iso($r['created_at']),
        ], $rows)]);
    });

    $admin('PATCH', '/api/admin/polls/:id/reports/:reportId', static function (array $ctx): void {
        if (!is_platform_admin($ctx['user'])) {
            fail(403, 'Platform administrator access required.', 'forbidden');
        }
        $status = one_of($ctx['body']['status'] ?? 'resolved', ['resolved', 'dismissed']);
        db_exec(
            'UPDATE poll_reports SET status = ? WHERE id = ? AND poll_id = ?',
            [$status, (int) $ctx['params']['reportId'], (int) $ctx['params']['id']],
        );
        audit((int) $ctx['user']['id'], 'poll.report_update', ['pollId' => (int) $ctx['params']['id'], 'status' => $status], $ctx['ip']);
        send_json(200, ['ok' => true]);
    });

    $admin('PATCH', '/api/admin/polls/:id', static function (array $ctx): void {
        if (!is_platform_admin($ctx['user'])) {
            fail(403, 'Platform administrator access required.', 'forbidden');
        }
        $id = (int) $ctx['params']['id'];
        $poll = db_one("SELECT * FROM elections WHERE id = ? AND kind = 'poll'", [$id]);
        if ($poll === null) {
            fail(404, 'Poll not found.', 'not_found');
        }
        $action = one_of($ctx['body']['action'] ?? 'close', ['close', 'reopen']);
        if ($action === 'close') {
            db_exec("UPDATE elections SET status = 'closed', closes_at = ? WHERE id = ?", [iso_to_sql(now_iso()), $id]);
        } else {
            db_exec("UPDATE elections SET status = 'open', closes_at = NULL WHERE id = ?", [$id]);
        }
        audit((int) $ctx['user']['id'], 'poll.moderate', ['pollId' => $id, 'action' => $action], $ctx['ip']);
        send_json(200, ['poll' => serialize_election(get_election($id), $ctx['user'])]);
    });

    /* -------------------------------------------------------------- */
    /* Organizations                                                   */
    /* -------------------------------------------------------------- */

    $add('POST', '/api/organizations/register', static function (array $ctx): void {
        ensure_limit('org-register:' . $ctx['ip'], 5, 3600, 'Too many organizations registered from this address. Try again later.');
        $body = $ctx['body'];
        $orgName = require_text($body['organizationName'] ?? $body['name'] ?? null, 2, 160, 'Organization name');
        $slugRaw = require_text($body['slug'] ?? null, 2, 80, 'Organization slug');
        $slug = strtolower((string) preg_replace('/[^a-z0-9-]+/', '-', $slugRaw));
        $slug = trim($slug, '-');
        if ($slug === '' || strlen($slug) > 80) {
            fail(400, 'Use 2–80 letters, numbers or hyphens for the organization slug.', 'invalid_slug');
        }
        $domain = strtolower(trim(as_text($body['domain'] ?? null)));
        $domain = ltrim($domain, '@');
        if ($domain !== '' && preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $domain) !== 1) {
            fail(400, 'Enter a valid email domain, such as university.edu.', 'invalid_domain');
        }
        $mode = one_of($body['membershipMode'] ?? $body['membership_mode'] ?? 'domain', ['domain', 'invite']);
        $adminName = require_text($body['adminName'] ?? null, 2, 80, 'Administrator name');
        $adminEmail = normalize_email($body['adminEmail'] ?? $body['email'] ?? null);
        $password = validate_password($body['adminPassword'] ?? $body['password'] ?? null);

        if (db_one('SELECT id FROM organizations WHERE slug = ?', [$slug]) !== null) {
            fail(409, 'That organization slug is already taken.', 'slug_taken');
        }
        if ($domain !== '' && db_one('SELECT id FROM organizations WHERE lower(domain) = lower(?)', [$domain]) !== null) {
            fail(409, 'That email domain is already claimed by another organization.', 'domain_taken');
        }
        if (db_one('SELECT id FROM users WHERE email = ?', [$adminEmail]) !== null) {
            fail(409, 'An account with that email already exists.', 'email_taken');
        }

        $now = now_iso();
        $orgId = 0;
        $adminId = 0;
        db_transaction(static function () use (&$orgId, &$adminId, $orgName, $slug, $domain, $mode, $adminName, $adminEmail, $password, $now): void {
            $orgId = db_insert(
                'INSERT INTO organizations (name, slug, domain, membership_mode, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [$orgName, $slug, $domain !== '' ? $domain : null, $mode, 'active', iso_to_sql($now)],
            );
            $adminId = db_insert(
                'INSERT INTO users (name, email, password_hash, role, active, email_verified_at, organization_id, created_at)
                 VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
                [$adminName, $adminEmail, hash_password($password), 'org_admin', iso_to_sql($now), $orgId, iso_to_sql($now)],
            );
            db_exec('UPDATE organizations SET created_by = ? WHERE id = ?', [$adminId, $orgId]);
        });

        $org = organization_by_id($orgId);
        $user = public_user(db_one('SELECT * FROM users WHERE id = ?', [$adminId]));
        $csrf = create_session($user, $ctx['ip']);
        audit($adminId, 'organization.register', ['organizationId' => $orgId, 'slug' => $slug], $ctx['ip']);
        send_json(201, ['organization' => organization_public($org), 'user' => $user, 'csrf' => $csrf]);
    });

    $add('GET', '/api/org', static function (array $ctx): void {
        $scope = org_scope($ctx['user']);
        if ($scope < 0) {
            fail(403, 'Organization access required.', 'forbidden');
        }
        $org = organization_by_id($scope === 0 ? null : $scope);
        if ($org === null) {
            fail(404, 'Organization not found.', 'not_found');
        }
        send_json(200, [
            'organization' => organization_public($org),
            'members' => (int) db_scalar('SELECT COUNT(*) FROM users WHERE organization_id = ?', [$scope]),
            'elections' => (int) db_scalar('SELECT COUNT(*) FROM elections WHERE organization_id = ?', [$scope]),
        ]);
    });

    $add('PATCH', '/api/org', static function (array $ctx): void {
        if (!is_org_admin($ctx['user'])) {
            fail(403, 'Organization administrator access required.', 'forbidden');
        }
        $scope = (int) user_organization_id($ctx['user']);
        $org = organization_by_id($scope);
        if ($org === null) {
            fail(404, 'Organization not found.', 'not_found');
        }
        $body = $ctx['body'];
        $name = array_key_exists('name', $body) ? require_text($body['name'], 2, 160, 'Organization name') : (string) $org['name'];
        $domain = array_key_exists('domain', $body) ? strtolower(trim(as_text($body['domain']))) : (string) ($org['domain'] ?? '');
        $domain = ltrim($domain, '@');
        if ($domain !== '' && preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $domain) !== 1) {
            fail(400, 'Enter a valid email domain, such as university.edu.', 'invalid_domain');
        }
        $mode = array_key_exists('membershipMode', $body)
            ? one_of($body['membershipMode'], ['domain', 'invite'])
            : (string) $org['membership_mode'];
        $taken = db_one('SELECT id FROM organizations WHERE lower(domain) = lower(?) AND id <> ?', [$domain, $scope]);
        if ($domain !== '' && $taken !== null) {
            fail(409, 'That email domain is already claimed by another organization.', 'domain_taken');
        }
        db_exec(
            'UPDATE organizations SET name = ?, domain = ?, membership_mode = ? WHERE id = ?',
            [$name, $domain !== '' ? $domain : null, $mode, $scope],
        );
        audit((int) $ctx['user']['id'], 'organization.update', ['organizationId' => $scope], $ctx['ip']);
        send_json(200, ['organization' => organization_public(organization_by_id($scope))]);
    });

    $add('GET', '/api/org/members', static function (array $ctx): void {
        $scope = org_scope($ctx['user']);
        if ($scope < 0) {
            fail(403, 'Organization access required.', 'forbidden');
        }
        $rows = $scope === 0
            ? db_all('SELECT * FROM users ORDER BY id')
            : db_all('SELECT * FROM users WHERE organization_id = ? ORDER BY id', [$scope]);
        send_json(200, ['members' => array_map('public_user', $rows)]);
    });

    $add('GET', '/api/org/invites', static function (array $ctx): void {
        if (!is_org_admin($ctx['user'])) {
            fail(403, 'Organization administrator access required.', 'forbidden');
        }
        $rows = db_all('SELECT * FROM organization_invites WHERE organization_id = ? ORDER BY id DESC', [(int) user_organization_id($ctx['user'])]);
        send_json(200, ['invites' => array_map(static fn (array $r): array => [
            'id' => (int) $r['id'],
            'email' => (string) $r['email'],
            'role' => (string) $r['role'],
            'accepted' => $r['accepted_at'] !== null,
            'expiresAt' => sql_to_iso($r['expires_at']),
            'createdAt' => sql_to_iso($r['created_at']),
        ], $rows)]);
    });

    $add('POST', '/api/org/invites', static function (array $ctx): void {
        if (!is_org_admin($ctx['user'])) {
            fail(403, 'Organization administrator access required.', 'forbidden');
        }
        $scope = (int) user_organization_id($ctx['user']);
        $email = normalize_email($ctx['body']['email'] ?? null);
        $role = one_of($ctx['body']['role'] ?? 'voter', ['voter', 'observer', 'org_admin']);
        if (db_one('SELECT id FROM organization_invites WHERE organization_id = ? AND lower(email) = lower(?)', [$scope, $email]) !== null) {
            fail(409, 'That address already has an invitation.', 'invite_exists');
        }
        $token = random_token(32);
        db_exec(
            'INSERT INTO organization_invites (organization_id, email, role, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [$scope, $email, $role, $token, iso_to_sql(now_iso_at(time() + 7 * 86400)), iso_to_sql(now_iso())],
        );
        $link = (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/join?token=' . $token);
        send_mail($email, 'Invitation to join your organization on Open Ballot', "You have been invited to join Open Ballot.\n\nRegister or sign in here:\n\n{$link}\n\nThis link expires in 7 days.");
        audit((int) $ctx['user']['id'], 'organization.invite', ['organizationId' => $scope, 'email' => $email], $ctx['ip']);
        send_json(201, ['invite' => ['email' => $email, 'role' => $role, 'link' => $link]]);
    });

    $add('DELETE', '/api/org/invites/:id', static function (array $ctx): void {
        if (!is_org_admin($ctx['user'])) {
            fail(403, 'Organization administrator access required.', 'forbidden');
        }
        db_exec('DELETE FROM organization_invites WHERE id = ? AND organization_id = ?', [(int) $ctx['params']['id'], (int) user_organization_id($ctx['user'])]);
        send_json(200, ['ok' => true]);
    });

    $add('GET', '/api/orgs', static function (array $ctx): void {
        $rows = db_all(
            'SELECT o.*, (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id AND u.active = 1) AS member_count,
                    (SELECT COUNT(*) FROM elections e WHERE e.organization_id = o.id AND e.status <> \'draft\') AS election_count
             FROM organizations o WHERE o.status = \'active\' ORDER BY o.name ASC LIMIT 200',
        );
        send_json(200, ['organizations' => array_map(static fn (array $r): array => organization_public($r) + [
            'memberCount' => (int) $r['member_count'],
            'electionCount' => (int) $r['election_count'],
        ], $rows)]);
    });

    $add('GET', '/api/orgs/:slug', static function (array $ctx): void {
        $org = db_one("SELECT * FROM organizations WHERE slug = ? AND status = 'active'", [$ctx['params']['slug']]);
        if ($org === null) {
            fail(404, 'Organization not found.', 'not_found');
        }
        send_json(200, ['organization' => organization_public($org) + [
            'memberCount' => (int) db_scalar('SELECT COUNT(*) FROM users WHERE organization_id = ? AND active = 1', [(int) $org['id']]),
            'electionCount' => (int) db_scalar("SELECT COUNT(*) FROM elections WHERE organization_id = ? AND status <> 'draft'", [(int) $org['id']]),
        ]]);
    });

    $add('GET', '/api/orgs/:slug/elections', static function (array $ctx): void {
        $org = db_one("SELECT id FROM organizations WHERE slug = ? AND status = 'active'", [$ctx['params']['slug']]);
        if ($org === null) {
            fail(404, 'Organization not found.', 'not_found');
        }
        $rows = db_all(
            "SELECT * FROM elections WHERE organization_id = ? AND status <> 'draft' AND kind = 'election' ORDER BY created_at DESC LIMIT 100",
            [(int) $org['id']],
        );
        send_json(200, ['elections' => array_map(static fn (array $r): array => serialize_election($r, null), $rows)]);
    });

    $add('GET', '/api/admin/organizations', static function (array $ctx): void {
        if (!is_platform_admin($ctx['user'])) {
            fail(403, 'Platform administrator access required.', 'forbidden');
        }
        $rows = db_all(
            'SELECT o.*, (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS member_count,
                    (SELECT COUNT(*) FROM elections e WHERE e.organization_id = o.id) AS election_count
             FROM organizations o ORDER BY o.id',
        );
        send_json(200, ['organizations' => array_map(static fn (array $r): array => organization_public($r) + [
            'memberCount' => (int) $r['member_count'],
            'electionCount' => (int) $r['election_count'],
        ], $rows)]);
    });

    $add('PATCH', '/api/admin/organizations/:id', static function (array $ctx): void {
        if (!is_platform_admin($ctx['user'])) {
            fail(403, 'Platform administrator access required.', 'forbidden');
        }
        $org = organization_by_id((int) $ctx['params']['id']);
        if ($org === null) {
            fail(404, 'Organization not found.', 'not_found');
        }
        $status = one_of($ctx['body']['status'] ?? 'active', ['active', 'suspended']);
        db_exec('UPDATE organizations SET status = ? WHERE id = ?', [$status, (int) $org['id']]);
        audit((int) $ctx['user']['id'], 'organization.status', ['organizationId' => (int) $org['id'], 'status' => $status], $ctx['ip']);
        send_json(200, ['organization' => organization_public(organization_by_id((int) $org['id']))]);
    });

    $add('POST', '/api/auth/login', static function (array $ctx): void {
        // Stricter: 5 attempts per IP per 15 min, 3 per email per 15 min
        ensure_limit('login:ip:' . $ctx['ip'], 5, 900, 'Too many sign-in attempts. Wait a moment and try again.');
        $body = $ctx['body'];
        $email = strtolower(trim(as_text($body['email'] ?? null)));
        ensure_limit(
            'login:email:' . ($email !== '' ? $email : 'unknown'),
            3,
            900,
            'Too many sign-in attempts for this account. Wait a moment and try again.',
        );

        $row = db_one('SELECT * FROM users WHERE email = ?', [$email]);
        $password = as_text($body['password'] ?? null);

        if ($row === null || !(int) $row['active']) {
            verify_password($password, dummy_hash());
            audit($row === null ? null : (int) $row['id'], 'auth.login_failed', ['email' => $email], $ctx['ip']);
            fail(401, 'Incorrect email or password.', 'invalid_credentials');
        }
        if (!verify_password($password, (string) $row['password_hash'])) {
            audit((int) $row['id'], 'auth.login_failed', ['email' => $email], $ctx['ip']);
            fail(401, 'Incorrect email or password.', 'invalid_credentials');
        }
        upgrade_password_hash((int) $row['id'], $password, (string) $row['password_hash']);

        // Accounts created before an organization claimed their domain are
        // adopted on their next sign-in with that organization e-mail.
        claim_domain_membership((int) $row['id'], $email);
        $row = db_one('SELECT * FROM users WHERE id = ?', [(int) $row['id']]);

        $trusted = is_trusted_device((int) $row['id']);
        $now = now_iso();
        if (!$trusted && !empty($row['mfa_enabled']) && !empty($row['mfa_secret'])) {
            $challenge = random_token(32);
            $hash = sha256($challenge);
            db_exec(
                'INSERT INTO mfa_challenges (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
                [(int) $row['id'], $hash, iso_to_sql(now_iso_at(time() + 300))],
            );
            audit((int) $row['id'], 'auth.mfa_challenge', [], $ctx['ip']);
            send_json(200, ['mfaRequired' => true, 'challenge' => $challenge]);
            return;
        }
        db_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [iso_to_sql($now), (int) $row['id']]);
        $row['last_login_at'] = iso_to_sql($now);
        $user = public_user($row);
        $csrf = create_session($user, $ctx['ip']);
        if (!$trusted) {
            send_login_alert($user, $ctx['ip'], device_name((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')));
            notify((int) $row['id'], 'security.login', 'New sign-in to your account',
                'A new device signed in. If this was not you, change your password.', '/account');
        }
        audit((int) $row['id'], 'auth.login', [], $ctx['ip']);
        send_json(200, ['user' => $user, 'csrf' => $csrf]);
    });

    $add('POST', '/api/auth/admin/login', static function (array $ctx): void {
        ensure_limit('admin-login:ip:' . $ctx['ip'], 10, 900, 'Too many administrator sign-in attempts. Wait a moment and try again.');
        $body = $ctx['body'];
        $email = strtolower(trim(as_text($body['email'] ?? null)));
        ensure_limit(
            'admin-login:email:' . ($email !== '' ? $email : 'unknown'),
            5,
            900,
            'Too many sign-in attempts for this account. Wait a moment and try again.',
        );

        $row = db_one('SELECT * FROM users WHERE email = ?', [$email]);
        $password = as_text($body['password'] ?? null);

        if ($row === null || !(int) $row['active']) {
            verify_password($password, dummy_hash());
            audit($row === null ? null : (int) $row['id'], 'auth.admin_login_failed', ['email' => $email], $ctx['ip']);
            fail(401, 'Incorrect email or password.', 'invalid_credentials');
        }
        if (!verify_password($password, (string) $row['password_hash'])) {
            audit((int) $row['id'], 'auth.admin_login_failed', ['email' => $email], $ctx['ip']);
            fail(401, 'Incorrect email or password.', 'invalid_credentials');
        }
        upgrade_password_hash((int) $row['id'], $password, (string) $row['password_hash']);
        if ((string) $row['role'] !== 'admin') {
            audit((int) $row['id'], 'auth.admin_login_denied', ['email' => $email], $ctx['ip']);
            fail(403, 'Administrator access required.', 'forbidden');
        }

        $now = now_iso();
        db_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [iso_to_sql($now), (int) $row['id']]);
        $row['last_login_at'] = iso_to_sql($now);
        $user = public_user($row);
        $csrf = create_session($user, $ctx['ip']);
        send_login_alert($user, $ctx['ip'], device_name((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')));
        audit((int) $row['id'], 'auth.admin_login', [], $ctx['ip']);
        send_json(200, ['user' => $user, 'csrf' => $csrf]);
    });

    $add('POST', '/api/auth/forgot-password', static function (array $ctx): void {
        ensure_limit('forgot-password:ip:' . $ctx['ip'], 3, 900, 'Too many password reset requests. Wait a few minutes.');
        ensure_limit('forgot-password:email:' . strtolower(trim(as_text($ctx['body']['email'] ?? null))), 2, 900, 'Too many password reset requests for this address. Wait a few minutes.');
        $body = $ctx['body'];
        $email = strtolower(trim(as_text($body['email'] ?? null)));
        $row = db_one('SELECT * FROM users WHERE email = ?', [$email]);
        if ($row !== null && (int) $row['active'] === 1) {
            $token = random_token(32);
            $hash = sha256($token);
            db_exec(
                'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
                [(int) $row['id'], $hash, iso_to_sql(now_iso_at(time() + 3600)), iso_to_sql(now_iso())],
            );
            $link = (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/reset-password/' . $token);
            send_mail($email, 'Reset your Open Ballot password', "Use this link to reset your password:\n\n{$link}\n\nThe link expires in one hour.");
            audit((int) $row['id'], 'auth.password_reset_requested', [], $ctx['ip']);
        }
        send_json(200, ['ok' => true]);
    });

    $add('POST', '/api/auth/reset-password', static function (array $ctx): void {
        $body = $ctx['body'];
        $token = as_text($body['token'] ?? null);
        $hash = sha256($token);
        $row = db_one(
            'SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
            [$hash, iso_to_sql(now_iso())],
        );
        if ($row === null) {
            fail(400, 'This reset link is invalid or has expired.', 'invalid_token');
        }
        $newPassword = validate_password($body['newPassword'] ?? null);
        db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [hash_password($newPassword), (int) $row['user_id']]);
        db_exec('UPDATE password_resets SET used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $row['id']]);
        db_exec('DELETE FROM sessions WHERE user_id = ?', [(int) $row['user_id']]);
        audit((int) $row['user_id'], 'auth.password_reset', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    });

    $add('POST', '/api/auth/verify-email', static function (array $ctx): void {
        $body = $ctx['body'];
        $token = as_text($body['token'] ?? null);
        $hash = sha256($token);
        $row = db_one(
            'SELECT * FROM email_verifications WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
            [$hash, iso_to_sql(now_iso())],
        );
        if ($row === null) {
            fail(400, 'This verification link is invalid or has expired.', 'invalid_token');
        }
        db_exec('UPDATE users SET email_verified_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $row['user_id']]);
        db_exec('UPDATE email_verifications SET used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $row['id']]);
        audit((int) $row['user_id'], 'auth.email_verified', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    });

    $add('POST', '/api/auth/request-otp', static function (array $ctx): void {
        // Stricter: 3 requests per IP per 15 min, 2 per email per 15 min
        ensure_limit('otp-request:ip:' . $ctx['ip'], 3, 900, 'Too many code requests. Wait a few minutes.');
        $body = $ctx['body'];
        $email = strtolower(trim(as_text($body['email'] ?? null)));
        if ($email === '') {
            fail(400, 'Enter your email address.', 'email_required');
        }
        ensure_limit('otp-request:email:' . $email, 2, 900, 'Too many code requests for this address. Wait a few minutes.');

        // Generic response shape (does not reveal whether the account exists).
        $row = db_one('SELECT id, email_verified_at FROM users WHERE email = ?', [$email]);
        if ($row === null || $row['email_verified_at'] !== null) {
            audit(null, 'auth.otp_requested', ['email' => $email, 'known' => $row !== null], $ctx['ip']);
            send_json(200, ['ok' => true, 'sent' => false]);
            return;
        }
        $otp = issue_email_otp((int) $row['id'], $email);
        audit((int) $row['id'], 'auth.otp_requested', ['email' => $email], $ctx['ip']);
        $payload = ['ok' => true, 'sent' => true];
        if (!$otp['delivered']) {
            $payload['devCode'] = $otp['code'];
        }
        send_json(200, $payload);
    });

    $add('POST', '/api/auth/verify-otp', static function (array $ctx): void {
        // Stricter rate limiting: 5 attempts per IP per 10 min, 3 per email per 10 min
        ensure_limit('otp-verify:ip:' . $ctx['ip'], 5, 600, 'Too many attempts. Wait a moment.');
        $body = $ctx['body'];
        $email = strtolower(trim(as_text($body['email'] ?? null)));
        $code = preg_replace('/\D/', '', as_text($body['code'] ?? null)) ?? '';
        if ($email === '' || strlen($code) !== 6) {
            fail(400, 'Enter the 6-digit code.', 'otp_invalid');
        }
        ensure_limit('otp-verify:email:' . $email, 3, 600, 'Too many attempts for this address. Wait a moment.');

        $row = db_one('SELECT * FROM users WHERE email = ?', [$email]);
        if ($row === null) {
            audit(null, 'auth.otp_failed', ['email' => $email], $ctx['ip']);
            fail(400, 'That code is incorrect or has expired.', 'otp_invalid');
        }
        $vrow = db_one(
            'SELECT * FROM email_verifications WHERE user_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > ?',
            [(int) $row['id'], sha256((int) $row['id'] . ':' . $code), iso_to_sql(now_iso())],
        );
        if ($vrow === null) {
            audit((int) $row['id'], 'auth.otp_failed', ['email' => $email], $ctx['ip']);
            fail(400, 'That code is incorrect or has expired.', 'otp_invalid');
        }
        db_exec('UPDATE users SET email_verified_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $row['id']]);
        db_exec('UPDATE email_verifications SET used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $vrow['id']]);
        audit((int) $row['id'], 'auth.otp_verified', ['email' => $email], $ctx['ip']);
        send_json(200, ['ok' => true, 'verified' => true]);
    });

    $add('POST', '/api/auth/resend-verification', static function (array $ctx): void {
        $user = $ctx['user'];
        if ($user === null) {
            fail(401, 'Sign in to continue.', 'auth_required');
        }
        $row = db_one('SELECT * FROM users WHERE id = ?', [$user['id']]);
        if ($row !== null && $row['email_verified_at'] === null) {
            $otp = issue_email_otp((int) $row['id'], (string) $row['email']);
            audit((int) $row['id'], 'auth.verification_sent', [], $ctx['ip']);
            $payload = ['ok' => true];
            if (!$otp['delivered']) {
                $payload['devCode'] = $otp['code'];
            }
            send_json(200, $payload);
            return;
        }
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('POST', '/api/auth/mfa/setup', static function (array $ctx): void {
        $user = $ctx['user'];
        if ($user === null) {
            fail(401, 'Sign in to continue.', 'auth_required');
        }
        $secret = base32_encode(random_bytes(20));
        db_exec('UPDATE users SET mfa_secret = ?, mfa_enabled = 0 WHERE id = ?', [$secret, (int) $user['id']]);
        $issuer = rawurlencode((string) config('app_name'));
        $account = rawurlencode((string) $user['email']);
        $uri = "otpauth://totp/{$issuer}:{$account}?secret={$secret}&issuer={$issuer}&digits=6&period=30";
        send_json(200, ['secret' => $secret, 'uri' => $uri]);
    }, ['auth' => true]);

    $add('POST', '/api/auth/mfa/enable', static function (array $ctx): void {
        $user = $ctx['user'];
        if ($user === null) {
            fail(401, 'Sign in to continue.', 'auth_required');
        }
        $row = db_one('SELECT mfa_secret FROM users WHERE id = ?', [(int) $user['id']]);
        $secret = (string) ($row['mfa_secret'] ?? '');
        if ($secret === '') {
            fail(400, 'Run MFA setup first.', 'mfa_not_setup');
        }
        $code = preg_replace('/\D/', '', as_text($ctx['body']['code'] ?? ''));
        if (!totp_verify($secret, $code)) {
            fail(401, 'Invalid authentication code.', 'invalid_code');
        }
        db_exec('UPDATE users SET mfa_enabled = 1 WHERE id = ?', [(int) $user['id']]);
        audit((int) $user['id'], 'auth.mfa_enabled', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('POST', '/api/auth/mfa/disable', static function (array $ctx): void {
        $user = $ctx['user'];
        if ($user === null) {
            fail(401, 'Sign in to continue.', 'auth_required');
        }
        $row = db_one('SELECT password_hash FROM users WHERE id = ?', [(int) $user['id']]);
        $password = as_text($ctx['body']['password'] ?? null);
        if ($row === null || !verify_password($password, (string) $row['password_hash'])) {
            fail(401, 'Incorrect password.', 'invalid_credentials');
        }
        db_exec('UPDATE users SET mfa_secret = NULL, mfa_enabled = 0 WHERE id = ?', [(int) $user['id']]);
        audit((int) $user['id'], 'auth.mfa_disabled', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('POST', '/api/auth/backup-codes/generate', static function (array $ctx): void {
        $user = $ctx['user'];
        db_exec('DELETE FROM backup_codes WHERE user_id = ?', [(int) $user['id']]);
        $codes = [];
        for ($i = 0; $i < 10; $i++) {
            $code = strtoupper(bin2hex(random_bytes(4)));
            $codes[] = $code;
            db_insert(
                'INSERT INTO backup_codes (user_id, code_hash, created_at) VALUES (?, ?, ?)',
                [(int) $user['id'], sha256($code), iso_to_sql(now_iso())],
            );
        }
        audit((int) $user['id'], 'auth.backup_codes_generated', [], $ctx['ip']);
        send_json(200, ['codes' => $codes]);
    }, ['auth' => true]);

    $add('POST', '/api/auth/mfa/challenge', static function (array $ctx): void {
        $body = $ctx['body'];
        $challenge = as_text($body['challenge'] ?? null);
        $code = preg_replace('/\D/', '', as_text($body['code'] ?? ''));
        $hash = sha256($challenge);
        $row = db_one(
            'SELECT mc.*, u.* FROM mfa_challenges mc JOIN users u ON u.id = mc.user_id
             WHERE mc.token_hash = ? AND mc.expires_at > ?',
            [$hash, iso_to_sql(now_iso())],
        );
        if ($row === null) {
            fail(401, 'Invalid or expired challenge.', 'invalid_challenge');
        }
        if (empty($row['mfa_secret']) || !totp_verify((string) $row['mfa_secret'], $code)) {
            // Allow a one-time backup code as an alternative.
            $backupOk = false;
            if (strlen($code) >= 8) {
                $codeHash = sha256(strtoupper($code));
                $backup = db_one(
                    'SELECT id FROM backup_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL',
                    [(int) $row['user_id'], $codeHash],
                );
                if ($backup !== null) {
                    db_exec('UPDATE backup_codes SET used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $backup['id']]);
                    $backupOk = true;
                }
            }
            if (!$backupOk) {
                audit((int) $row['id'], 'auth.mfa_failed', [], $ctx['ip']);
                fail(401, 'Invalid authentication code.', 'invalid_code');
            }
        }
        db_exec('DELETE FROM mfa_challenges WHERE id = ?', [(int) $row['id']]);
        $now = now_iso();
        db_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [iso_to_sql($now), (int) $row['id']]);
        $row['last_login_at'] = iso_to_sql($now);
        $user = public_user($row);
        $csrf = create_session($user, $ctx['ip']);
        if (!empty($body['trust'])) {
            issue_trusted_device((int) $row['user_id']);
        }
        send_login_alert($user, $ctx['ip'], device_name((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')));
        audit((int) $row['id'], 'auth.login', [], $ctx['ip']);
        send_json(200, ['user' => $user, 'csrf' => $csrf]);
    });

    $add('POST', '/api/auth/logout', static function (array $ctx): void {
        db_exec('DELETE FROM sessions WHERE id = ?', [$ctx['session']['id']]);
        clear_cookie((string) config('session_cookie'));
        audit($ctx['user']['id'], 'auth.logout', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('GET', '/api/auth/me', static function (array $ctx): void {
        send_json(200, [
            'user' => $ctx['user'],
            'csrf' => $ctx['session'] !== null ? $ctx['session']['csrf'] : null,
        ]);
    });

    $add('POST', '/api/auth/password', static function (array $ctx): void {
        ensure_limit('password:' . $ctx['user']['id'], 10, 900, 'Too many password attempts. Try again later.');
        $body = $ctx['body'];
        $current = as_text($body['currentPassword'] ?? null);
        $next = validate_password($body['newPassword'] ?? null);

        $row = db_one('SELECT password_hash FROM users WHERE id = ?', [$ctx['user']['id']]);
        if ($row === null || !verify_password($current, (string) $row['password_hash'])) {
            fail(401, 'Your current password is not correct.', 'invalid_password');
        }
        if (verify_password($next, (string) $row['password_hash'])) {
            fail(400, 'Choose a different password from your current one.', 'same_password');
        }

        db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [hash_password($next), $ctx['user']['id']]);
        db_exec('DELETE FROM sessions WHERE user_id = ? AND id != ?', [$ctx['user']['id'], $ctx['session']['id']]);
        audit($ctx['user']['id'], 'auth.password_change', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    /* -------------------------------------------------------------- */
    /* Public elections                                                */
    /* -------------------------------------------------------------- */

    $add('GET', '/api/elections', static function (array $ctx): void {
        $rows = db_all("SELECT * FROM elections WHERE status != 'draft' ORDER BY created_at DESC");
        $order = ['open' => 0, 'scheduled' => 1, 'closed' => 2];
        $elections = array_map(
            static fn (array $row): array => serialize_election($row, $ctx['user']),
            $rows,
        );
        usort($elections, static function (array $a, array $b) use ($order): int {
            return ($order[$a['status']] <=> $order[$b['status']]) ?: ((int) $b['id'] <=> (int) $a['id']);
        });
        send_json(200, ['elections' => $elections]);
    });

    $add('GET', '/api/elections/:id', static function (array $ctx): void {
        $row = get_election($ctx['params']['id']);
        if ($row === null) {
            fail(404, 'That election could not be found.', 'not_found');
        }
        if ($row['status'] === 'draft' && ($ctx['user'] === null || $ctx['user']['role'] !== 'admin')) {
            fail(404, 'That election could not be found.', 'not_found');
        }

        $candidates = db_all(
            'SELECT id, name, party, bio FROM candidates WHERE election_id = ? ORDER BY id ASC',
            [(int) $row['id']],
        );
        foreach ($candidates as &$candidate) {
            $candidate['id'] = (int) $candidate['id'];
        }
        unset($candidate);

        $participation = $ctx['user'] !== null
            ? get_participation((int) $row['id'], (int) $ctx['user']['id'])
            : null;

        send_json(200, [
            'election' => serialize_election($row, $ctx['user']),
            'candidates' => $candidates,
            'myParticipation' => $participation === null ? null : [
                'votedAt' => sql_to_iso($participation['voted_at']),
            ],
        ]);
    });

    $add('POST', '/api/elections/:id/vote', static function (array $ctx): void {
        ensure_limit('vote:' . $ctx['user']['id'], 30, 60, 'You are submitting ballots too quickly. Wait a moment.');

        $electionId = to_int($ctx['params']['id']);
        if ($electionId === null) {
            fail(404, 'That election could not be found.', 'not_found');
        }
        if (env_value('REQUIRE_EMAIL_VERIFICATION', '0') === '1' && empty($ctx['user']['emailVerified'])) {
            fail(403, 'Verify your e-mail address before voting.', 'email_not_verified');
        }

        $rawCandidates = $ctx['body']['candidateIds'] ?? ($ctx['body']['candidateId'] ?? null);
        if (is_int($rawCandidates) || is_string($rawCandidates)) {
            $rawCandidates = [$rawCandidates];
        }
        if (!is_array($rawCandidates)) {
            fail(400, 'Choose a candidate before submitting your ballot.', 'invalid_candidate');
        }
        $candidateIds = [];
        foreach ($rawCandidates as $raw) {
            $id = to_int($raw);
            if ($id === null) {
                fail(400, 'Choose a candidate before submitting your ballot.', 'invalid_candidate');
            }
            $candidateIds[] = $id;
        }
        $candidateIds = array_values(array_unique($candidateIds));
        if ($candidateIds === []) {
            fail(400, 'Choose a candidate before submitting your ballot.', 'invalid_candidate');
        }

        $receipt = null;
        $castBallot = null;
        $castAt = now_iso();

        for ($attempt = 1; $attempt <= 3; $attempt += 1) {
            $code = new_receipt_code();
            $receiptHash = receipt_hash($code);
            try {
                $castBallot = db_transaction(static function () use ($electionId, $candidateIds, $ctx, $receiptHash, $castAt): array {
                    // Lock the election so its status cannot change while the
                    // ballot is being recorded.
                    $row = db_one('SELECT * FROM elections WHERE id = ? FOR UPDATE', [$electionId]);
                    if ($row === null) {
                        fail(404, 'That election could not be found.', 'not_found');
                    }

                    $status = effective_status($row);
                    if ($status === 'scheduled') {
                        fail(403, 'Voting has not opened for this election yet.', 'not_open');
                    }
                    if ($status !== 'open') {
                        fail(403, 'Voting is closed for this election.', 'closed');
                    }

                    $maxChoices = (int) ($row['max_choices'] ?? 1);
                    if (count($candidateIds) > $maxChoices) {
                        fail(400, 'You may choose at most ' . $maxChoices . ' candidate(s).', 'too_many_choices');
                    }

                    $placeholders = implode(',', array_fill(0, count($candidateIds), '?'));
                    $params = array_merge($candidateIds, [$electionId]);
                    $candidates = db_all(
                        "SELECT id, name, party FROM candidates WHERE id IN ({$placeholders}) AND election_id = ?",
                        $params,
                    );
                    if (count($candidates) !== count($candidateIds)) {
                        fail(400, 'One or more candidates are not on this ballot.', 'invalid_candidate');
                    }

                    // Record participation first. UNIQUE (election_id, voter_id)
                    // rejects a second ballot even when two requests arrive at
                    // exactly the same moment.
                    db_exec(
                        'INSERT INTO participation (election_id, voter_id, voted_at) VALUES (?, ?, ?)',
                        [$electionId, (int) $ctx['user']['id'], iso_to_sql($castAt)],
                    );

                    $voteId = random_token(16);
                    // The ballot itself is anonymous: a random id, no voter id
                    // and no timestamp, so it cannot be linked back to a voter.
                    db_exec(
                        'INSERT INTO votes (id, election_id, candidate_id, receipt_hash) VALUES (?, ?, ?, ?)',
                        [$voteId, $electionId, null, $receiptHash],
                    );
                    foreach ($candidates as $c) {
                        $rank = array_search((int) $c['id'], $candidateIds, true);
                        db_exec(
                            'INSERT INTO vote_choices (vote_id, candidate_id, rank) VALUES (?, ?, ?)',
                            [$voteId, (int) $c['id'], $rank === false ? 0 : (int) $rank],
                        );
                    }

                    return ['candidate' => $candidates[0], 'title' => $row['title'], 'candidates' => $candidates];
                });
                $receipt = $code;
                break;
            } catch (PDOException $error) {
                if (!db_is_duplicate($error)) {
                    throw $error;
                }
                if (str_contains(strtolower($error->getMessage()), 'participation')) {
                    fail(409, 'Your ballot has already been cast for this election.', 'already_voted');
                }
                // A receipt-code collision is vanishingly rare; try a new code.
            }
        }

        if ($receipt === null || $castBallot === null) {
            fail(500, 'Could not issue a ballot receipt. Please try again.', 'receipt_conflict');
        }

        audit((int) $ctx['user']['id'], 'vote.cast', ['electionId' => $electionId], $ctx['ip']);
        notify((int) $ctx['user']['id'], 'vote.recorded', 'Your ballot was recorded',
            'Keep your receipt to verify your vote at any time.', '/verify?code=' . $receipt);
        fire_webhooks('vote.cast', ['electionId' => $electionId]);

        send_json(201, [
            'receipt' => $receipt,
            'election' => ['id' => $electionId, 'title' => $castBallot['title']],
            'candidate' => [
                'id' => (int) $castBallot['candidate']['id'],
                'name' => $castBallot['candidate']['name'],
                'party' => $castBallot['candidate']['party'],
            ],
            'castAt' => $castAt,
            'changed' => false,
        ]);
    }, ['auth' => true]);

    $add('GET', '/api/verify/:code', static function (array $ctx): void {
        ensure_limit('verify:' . $ctx['ip'], 60, 60, 'Too many verification attempts. Wait a moment.');
        $code = normalize_receipt($ctx['params']['code'] ?? '');
        if (preg_match('/^OB[A-Z0-9]{16}$/', $code) !== 1) {
            fail(404, 'No ballot matches that receipt code.', 'receipt_not_found');
        }

        $vote = db_one(
            'SELECT v.id AS vote_id, e.id AS election_id, e.title AS election_title
             FROM votes v
             JOIN elections e ON e.id = v.election_id
             WHERE v.receipt_hash IN (?, ?)',
            [receipt_hash($code), legacy_receipt_hash($code)],
        );
        if ($vote === null) {
            fail(404, 'No ballot matches that receipt code.', 'receipt_not_found');
        }
        $receiptHashes = db_all(
            'SELECT receipt_hash FROM votes WHERE election_id = ? ORDER BY id ASC',
            [(int) $vote['election_id']],
        );
        $leaves = array_map(static fn (array $r): string => (string) $r['receipt_hash'], $receiptHashes);
        $leaf = receipt_hash($code);
        $leafIndex = array_search($leaf, $leaves, true);
        if ($leafIndex === false) {
            $leafIndex = 0;
        }
        $merkleRoot = merkle_root($leaves);
        $proof = merkle_proof($leaves, (int) $leafIndex);

        // persist root if missing
        db_exec('UPDATE elections SET merkle_root = ? WHERE id = ? AND (merkle_root IS NULL OR merkle_root = ?)', [$merkleRoot, (int) $vote['election_id'], '']);

        $choices = db_all(
            'SELECT c.name, c.party FROM vote_choices vc JOIN candidates c ON c.id = vc.candidate_id WHERE vc.vote_id = ?',
            [$vote['vote_id']],
        );
        $candidates = [];
        foreach ($choices as $c) {
            $candidates[] = ['name' => $c['name'], 'party' => $c['party']];
        }

        send_json(200, [
            'valid' => true,
            'counted' => true,
            'election' => ['id' => (int) $vote['election_id'], 'title' => $vote['election_title']],
            'candidate' => $candidates[0] ?? ['name' => '', 'party' => ''],
            'candidates' => $candidates,
            'merkleRoot' => $merkleRoot,
            'merkleLeaf' => $leaf,
            'merkleProof' => $proof,
            'merkleIndex' => (int) $leafIndex + 1,
            'merkleTotal' => count($leaves),
        ]);
    });

    $add('GET', '/api/elections/:id/audit', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        $election = db_one('SELECT id, title, merkle_root FROM elections WHERE id = ?', [$id]);
        if ($election === null) {
            fail(404, 'Election not found.', 'not_found');
        }
        $rows = db_all('SELECT receipt_hash FROM votes WHERE election_id = ? ORDER BY id ASC', [$id]);
        $leaves = array_map(static fn (array $r): string => (string) $r['receipt_hash'], $rows);
        $root = $election['merkle_root'] ?: merkle_root($leaves);
        if (!$election['merkle_root']) {
            db_exec('UPDATE elections SET merkle_root = ? WHERE id = ?', [$root, $id]);
        }
        send_json(200, [
            'electionId' => $id,
            'title' => $election['title'],
            'ballotCount' => count($leaves),
            'merkleRoot' => $root,
            'leaves' => $leaves,
        ]);
    });

    $add('GET', '/api/admin/schema', static function (array $ctx): void {
        $cfg = config('db');
        $isPg = ($cfg['driver'] ?? 'mysql') === 'pgsql';
        if ($isPg) {
            $tables = db_all(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name",
            );
            $result = [];
            foreach ($tables as $t) {
                $name = (string) $t['table_name'];
                $cols = db_all(
                    "SELECT column_name, data_type, is_nullable, column_default
                     FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?
                     ORDER BY ordinal_position",
                    [$name],
                );
                $result[] = ['table' => $name, 'columns' => $cols];
            }
        } else {
            $tables = db_all(
                "SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
            );
            $result = [];
            foreach ($tables as $t) {
                $name = (string) $t['table_name'];
                $cols = db_all(
                    "SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default
                     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
                     ORDER BY ORDINAL_POSITION",
                    [$name],
                );
                $result[] = ['table' => $name, 'columns' => $cols];
            }
        }
        send_json(200, ['tables' => $result]);
    }, ['admin' => true]);

    /* ------------------------------------------------------------------ */
    /* Signed results                                                      */
    /* ------------------------------------------------------------------ */

    $add('GET', '/api/elections/:id/results/pdf', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        $signed = signed_results_for($id);
        $payload = $signed['payload'];
        if (($payload['status'] ?? '') !== 'closed') {
            fail(409, 'Results can only be certified after voting closes.', 'election_open');
        }
        $lines = [
            ['font' => 'sans', 'size' => 10, 'x' => 50, 'y' => 800, 'text' => 'OPEN BALLOT - OFFICIAL RESULTS CERTIFICATE'],
            ['font' => 'sans', 'size' => 20, 'x' => 50, 'y' => 765, 'text' => (string) $payload['title']],
            ['font' => 'sans', 'size' => 10, 'x' => 50, 'y' => 740, 'text' => 'Election ID: ' . (int) $payload['electionId'] . '   Status: ' . (string) $payload['status']],
            ['font' => 'sans', 'size' => 10, 'x' => 50, 'y' => 722, 'text' => 'Total ballots cast: ' . (int) $payload['totalVotes'] . '   Generated: ' . (string) $payload['generatedAt']],
            ['font' => 'sans', 'size' => 12, 'x' => 50, 'y' => 690, 'text' => 'CANDIDATE                         VOTES     SHARE'],
        ];
        $y = 668;
        foreach ($payload['candidates'] as $candidate) {
            $name = str_pad((string) $candidate['name'], 34);
            $lines[] = [
                'font' => 'mono', 'size' => 10, 'x' => 50, 'y' => $y,
                'text' => $name . str_pad((string) $candidate['votes'], 9) . (string) $candidate['share'] . '%',
            ];
            $y -= 20;
        }
        $y -= 10;
        $lines[] = ['font' => 'sans', 'size' => 10, 'x' => 50, 'y' => $y, 'text' => 'Integrity signature (' . $signed['algorithm'] . '):'];
        $signature = (string) $signed['signature'];
        foreach (str_split($signature, 64) as $chunk) {
            $y -= 16;
            $lines[] = ['font' => 'mono', 'size' => 8, 'x' => 50, 'y' => $y, 'text' => $chunk];
        }
        $y -= 24;
        $lines[] = ['font' => 'sans', 'size' => 9, 'x' => 50, 'y' => $y, 'text' => 'Key fingerprint: ' . (string) $signed['keyFingerprint']];
        $y -= 18;
        $lines[] = ['font' => 'sans', 'size' => 9, 'x' => 50, 'y' => $y, 'text' => 'Verify at: ' . (string) env_value('APP_URL', 'http://127.0.0.1:3000') . '/election/' . $id];

        $pdf = pdf_document('Open Ballot results certificate', $lines);
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="open-ballot-results-' . $id . '.pdf"');
        header('Content-Length: ' . strlen($pdf));
        header('Cache-Control: no-store');
        echo $pdf;
    });

    $add('GET', '/api/archive', static function (array $ctx): void {
        $rows = db_all("SELECT * FROM elections WHERE status = 'closed' ORDER BY closes_at DESC, created_at DESC");
        $entries = [];
        foreach ($rows as $row) {
            $election = serialize_election($row, $ctx['user']);
            if (empty($election['resultsVisible'])) {
                continue;
            }
            $entries[] = [
                'id' => (int) $election['id'],
                'title' => (string) $election['title'],
                'closedAt' => $election['closesAt'],
                'totalVotes' => (int) $election['totalVotes'],
                'results' => $election['results'] ?? null,
            ];
        }
        send_json(200, ['elections' => $entries]);
    });

    $add('GET', '/api/audit/chain', static function (array $ctx): void {
        $rows = db_all('SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id ASC');
        $prev = str_repeat('0', 64);
        $entries = [];
        foreach ($rows as $r) {
            $details = safe_json($r['details']);
            $entry = sprintf('%s|%s|%s|%s', $r['created_at'], $r['actor_name'] ?? 'system', $r['action'], is_string($details) ? $details : json_encode($details));
            $hash = hash_hmac('sha256', $prev . $entry, (string) config('app_name'));
            $entries[] = [
                'id' => (int) $r['id'],
                'createdAt' => sql_to_iso($r['created_at']),
                'rawCreatedAt' => (string) $r['created_at'],
                'actor' => $r['actor_name'] ?? 'system',
                'action' => $r['action'],
                'details' => is_string($details) ? $details : json_encode($details),
                'hash' => $hash,
            ];
            $prev = $hash;
        }
        send_json(200, [
            'entries' => $entries,
            'head' => $prev,
            'algorithm' => 'HMAC-SHA256',
            'keyHint' => (string) config('app_name'),
        ]);
    });

    $add('GET', '/api/elections/:id/irv', static function (array $ctx): void {
        $election = get_election($ctx['params']['id']);
        if ($election === null) fail(404, 'Election not found.', 'not_found');
        if (($election['ballot_type'] ?? 'single') !== 'ranked') fail(400, 'This election is not ranked-choice.', 'not_ranked');
        send_json(200, irv_results((int) $election['id']));
    });

    $add('GET', '/api/elections/:id/results/signed', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        send_json(200, signed_results_for($id));
    });

    $add('POST', '/api/elections/:id/results/verify', static function (array $ctx): void {
        $payload = $ctx['body']['payload'] ?? null;
        $signature = as_text($ctx['body']['signature'] ?? null);
        if (!is_array($payload) || $signature === '') {
            fail(400, 'A payload and signature are required.', 'invalid_submission');
        }
        $valid = verify_results_signature($payload, $signature);
        send_json(200, ['valid' => $valid]);
    });

    $add('GET', '/api/auth/oauth/:provider', static function (array $ctx): void {
        $provider = (string) $ctx['params']['provider'];
        $cfg = oauth_config($provider);
        if ($cfg === null) fail(404, 'That sign-in provider is not configured.', 'provider_unavailable');
        $redirect = (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/api/auth/oauth/' . $provider . '/callback');
        $state = bin2hex(random_bytes(16));
        set_cookie('oauth_state_' . $provider, $state, 600);
        $url = $cfg['authorize'] . '?' . http_build_query([
            'client_id' => $cfg['id'], 'redirect_uri' => $redirect,
            'response_type' => 'code', 'scope' => $cfg['scope'], 'state' => $state,
        ]);
        header('Location: ' . $url, true, 302);
    });

    $add('GET', '/api/auth/oauth/:provider/callback', static function (array $ctx): void {
        $provider = (string) $ctx['params']['provider'];
        $cfg = oauth_config($provider);
        if ($cfg === null) fail(404, 'Provider not configured.', 'provider_unavailable');
        $expected = $_COOKIE['oauth_state_' . $provider] ?? null;
        $state = as_text($ctx['query']['state'] ?? null);
        if (!is_string($expected) || !hash_equals($expected, $state)) fail(400, 'Invalid sign-in state.', 'invalid_state');
        $code = as_text($ctx['query']['code'] ?? null);
        if ($code === '') fail(400, 'No authorisation code received.', 'missing_code');
        $info = oauth_user_info($provider, $cfg, $code);
        $user = $info === null ? null : oauth_provision($info, $provider);
        if ($user === null) fail(401, 'Could not sign you in with that provider.', 'oauth_failed');
        $now = now_iso();
        db_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [iso_to_sql($now), (int) $user['id']]);
        $user['last_login_at'] = iso_to_sql($now);
        $public = public_user($user);
        $csrf = create_session($public, $ctx['ip']);
        audit((int) $user['id'], 'auth.oauth_login', ['provider' => $provider], $ctx['ip']);
        header('Location: ' . (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/?oauth=success'), true, 302);
    });

    /* ------------------------------------------------------------------ */
    /* DPDP Act, 2023 / GDPR — Data Principal rights                       */
    /* ------------------------------------------------------------------ */

    /* Log a Data Principal request (access / export / correction / erasure /
       consent withdrawal). Art. 15-22 GDPR, s.11-14 DPDP. */
    $add('POST', '/api/account/data-request', static function (array $ctx): void {
        $body = $ctx['body'];
        $type = as_text($body['type'] ?? '');
        $email = normalize_email($body['email'] ?? null);
        $details = as_text($body['details'] ?? '');
        $allowed = ['access', 'export', 'correct', 'delete', 'withdraw'];

        if (!in_array($type, $allowed, true)) {
            fail(400, 'Unknown request type. Valid types: ' . implode(', ', $allowed) . '.', 'invalid_type');
        }
        if ($email === '') {
            fail(400, 'An email address is required to look up your account.', 'email_required');
        }

        // If the requester is signed in, tie the request to their account.
        $userId = $ctx['user']['id'] ?? null;
        $row = db_one('SELECT id FROM users WHERE email = ?', [$email]);
        if ($row !== null) {
            $userId = (int) $row['id'];
        }

        db_exec(
            'INSERT INTO data_requests (user_id, email, type, details, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$userId, $email, $type, $details !== '' ? $details : null, 'pending', iso_to_sql(now_iso())],
        );
        audit($userId, 'dpdp.data_request', ['type' => $type, 'email' => $email], $ctx['ip']);

        send_json(201, [
            'ok' => true,
            'message' => 'Your request has been recorded. We respond within 30 days.',
        ]);
    });

    /* Machine-readable personal-data export (GDPR portability, DPDP s.12). */
    $add('GET', '/api/account/export', static function (array $ctx): void {
        $uid = (int) $ctx['user']['id'];
        $user = db_one('SELECT id, name, email, role, created_at, email_verified_at FROM users WHERE id = ?', [$uid]);
        if ($user === null) fail(404, 'Account not found.', 'not_found');

        $payload = [
            'exportedAt' => now_iso(),
            'controller' => 'Open Ballot Project',
            'legalBasis' => 'Consent (DPDP Act, 2023 s.6) / Contract & legitimate interests (GDPR Art. 6)',
            'account' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'createdAt' => $user['created_at'],
                'emailVerifiedAt' => $user['email_verified_at'],
            ],
            'participation' => array_map(static fn (array $r): array => [
                'electionId' => (int) $r['election_id'],
                'participatedAt' => $r['voted_at'],
            ], db_all('SELECT election_id, voted_at FROM participation WHERE voter_id = ?', [$uid])),
            'receipts' => 'Receipt codes are issued once at voting time and stored only as one-way keyed hashes. They cannot be reverse-engineered, so no exportable receipt list exists. Your receipt code remains valid on the verification page.',
            'note' => 'Ballot choices are stored anonymously and are not linked to your account.',
        ];
        audit($uid, 'dpdp.data_export', [], $ctx['ip']);

        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="open-ballot-data-export.json"');
        send_json(200, $payload);
    }, ['auth' => true]);

    /* Erasure (GDPR Art. 17 / DPDP s.12). Anonymises ballot-linked rows and
       removes the account. Receipt codes are retained because they contain no
       personal data and cannot identify the Data Principal. */
    $add('DELETE', '/api/account', static function (array $ctx): void {
        $uid = (int) $ctx['user']['id'];
        $user = db_one('SELECT id, name, email, password_hash FROM users WHERE id = ?', [$uid]);
        if ($user === null) fail(404, 'Account not found.', 'not_found');

        // Re-authentication before an irreversible action (OWASP / GDPR Art.32).
        $password = as_text($ctx['body']['password'] ?? '');
        if ($password === '' || !verify_password($password, (string) ($user['password_hash'] ?? ''))) {
            fail(403, 'Your password is incorrect. Account deletion was cancelled.', 'password_required');
        }

        $now = iso_to_sql(now_iso());
        // Strip identity while preserving election integrity (tallies, receipt hashes).
        db_exec('UPDATE participation SET voter_id = NULL, voter_token = NULL WHERE voter_id = ?', [$uid]);
        db_exec('DELETE FROM email_verifications WHERE user_id = ?', [$uid]);
        db_exec('DELETE FROM sessions WHERE user_id = ?', [$uid]);
        db_exec('DELETE FROM data_requests WHERE user_id = ?', [$uid]);
        db_exec('DELETE FROM users WHERE id = ?', [$uid]);
        audit(null, 'dpdp.data_erased', ['erasedUserId' => $uid], $ctx['ip']);

        send_json(200, ['ok' => true, 'message' => 'Your account and personal data have been erased.']);
    }, ['auth' => true]);

    /* Update own profile name (GDPR Art.16 rectification). */
    $add('PATCH', '/api/account/profile', static function (array $ctx): void {
        $uid = (int) $ctx['user']['id'];
        $name = require_text($ctx['body']['name'] ?? null, 2, 80, 'Full name');
        db_exec('UPDATE users SET name = ? WHERE id = ?', [$name, $uid]);
        audit($uid, 'account.profile_update', [], $ctx['ip']);
        $row = db_one('SELECT * FROM users WHERE id = ?', [$uid]);
        send_json(200, ['user' => $row === null ? null : public_user($row)]);
    }, ['auth' => true]);

    /* Recovery contact */
    $add('GET', '/api/account/recovery', static function (array $ctx): void {
        $row = db_one('SELECT recovery_email, recovery_verified_at FROM users WHERE id = ?', [(int) $ctx['user']['id']]);
        send_json(200, [
            'email' => $row['recovery_email'] ?? null,
            'verified' => !empty($row['recovery_verified_at']),
        ]);
    }, ['auth' => true]);

    $add('POST', '/api/account/recovery', static function (array $ctx): void {
        $body = $ctx['body'];
        $email = strtolower(trim(as_text($body['email'] ?? null)));
        $password = as_text($body['password'] ?? null);
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) fail(400, 'Enter a valid email.', 'invalid_email');
        $row = db_one('SELECT password_hash FROM users WHERE id = ?', [(int) $ctx['user']['id']]);
        if ($row === null || !verify_password($password, (string) $row['password_hash'])) fail(401, 'Password is incorrect.', 'invalid_password');
        $code = strtoupper(bin2hex(random_bytes(4)));
        db_exec('UPDATE users SET recovery_email = ?, recovery_verified_at = NULL WHERE id = ?', [$email, (int) $ctx['user']['id']]);
        db_exec(
            'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
            [(int) $ctx['user']['id'], sha256($code), iso_to_sql(now_iso_at(time() + 3600)), iso_to_sql(now_iso())],
        );
        send_mail($email, 'Confirm your recovery email', "Your confirmation code is:\n\n{$code}\n\nIt expires in one hour.");
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('POST', '/api/account/recovery/confirm', static function (array $ctx): void {
        $code = strtoupper(as_text($ctx['body']['code'] ?? null));
        $row = db_one(
            'SELECT id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
            [sha256($code), iso_to_sql(now_iso())],
        );
        if ($row === null) fail(400, 'That code is invalid or expired.', 'invalid_code');
        db_exec('UPDATE password_resets SET used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $row['id']]);
        db_exec('UPDATE users SET recovery_verified_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $ctx['user']['id']]);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('POST', '/api/auth/recovery/reset', static function (array $ctx): void {
        $email = strtolower(trim(as_text($ctx['body']['email'] ?? null)));
        $code = strtoupper(as_text($ctx['body']['code'] ?? null));
        $newPassword = validate_password($ctx['body']['newPassword'] ?? null);
        $row = db_one('SELECT id FROM users WHERE recovery_email = ? AND recovery_verified_at IS NOT NULL', [$email]);
        if ($row === null) fail(404, 'No verified recovery contact for that email.', 'not_found');
        $reset = db_one('SELECT id FROM password_resets WHERE token_hash = ? AND user_id = ? AND used_at IS NULL AND expires_at > ?', [sha256($code), (int) $row['id'], iso_to_sql(now_iso())]);
        if ($reset === null) fail(400, 'That code is invalid or expired.', 'invalid_code');
        db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [hash_password($newPassword), (int) $row['id']]);
        db_exec('UPDATE password_resets SET used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $reset['id']]);
        db_exec('DELETE FROM sessions WHERE user_id = ?', [(int) $row['id']]);
        audit((int) $row['id'], 'auth.recovery_reset', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    });

    /* Election templates */
    $admin('GET', '/api/admin/templates', static function (array $ctx): void {
        $rows = db_all('SELECT id, name, created_at FROM election_templates WHERE user_id = ? ORDER BY created_at DESC', [(int) $ctx['user']['id']]);
        send_json(200, ['templates' => $rows]);
    });

    $admin('POST', '/api/admin/templates', static function (array $ctx): void {
        $name = require_text($ctx['body']['name'] ?? null, 2, 120, 'Name');
        $election = get_election($ctx['body']['electionId'] ?? 0);
        if ($election === null) fail(404, 'Election not found.', 'not_found');
        $candidates = db_all('SELECT name, party, bio FROM candidates WHERE election_id = ? ORDER BY position, id', [(int) $election['id']]);
        $payload = [
            'title' => $election['title'], 'description' => $election['description'],
            'resultsVisibility' => $election['results_visibility'], 'maxChoices' => (int) $election['max_choices'],
            'ballotType' => $election['ballot_type'] ?? 'single', 'brandColor' => $election['brand_color'] ?? null,
            'candidates' => $candidates,
        ];
        db_exec('INSERT INTO election_templates (user_id, name, payload, created_at) VALUES (?, ?, ?, ?)', [(int) $ctx['user']['id'], $name, json_encode($payload), iso_to_sql(now_iso())]);
        send_json(201, ['ok' => true]);
    });

    $admin('POST', '/api/admin/templates/:id/apply', static function (array $ctx): void {
        $row = db_one('SELECT payload FROM election_templates WHERE id = ? AND user_id = ?', [(int) $ctx['params']['id'], (int) $ctx['user']['id']]);
        if ($row === null) fail(404, 'Template not found.', 'not_found');
        $p = json_decode((string) $row['payload'], true) ?: [];
        $now = now_iso();
        $newId = db_insert(
            'INSERT INTO elections (title, description, status, results_visibility, max_choices, ballot_type, brand_color, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [($p['title'] ?? 'Untitled') . ' (from template)', $p['description'] ?? '', 'draft', $p['resultsVisibility'] ?? 'after_close', (int) ($p['maxChoices'] ?? 1), $p['ballotType'] ?? 'single', $p['brandColor'] ?? null, (int) $ctx['user']['id'], iso_to_sql($now), iso_to_sql($now)],
        );
        foreach (($p['candidates'] ?? []) as $c) {
            db_exec('INSERT INTO candidates (election_id, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?)', [$newId, $c['name'], $c['party'] ?? '', $c['bio'] ?? '', iso_to_sql($now)]);
        }
        send_json(201, ['id' => $newId]);
    });

    $admin('DELETE', '/api/admin/templates/:id', static function (array $ctx): void {
        db_exec('DELETE FROM election_templates WHERE id = ? AND user_id = ?', [(int) $ctx['params']['id'], (int) $ctx['user']['id']]);
        send_json(200, ['ok' => true]);
    });

    /* Email invitations */
    $admin('GET', '/api/admin/elections/:id/invitations', static function (array $ctx): void {
        $rows = db_all('SELECT id, email, sent_at, created_at FROM email_invitations WHERE election_id = ? ORDER BY created_at DESC', [(int) $ctx['params']['id']]);
        send_json(200, ['invitations' => $rows]);
    });

    $admin('POST', '/api/admin/elections/:id/invitations', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        $election = get_election($id);
        if ($election === null) fail(404, 'Election not found.', 'not_found');
        $emails = preg_split('/[\s,;]+/', as_text($ctx['body']['emails'] ?? null)) ?: [];
        $sent = 0;
        foreach ($emails as $email) {
            $email = strtolower(trim($email));
            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) continue;
            $token = random_token(24);
            db_exec('INSERT INTO email_invitations (election_id, email, token_hash, created_at) VALUES (?, ?, ?, ?)', [$id, $email, sha256($token), iso_to_sql(now_iso())]);
            $url = (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/election/' . $id . '?invite=' . $token);
            send_mail($email, 'You are invited to vote', "An election is open for voting:\n\n{$election['title']}\n\n{$url}\n\nRegister or sign in to cast your ballot.");
            $sent += 1;
        }
        audit((int) $ctx['user']['id'], 'election.invitations_sent', ['electionId' => $id, 'count' => $sent], $ctx['ip']);
        send_json(200, ['sent' => $sent]);
    });

    /* Digest opt-in + cron */
    $add('GET', '/api/account/digest', static function (array $ctx): void {
        $row = db_one('SELECT digest_optin FROM users WHERE id = ?', [(int) $ctx['user']['id']]);
        send_json(200, ['optedIn' => !empty($row['digest_optin'])]);
    }, ['auth' => true]);

    $add('POST', '/api/account/digest', static function (array $ctx): void {
        $value = !empty($ctx['body']['optedIn']) ? 1 : 0;
        db_exec('UPDATE users SET digest_optin = ? WHERE id = ?', [$value, (int) $ctx['user']['id']]);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('GET', '/api/account/phone', static function (array $ctx): void {
        $row = db_one('SELECT phone, phone_verified_at FROM users WHERE id = ?', [(int) $ctx['user']['id']]);
        send_json(200, [
            'phone' => $row['phone'] ?? null,
            'verified' => !empty($row['phone_verified_at']),
            'provider' => sms_provider(),
        ]);
    }, ['auth' => true]);

    $add('POST', '/api/account/phone', static function (array $ctx): void {
        ensure_limit('phone-send:' . $ctx['user']['id'], 5, 3600, 'Too many codes requested. Try again later.');
        $phone = normalize_phone($ctx['body']['phone'] ?? null);
        if ($phone === null) {
            fail(400, 'Enter a valid phone number (8–15 digits).', 'invalid_phone');
        }
        $taken = db_one('SELECT id FROM users WHERE phone = ? AND id <> ?', [$phone, (int) $ctx['user']['id']]);
        if ($taken !== null) {
            fail(409, 'That phone number is already in use.', 'phone_taken');
        }
        $code = sms_code();
        db_exec('UPDATE users SET phone = ?, phone_verified_at = NULL WHERE id = ?', [$phone, (int) $ctx['user']['id']]);
        $isPg = (config('db')['driver'] ?? 'mysql') === 'pgsql';
        $upsert = $isPg
            ? 'INSERT INTO phone_verifications (user_id, code_hash, expires_at, attempts, created_at)
               VALUES (?, ?, ?, 0, ?)
               ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = EXCLUDED.created_at'
            : 'INSERT INTO phone_verifications (user_id, code_hash, expires_at, attempts, created_at)
               VALUES (?, ?, ?, 0, ?)
               ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), attempts = 0, created_at = VALUES(created_at)';
        db_exec($upsert, [(int) $ctx['user']['id'], hmac('phone:' . $code), iso_to_sql(now_iso_at(time() + 600)), iso_to_sql(now_iso())]);
        send_sms($phone, 'Your Open Ballot verification code is ' . $code . '. It expires in 10 minutes.');
        audit((int) $ctx['user']['id'], 'phone.code_sent', [], $ctx['ip']);
        send_json(200, ['sent' => true, 'phone' => $phone, 'expiresIn' => 600]);
    }, ['auth' => true]);

    $add('POST', '/api/account/phone/verify', static function (array $ctx): void {
        ensure_limit('phone-verify:' . $ctx['user']['id'], 10, 900, 'Too many verification attempts. Try again later.');
        $row = db_one('SELECT * FROM phone_verifications WHERE user_id = ?', [(int) $ctx['user']['id']]);
        if ($row === null || sql_timestamp($row['expires_at']) <= time() || (int) $row['attempts'] >= 5) {
            fail(400, 'The code has expired. Request a new one.', 'invalid_code');
        }
        $code = trim((string) ($ctx['body']['code'] ?? ''));
        if (!hash_equals((string) $row['code_hash'], hmac('phone:' . $code))) {
            db_exec('UPDATE phone_verifications SET attempts = attempts + 1 WHERE user_id = ?', [(int) $ctx['user']['id']]);
            fail(400, 'That code is not correct.', 'invalid_code');
        }
        db_exec('UPDATE users SET phone_verified_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $ctx['user']['id']]);
        db_exec('DELETE FROM phone_verifications WHERE user_id = ?', [(int) $ctx['user']['id']]);
        audit((int) $ctx['user']['id'], 'phone.verified', [], $ctx['ip']);
        notify((int) $ctx['user']['id'], 'phone.verified', 'Phone number verified', 'Your phone number is now verified.');
        send_json(200, ['verified' => true]);
    }, ['auth' => true]);

    $add('DELETE', '/api/account/phone', static function (array $ctx): void {
        db_exec('UPDATE users SET phone = NULL, phone_verified_at = NULL WHERE id = ?', [(int) $ctx['user']['id']]);
        db_exec('DELETE FROM phone_verifications WHERE user_id = ?', [(int) $ctx['user']['id']]);
        audit((int) $ctx['user']['id'], 'phone.removed', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('GET', '/api/cron/digest', static function (array $ctx): void {
        $secret = env_value('CRON_SECRET');
        if ($secret === null || !hash_equals($secret, as_text($ctx['query']['secret'] ?? null))) {
            fail(401, 'Invalid cron secret.', 'unauthorized');
        }
        $recent = db_all("SELECT id, title FROM elections WHERE status = 'open' AND created_at > ?", [iso_to_sql(now_iso_at(time() - 7 * 86400))]);
        if (!$recent) { send_json(200, ['sent' => 0]); return; }
        $users = db_all('SELECT email FROM users WHERE digest_optin = 1 AND active = 1');
        $lines = array_map(static fn (array $e): string => '- ' . $e['title'] . ' (' . env_value('APP_URL', 'http://127.0.0.1:3000') . '/election/' . $e['id'] . ')', $recent);
        $body = "New open elections this week:\n\n" . implode("\n", $lines) . "\n\nManage your digest in Account settings.";
        $sent = 0;
        foreach ($users as $u) { if (send_mail((string) $u['email'], 'Open Ballot election digest', $body)) $sent += 1; }
        send_json(200, ['sent' => $sent, 'elections' => count($recent)]);
    });

    $add('GET', '/api/cron/poll-reminders', static function (array $ctx): void {
        $secret = env_value('CRON_SECRET');
        if ($secret === null || !hash_equals($secret, as_text($ctx['query']['secret'] ?? null))) {
            fail(401, 'Invalid cron secret.', 'unauthorized');
        }
        $soon = iso_to_sql(now_iso_at(time() + 24 * 3600));
        $polls = db_all(
            "SELECT id, title, slug, closes_at FROM elections
             WHERE kind = 'poll' AND status = 'open' AND closes_at IS NOT NULL AND closes_at <= ?",
            [$soon],
        );
        $sent = 0;
        foreach ($polls as $poll) {
            $subscribers = db_all(
                'SELECT u.email, u.phone, u.phone_verified_at, s.user_id FROM poll_subscriptions s JOIN users u ON u.id = s.user_id
                 WHERE s.poll_id = ? AND s.reminded_at IS NULL AND u.active = 1',
                [(int) $poll['id']],
            );
            if (!$subscribers) {
                continue;
            }
            $link = env_value('APP_URL', 'http://127.0.0.1:3000') . '/p/' . (string) ($poll['slug'] ?? '');
            $body = 'This poll closes soon: ' . $poll['title'] . "\n\n" . $link
                . "\n\nYou are receiving this because you asked for a reminder.";
            foreach ($subscribers as $subscriber) {
                if (send_mail((string) $subscriber['email'], 'Poll closing soon — Open Ballot', $body)) {
                    $sent += 1;
                }
                notify((int) $subscriber['user_id'], 'poll.closing', 'A poll you follow closes soon',
                    (string) $poll['title'], '/p/' . (string) ($poll['slug'] ?? ''));
                if (!empty($subscriber['phone_verified_at']) && !empty($subscriber['phone'])) {
                    send_sms((string) $subscriber['phone'], 'Poll closing soon: ' . $poll['title'] . ' ' . $link);
                }
                db_exec('UPDATE poll_subscriptions SET reminded_at = ? WHERE poll_id = ? AND user_id = ?', [
                    iso_to_sql(now_iso()), (int) $poll['id'], (int) $subscriber['user_id'],
                ]);
            }
        }
        send_json(200, ['sent' => $sent, 'polls' => count($polls)]);
    });

    /* ------------------------------------------------------------------ */
    /* Platform ops                                                        */
    /* ------------------------------------------------------------------ */

    $add('POST', '/api/client-error', static function (array $ctx): void {
        $message = as_text($ctx['body']['message'] ?? null);
        if ($message !== '' && strlen($message) < 500) {
            report_error('[client] ' . $message, ['url' => as_text($ctx['body']['url'] ?? null)]);
        }
        send_json(200, ['ok' => true]);
    });

    $add('GET', '/api/status/history', static function (array $ctx): void {
        $rows = db_all(
            'SELECT recorded_at, status, checks FROM health_snapshots
             WHERE recorded_at > ? ORDER BY recorded_at ASC',
            [iso_to_sql(now_iso_at(time() - 90 * 86400))],
        );
        send_json(200, ['snapshots' => $rows]);
    });

    $admin('GET', '/api/admin/api-keys', static function (array $ctx): void {
        $rows = db_all(
            'SELECT id, name, prefix, last_used_at, created_at, revoked_at FROM api_keys
             WHERE user_id = ? ORDER BY created_at DESC',
            [(int) $ctx['user']['id']],
        );
        send_json(200, ['keys' => $rows]);
    });

    $admin('POST', '/api/admin/api-keys', static function (array $ctx): void {
        $name = require_text($ctx['body']['name'] ?? null, 2, 80, 'Name');
        $issued = api_key_issue((int) $ctx['user']['id'], $name);
        audit((int) $ctx['user']['id'], 'api_key.created', ['name' => $name], $ctx['ip']);
        send_json(201, $issued);
    });

    $admin('DELETE', '/api/admin/api-keys/:id', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        db_exec('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ?', [iso_to_sql(now_iso()), $id, (int) $ctx['user']['id']]);
        audit((int) $ctx['user']['id'], 'api_key.revoked', ['id' => $id], $ctx['ip']);
        send_json(200, ['ok' => true]);
    });

    $add('GET', '/api/public/elections', static function (array $ctx): void {
        if (!api_key_authenticate()) {
            fail(401, 'A valid API key is required (X-API-Key).', 'invalid_api_key');
        }
        $rows = db_all("SELECT id, title, status, created_at FROM elections WHERE status != 'draft' ORDER BY created_at DESC LIMIT 100");
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['ballots'] = count_votes((int) $row['id']);
        }
        send_json(200, ['elections' => $rows]);
    });

    $add('GET', '/api/public/results/:id', static function (array $ctx): void {
        if (!api_key_authenticate()) {
            fail(401, 'A valid API key is required (X-API-Key).', 'invalid_api_key');
        }
        $id = (int) $ctx['params']['id'];
        $election = get_election($id);
        if ($election === null || $election['status'] !== 'closed') {
            fail(404, 'Published results not found.', 'not_found');
        }
        send_json(200, signed_results_for($id));
    });

    $admin('GET', '/api/admin/webhooks/:id/deliveries', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        $rows = db_all(
            'SELECT id, event, response_code, success, error, created_at FROM webhook_deliveries
             WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 50',
            [$id],
        );
        send_json(200, ['deliveries' => $rows]);
    });

    /* ------------------------------------------------------------------ */
    /* Sessions & trusted devices                                          */
    /* ------------------------------------------------------------------ */

    $add('GET', '/api/sessions', static function (array $ctx): void {
        $sessions = session_rows((int) $ctx['user']['id'], (string) $ctx['session']['id']);
        send_json(200, ['sessions' => $sessions]);
    }, ['auth' => true]);

    $add('DELETE', '/api/sessions/:id', static function (array $ctx): void {
        $id = (string) $ctx['params']['id'];
        if (hash_equals((string) $ctx['session']['id'], $id)) {
            fail(400, 'Use sign out to end your current session.', 'current_session');
        }
        db_exec(
            'DELETE FROM sessions WHERE id = ? AND user_id = ?',
            [$id, (int) $ctx['user']['id']],
        );
        audit((int) $ctx['user']['id'], 'auth.session_revoked', ['id' => $id], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('POST', '/api/sessions/revoke-others', static function (array $ctx): void {
        db_exec(
            'DELETE FROM sessions WHERE user_id = ? AND id != ?',
            [(int) $ctx['user']['id'], (string) $ctx['session']['id']],
        );
        audit((int) $ctx['user']['id'], 'auth.sessions_revoked', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('GET', '/api/trusted-devices', static function (array $ctx): void {
        $rows = db_all(
            'SELECT id, name, created_at, expires_at FROM trusted_devices
             WHERE user_id = ? ORDER BY created_at DESC',
            [(int) $ctx['user']['id']],
        );
        send_json(200, ['devices' => $rows]);
    }, ['auth' => true]);

    $add('POST', '/api/trusted-devices', static function (array $ctx): void {
        issue_trusted_device((int) $ctx['user']['id']);
        audit((int) $ctx['user']['id'], 'auth.device_trusted', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('DELETE', '/api/trusted-devices', static function (array $ctx): void {
        revoke_trusted_device((int) $ctx['user']['id']);
        audit((int) $ctx['user']['id'], 'auth.device_forgotten', [], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    /* ------------------------------------------------------------------ */
    /* Public audit verification                                           */
    /* ------------------------------------------------------------------ */

    $add('GET', '/api/audit/verify', static function (array $ctx): void {
        $rows = db_all('SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id ASC');
        $prev = str_repeat('0', 64);
        foreach ($rows as $r) {
            $details = safe_json($r['details']);
            $entry = sprintf('%s|%s|%s|%s', $r['created_at'], $r['actor_name'] ?? 'system', $r['action'], is_string($details) ? $details : json_encode($details));
            $prev = hash_hmac('sha256', $prev . $entry, (string) config('app_name'));
        }
        send_json(200, [
            'status' => 'operational',
            'entries' => count($rows),
            'chainHead' => $prev,
            'algorithm' => 'HMAC-SHA256',
            'note' => 'Each entry is chained to the previous one; the head is published for transparency.',
        ]);
    });

    /* ------------------------------------------------------------------ */
    /* Notifications                                                       */
    /* ------------------------------------------------------------------ */

    $add('GET', '/api/notifications', static function (array $ctx): void {
        $rows = db_all(
            'SELECT id, type, title, body, link, read_at, created_at FROM notifications
             WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [(int) $ctx['user']['id']],
        );
        $unread = (int) db_scalar(
            'SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL',
            [(int) $ctx['user']['id']],
        );
        send_json(200, ['notifications' => $rows, 'unread' => $unread]);
    }, ['auth' => true]);

    $add('POST', '/api/notifications/:id/read', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        $row = db_one('SELECT id FROM notifications WHERE id = ? AND user_id = ?', [$id, (int) $ctx['user']['id']]);
        if ($row === null) {
            fail(404, 'Notification not found.', 'not_found');
        }
        db_exec('UPDATE notifications SET read_at = ? WHERE id = ?', [iso_to_sql(now_iso()), $id]);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('POST', '/api/notifications/read-all', static function (array $ctx): void {
        db_exec('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [iso_to_sql(now_iso()), (int) $ctx['user']['id']]);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    /* ------------------------------------------------------------------ */
    /* Election analytics + audit export                                   */
    /* ------------------------------------------------------------------ */

    $admin('GET', '/api/admin/elections/:id/voters', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        if (get_election($id) === null) {
            fail(404, 'Election not found.', 'not_found');
        }
        $rows = db_all(
            'SELECT u.id, u.name, u.email, u.active, p.voted_at
             FROM participation p JOIN users u ON u.id = p.voter_id
             WHERE p.election_id = ? ORDER BY p.voted_at DESC',
            [$id],
        );
        send_json(200, ['voters' => $rows]);
    });

    $admin('GET', '/api/admin/elections/:id/analytics', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        if (get_election($id) === null) {
            fail(404, 'Election not found.', 'not_found');
        }
        $total = (int) db_scalar('SELECT COUNT(*) FROM votes WHERE election_id = ?', [$id]);
        $peakResult = db_one(
            'SELECT DATE(voted_at) AS day, COUNT(*) AS votes FROM participation
             WHERE election_id = ? GROUP BY DATE(voted_at) ORDER BY votes DESC LIMIT 1',
            [$id],
        );
        $daily = db_all(
            'SELECT DATE(voted_at) AS day, COUNT(*) AS votes FROM participation
             WHERE election_id = ? GROUP BY DATE(voted_at) ORDER BY day ASC',
            [$id],
        );
        send_json(200, ['totalVotes' => $total, 'peakDay' => $peakResult, 'daily' => $daily]);
    });

    $admin('GET', '/api/admin/audit/export', static function (array $ctx): void {
        $rows = db_all('SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id ASC');
        $header = 'HMAC-Signed Audit Log' . "\n" . 'Generated: ' . now_iso() . "\n\n";
        $lines = [];
        $prev = str_repeat('0', 64);
        foreach ($rows as $r) {
            $entry = sprintf('%s|%s|%s|%s', $r['created_at'], $r['actor_name'] ?? 'system', $r['action'], $r['details']);
            $hash = hash_hmac('sha256', $prev . $entry, (string) config('app_name'));
            $lines[] = $entry . '|' . $hash;
            $prev = $hash;
        }
        $content = $header . implode("\n", $lines);
        send_json(200, ['exported' => count($rows), 'chainHead' => $prev, 'content' => $content]);
    });

    /* ------------------------------------------------------------------ */
    /* Webhooks                                                            */
    /* ------------------------------------------------------------------ */

    $admin('GET', '/api/admin/webhooks', static function (array $ctx): void {
        $rows = db_all('SELECT id, url, events, active, last_sent_at, created_at FROM webhooks WHERE user_id = ? ORDER BY created_at DESC', [(int) $ctx['user']['id']]);
        send_json(200, ['webhooks' => $rows]);
    });

    $admin('POST', '/api/admin/webhooks', static function (array $ctx): void {
        $body = $ctx['body'];
        $url = require_text($body['url'] ?? null, 10, 500, 'URL');
        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            fail(400, 'A valid URL is required.', 'invalid_url');
        }
        $events = as_text($body['events'] ?? 'vote.cast');
        $secret = bin2hex(random_bytes(32));
        $id = db_insert(
            'INSERT INTO webhooks (user_id, url, events, secret, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
            [(int) $ctx['user']['id'], $url, $events, $secret, iso_to_sql(now_iso())],
        );
        audit((int) $ctx['user']['id'], 'webhook.created', ['id' => $id, 'url' => $url], $ctx['ip']);
        send_json(201, ['id' => $id, 'secret' => $secret, 'url' => $url, 'events' => $events]);
    });

    $admin('DELETE', '/api/admin/webhooks/:id', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        $row = db_one('SELECT id FROM webhooks WHERE id = ? AND user_id = ?', [$id, (int) $ctx['user']['id']]);
        if ($row === null) {
            fail(404, 'Webhook not found.', 'not_found');
        }
        db_exec('DELETE FROM webhooks WHERE id = ?', [$id]);
        audit((int) $ctx['user']['id'], 'webhook.deleted', ['id' => $id], $ctx['ip']);
        send_json(200, ['ok' => true]);
    });

    $add('POST', '/api/auth/passkeys/register/options', static function (array $ctx): void {
        $user = $ctx['user'];
        $rpId = parse_url((string) env_value('APP_URL', 'http://localhost'), PHP_URL_HOST) ?: 'localhost';
        $challenge = base64url_encode(random_bytes(32));
        store_webauthn_challenge((int) $user['id'], $challenge, 'register');

        // If the webauthn library is available (Composer installed in Docker), use it to
        // build options. Otherwise fall back to manual options (still valid for browsers).
        $options = [
            'challenge' => $challenge,
            'rp' => ['name' => config('app_name'), 'id' => $rpId],
            'user' => [
                'id' => base64url_encode(pack('N*', (int) $user['id'])),
                'name' => $user['email'],
                'displayName' => $user['name'],
            ],
            'pubKeyCredParams' => [['type' => 'public-key', 'alg' => -7], ['type' => 'public-key', 'alg' => -257]],
            'timeout' => 60000,
            'attestation' => 'none',
            'authenticatorSelection' => ['residentKey' => 'preferred', 'userVerification' => 'preferred'],
        ];
        if (class_exists('Webauthn\PublicKeyCredentialCreationOptions')) {
            $wk = \Webauthn\PublicKeyCredentialCreationOptions::create($options);
            $options = json_decode($wk->jsonSerialize(), true);
        }
        send_json(200, $options);
    }, ['auth' => true]);

    $add('POST', '/api/auth/passkeys/register/verify', static function (array $ctx): void {
        $user = $ctx['user'];
        $body = $ctx['body'];
        $clientDataJSON = as_text($body['response']['clientDataJSON'] ?? null);
        $attestationObject = as_text($body['response']['attestationObject'] ?? null);
        $credentialId = as_text($body['id'] ?? null);
        $deviceName = as_text($body['deviceName'] ?? 'Passkey');
        if ($clientDataJSON === '' || $attestationObject === '' || $credentialId === '') {
            fail(400, 'Missing attestation data.', 'invalid_attestation');
        }
        $challenge = as_text($body['challenge'] ?? null);
        if ($challenge === '' || !consume_webauthn_challenge($challenge, 'register')) {
            fail(401, 'Invalid or expired challenge.', 'invalid_challenge');
        }

        if (class_exists('Webauthn\AttestationObject')) {
            try {
                $rpId = parse_url((string) env_value('APP_URL', 'http://localhost'), PHP_URL_HOST) ?: 'localhost';
                $origin = (string) env_value('APP_URL', 'http://' . $rpId);
                $attestation = \Webauthn\AttestationObject::createFromJSON(json_encode([
                    'attestationObject' => $attestationObject,
                    'clientDataJSON' => $clientDataJSON,
                ]));
                $options = \Webauthn\PublicKeyCredentialCreationOptions::create([
                    'rp' => ['name' => config('app_name'), 'id' => $rpId],
                    'user' => [
                        'id' => base64url_encode(pack('N*', (int) $user['id'])),
                        'name' => $user['email'],
                        'displayName' => $user['name'],
                    ],
                    'challenge' => base64url_decode($challenge),
                    'pubKeyCredParams' => [['type' => 'public-key', 'alg' => -7], ['type' => 'public-key', 'alg' => -257]],
                    'timeout' => 60000,
                    'attestation' => 'none',
                    'authenticatorSelection' => ['residentKey' => 'preferred', 'userVerification' => 'preferred'],
                ]);
                $credential = $attestation->verify($options, $origin);
                $publicKey = base64url_encode($credential->publicKey());
                $credentialId = base64url_encode($credential->id());
            } catch (\Throwable $error) {
                audit((int) $user['id'], 'auth.passkey_register_failed', ['error' => $error->getMessage()], $ctx['ip']);
                fail(401, 'Attestation verification failed.', 'attestation_failed');
            }
        } else {
            $publicKey = as_text($body['publicKey'] ?? null);
            if ($publicKey === '') {
                fail(400, 'Missing public key.', 'invalid_public_key');
            }
        }

        if (db_one('SELECT id FROM passkeys WHERE credential_id = ?', [$credentialId]) !== null) {
            fail(409, 'This passkey is already registered.', 'duplicate_credential');
        }
        db_insert(
            'INSERT INTO passkeys (user_id, credential_id, public_key, device_name, created_at) VALUES (?, ?, ?, ?, ?)',
            [(int) $user['id'], $credentialId, $publicKey, $deviceName, iso_to_sql(now_iso())],
        );
        audit((int) $user['id'], 'auth.passkey_registered', ['device' => $deviceName], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('GET', '/api/auth/passkeys', static function (array $ctx): void {
        $rows = db_all(
            'SELECT id, device_name, created_at, last_used_at FROM passkeys WHERE user_id = ? ORDER BY created_at DESC',
            [(int) $ctx['user']['id']],
        );
        send_json(200, ['passkeys' => $rows]);
    }, ['auth' => true]);

    $add('DELETE', '/api/auth/passkeys/:id', static function (array $ctx): void {
        $id = (int) $ctx['params']['id'];
        $row = db_one('SELECT id FROM passkeys WHERE id = ? AND user_id = ?', [$id, (int) $ctx['user']['id']]);
        if ($row === null) {
            fail(404, 'Passkey not found.', 'not_found');
        }
        db_exec('DELETE FROM passkeys WHERE id = ?', [$id]);
        audit((int) $ctx['user']['id'], 'auth.passkey_revoked', ['id' => $id], $ctx['ip']);
        send_json(200, ['ok' => true]);
    }, ['auth' => true]);

    $add('POST', '/api/auth/passkeys/login/options', static function (array $ctx): void {
        $body = $ctx['body'];
        $email = as_text($body['email'] ?? null);
        if ($email === '') {
            fail(400, 'Email is required.', 'email_required');
        }
        $row = db_one('SELECT id FROM users WHERE email = ?', [$email]);
        if ($row === null) {
            fail(404, 'No account with that email.', 'not_found');
        }
        $userId = (int) $row['id'];
        $rpId = parse_url((string) env_value('APP_URL', 'http://localhost'), PHP_URL_HOST) ?: 'localhost';
        $challenge = base64url_encode(random_bytes(32));
        store_webauthn_challenge($userId, $challenge, 'authenticate');

        $credentials = db_all(
            'SELECT credential_id, public_key FROM passkeys WHERE user_id = ?',
            [$userId],
        );
        $allowCredentials = [];
        foreach ($credentials as $c) {
            $allowCredentials[] = [
                'type' => 'public-key',
                'id' => base64url_decode($c['credential_id']),
            ];
        }

        $options = [
            'challenge' => $challenge,
            'rpId' => $rpId,
            'timeout' => 60000,
            'userVerification' => 'preferred',
            'allowCredentials' => $allowCredentials,
        ];
        if (class_exists('Webauthn\PublicKeyCredentialRequestOptions') && $allowCredentials !== []) {
            $wk = \Webauthn\PublicKeyCredentialRequestOptions::create($options);
            $options = json_decode($wk->jsonSerialize(), true);
        }
        send_json(200, $options);
    });

    $add('POST', '/api/auth/passkeys/login/verify', static function (array $ctx): void {
        $body = $ctx['body'];
        $clientDataJSON = as_text($body['response']['clientDataJSON'] ?? null);
        $authenticatorData = as_text($body['response']['authenticatorData'] ?? null);
        $signature = as_text($body['response']['signature'] ?? null);
        $userHandle = as_text($body['response']['userHandle'] ?? null);
        $credentialId = as_text($body['id'] ?? null);
        $challenge = as_text($body['challenge'] ?? null);
        if ($clientDataJSON === '' || $authenticatorData === '' || $signature === '' || $credentialId === '' || $challenge === '') {
            fail(400, 'Missing assertion data.', 'invalid_assertion');
        }
        if (!consume_webauthn_challenge($challenge, 'authenticate')) {
            fail(401, 'Invalid or expired challenge.', 'invalid_challenge');
        }

        $row = db_one('SELECT * FROM passkeys WHERE credential_id = ?', [$credentialId]);
        if ($row === null) {
            fail(401, 'Unknown credential.', 'unknown_credential');
        }
        $user = db_one('SELECT * FROM users WHERE id = ?', [(int) $row['user_id']]);
        if ($user === null) {
            fail(401, 'Credential owner not found.', 'not_found');
        }

        if (class_exists('Webauthn\AuthenticatorAssertionResponse')) {
            try {
                $rpId = parse_url((string) env_value('APP_URL', 'http://localhost'), PHP_URL_HOST) ?: 'localhost';
                $origin = (string) env_value('APP_URL', 'http://' . $rpId);
                $assertion = \Webauthn\AuthenticatorAssertionResponse::createFromJSON(json_encode([
                    'clientDataJSON' => $clientDataJSON,
                    'authenticatorData' => $authenticatorData,
                    'signature' => $signature,
                    'userHandle' => $userHandle,
                ]));
                $options = \Webauthn\PublicKeyCredentialRequestOptions::create([
                    'challenge' => base64url_decode($challenge),
                    'rpId' => $rpId,
                    'timeout' => 60000,
                    'userVerification' => 'preferred',
                ]);
                $assertion->verify($options, $origin, base64url_decode($row['public_key']));
                db_exec('UPDATE passkeys SET last_used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $row['id']]);
            } catch (\Throwable $error) {
                audit((int) $user['id'], 'auth.passkey_login_failed', ['error' => $error->getMessage()], $ctx['ip']);
                fail(401, 'Assertion verification failed.', 'assertion_failed');
            }
        } else {
            db_exec('UPDATE passkeys SET last_used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $row['id']]);
        }

        $now = now_iso();
        db_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [iso_to_sql($now), (int) $user['id']]);
        $user['last_login_at'] = iso_to_sql($now);
        $publicUser = public_user($user);
        $csrf = create_session($publicUser, $ctx['ip']);
        audit((int) $user['id'], 'auth.login', [], $ctx['ip']);
        send_json(200, ['user' => $publicUser, 'csrf' => $csrf]);
    });

    $add('GET', '/api/my/votes', static function (array $ctx): void {
        $rows = db_all(
            'SELECT e.*, p.voted_at
             FROM participation p
             JOIN elections e ON e.id = p.election_id
             WHERE p.voter_id = ?
             ORDER BY p.voted_at DESC',
            [(int) $ctx['user']['id']],
        );
        $ballots = [];
        foreach ($rows as $row) {
            $ballots[] = [
                'electionId' => (int) $row['id'],
                'title' => $row['title'],
                'status' => effective_status($row),
                'votedAt' => sql_to_iso($row['voted_at']),
            ];
        }
        send_json(200, ['ballots' => $ballots]);
    }, ['auth' => true]);

    /* -------------------------------------------------------------- */
    /* Admin                                                           */
    /* -------------------------------------------------------------- */

    $admin = static function (string $method, string $pattern, callable $handler) use ($add): void {
        $add($method, $pattern, $handler, ['auth' => true, 'admin' => true]);
    };

    $admin('GET', '/api/admin/stats/history', static function (array $ctx): void {
        $days = (int) ($ctx['query']['days'] ?? 7);
        $days = in_array($days, [7, 30, 90], true) ? $days : 7;
        $rows = db_all(
            'SELECT DATE(voted_at) AS day, COUNT(*) AS votes
             FROM participation WHERE voted_at > ? GROUP BY DATE(voted_at) ORDER BY day ASC',
            [iso_to_sql(now_iso_at(time() - $days * 86400))],
        );
        $series = [];
        foreach ($rows as $r) {
            $series[] = ['day' => (string) $r['day'], 'votes' => (int) $r['votes']];
        }
        send_json(200, ['days' => $days, 'series' => $series]);
    });

    $admin('GET', '/api/admin/overview', static function (array $ctx): void {
        $scope = viewer_scope($ctx['user']);
        $where = $scope > 0 ? ' WHERE organization_id = ?' : '';
        $params = $scope > 0 ? [$scope] : [];
        $users = (int) db_scalar('SELECT COUNT(*) FROM users' . $where, $params);
        $activeUsers = (int) db_scalar('SELECT COUNT(*) FROM users WHERE active = 1' . ($scope > 0 ? ' AND organization_id = ?' : ''), $params);
        $admins = (int) db_scalar("SELECT COUNT(*) FROM users WHERE role IN ('admin','org_admin') AND active = 1" . ($scope > 0 ? ' AND organization_id = ?' : ''), $params);
        $elections = db_all('SELECT * FROM elections' . $where, $params);

        $statusCounts = ['draft' => 0, 'scheduled' => 0, 'open' => 0, 'closed' => 0];
        foreach ($elections as $election) {
            $statusCounts[effective_status($election)] += 1;
        }

        $startOfDay = (new DateTimeImmutable('today', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.v');
        $ballotsToday = (int) db_scalar(
            'SELECT COUNT(*) FROM participation p JOIN elections e ON e.id = p.election_id WHERE p.voted_at >= ?'
            . ($scope > 0 ? ' AND e.organization_id = ?' : ''),
            $scope > 0 ? [$startOfDay, $scope] : [$startOfDay],
        );

        $activeElections = [];
        foreach ($elections as $election) {
            $status = effective_status($election);
            if (in_array($status, ['open', 'scheduled'], true)) {
                $activeElections[] = serialize_election($election, ['id' => 0, 'role' => 'admin']);
            }
        }
        usort($activeElections, static function (array $a, array $b): int {
            return ($a['status'] === 'open' ? 0 : 1) <=> ($b['status'] === 'open' ? 0 : 1);
        });

        $recentRows = db_all(
            'SELECT a.id, a.action, a.details, a.ip, a.created_at, u.name AS actor_name
             FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
             ' . ($scope > 0 ? 'WHERE u.organization_id = ? ' : '') . '
             ORDER BY a.id DESC LIMIT 8',
            $scope > 0 ? [$scope] : [],
        );
        $recentActivity = array_map(static function (array $row): array {
            $row['id'] = (int) $row['id'];
            $row['details'] = safe_json($row['details']);
            $row['created_at'] = sql_to_iso($row['created_at']);
            return $row;
        }, $recentRows);

        send_json(200, [
            'users' => ['total' => $users, 'active' => $activeUsers, 'admins' => $admins],
            'elections' => array_merge(['total' => count($elections)], $statusCounts),
            'ballots' => [
                'total' => (int) db_scalar(
                    'SELECT COUNT(*) FROM votes v JOIN elections e ON e.id = v.election_id'
                    . ($scope > 0 ? ' WHERE e.organization_id = ?' : ''),
                    $params,
                ),
                'today' => $ballotsToday,
            ],
            'activeElections' => $activeElections,
            'recentActivity' => $recentActivity,
        ]);
    });

    $admin('GET', '/api/admin/elections', static function (array $ctx): void {
        $scope = viewer_scope($ctx['user']);
        $rows = db_all(
            "SELECT * FROM elections
             " . ($scope > 0 ? 'WHERE organization_id = ? ' : '') . "
             ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, created_at DESC",
            $scope > 0 ? [$scope] : [],
        );
        $elections = array_map(
            static fn (array $row): array => serialize_election($row, ['id' => 0, 'role' => 'admin']),
            $rows,
        );
        send_json(200, ['elections' => $elections]);
    });

    $admin('POST', '/api/admin/elections', static function (array $ctx): void {
        $body = $ctx['body'];
        $title = require_text($body['title'] ?? null, 3, 120, 'Title');
        $description = optional_text($body['description'] ?? null, 2000, 'Description');
        $resultsVisibility = array_key_exists('resultsVisibility', $body)
            ? one_of($body['resultsVisibility'], ['always', 'after_vote', 'after_close', 'hidden'])
            : 'after_close';
        $opensAt = array_key_exists('opensAt', $body) ? parse_date($body['opensAt'], 'Opening time') : null;
        $closesAt = array_key_exists('closesAt', $body) ? parse_date($body['closesAt'], 'Closing time') : null;
        $maxChoices = array_key_exists('maxChoices', $body) ? max(1, (int) $body['maxChoices']) : 1;
        if ($opensAt !== null && $closesAt !== null && strtotime($closesAt) <= strtotime($opensAt)) {
            fail(400, 'Closing time must be after opening time.', 'invalid_date');
        }

        $now = now_iso();
        $id = db_insert(
            'INSERT INTO elections
               (title, description, status, results_visibility, max_choices, ballot_type, brand_color, logo_url, opens_at, closes_at, created_by, organization_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $title,
                $description,
                'draft',
                $resultsVisibility,
                $maxChoices,
                in_array($ctx['body']['ballotType'] ?? 'single', ['single', 'ranked'], true) ? ($ctx['body']['ballotType'] ?? 'single') : 'single',
                as_text($ctx['body']['brandColor'] ?? null) ?: null,
                as_text($ctx['body']['logoUrl'] ?? null) ?: null,
                iso_to_sql($opensAt),
                iso_to_sql($closesAt),
                (int) $ctx['user']['id'],
                user_organization_id($ctx['user']),
                iso_to_sql($now),
                iso_to_sql($now),
            ],
        );

        $row = get_election($id);
        audit((int) $ctx['user']['id'], 'election.create', ['electionId' => $id, 'title' => $title], $ctx['ip']);
        send_json(201, ['election' => serialize_election($row, ['id' => (int) $ctx['user']['id'], 'role' => 'admin'])]);
    });

    // Clone an existing election (settings + candidates) as a new draft.
    $admin('POST', '/api/admin/elections/from-template/:id', static function (array $ctx): void {
        $source = get_election($ctx['params']['id']);
        if ($source === null) {
            fail(404, 'Template election not found.', 'not_found');
        }
        $body = $ctx['body'];
        $title = require_text($body['title'] ?? null, 3, 120, 'Title') ?: ($source['title'] . ' (copy)');
        $now = now_iso();
        $newId = db_insert(
            'INSERT INTO elections
               (title, description, status, results_visibility, max_choices, opens_at, closes_at, created_by, organization_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $title,
                $source['description'],
                'draft',
                $source['results_visibility'],
                $source['max_choices'],
                $source['opens_at'],
                $source['closes_at'],
                (int) $ctx['user']['id'],
                user_organization_id($ctx['user']),
                iso_to_sql($now),
                iso_to_sql($now),
            ],
        );
        $candidates = db_all('SELECT name, party, bio FROM candidates WHERE election_id = ? ORDER BY id', [(int) $source['id']]);
        foreach ($candidates as $c) {
            db_insert(
                'INSERT INTO candidates (election_id, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?)',
                [$newId, $c['name'], $c['party'], $c['bio'], iso_to_sql($now)],
            );
        }
        audit((int) $ctx['user']['id'], 'election.clone', ['from' => (int) $source['id'], 'to' => $newId], $ctx['ip']);
        send_json(201, ['election' => get_election($newId), 'candidatesCloned' => count($candidates)]);
    });

    // Bulk-import candidates from CSV: a header row + name,party,bio columns.
    $admin('POST', '/api/admin/elections/:id/candidates/import', static function (array $ctx): void {
        $election = get_election($ctx['params']['id']);
        if ($election === null) {
            fail(404, 'Election not found.', 'not_found');
        }
        if ($election['status'] !== 'draft') {
            fail(409, 'Candidates can only be imported into a draft election.', 'election_locked');
        }
        $csv = as_text($ctx['body']['csv'] ?? null);
        if ($csv === '') {
            fail(400, 'CSV content is required.', 'csv_required');
        }
        $lines = preg_split('/\r?\n/', $csv) ?: [];
        $imported = 0;
        $now = iso_to_sql(now_iso());
        foreach ($lines as $index => $line) {
            if (trim($line) === '') {
                continue;
            }
            $cols = str_getcsv($line);
            if ($index === 0 && strtolower(trim($cols[0] ?? '')) === 'name') {
                continue; // header
            }
            $name = trim((string) ($cols[0] ?? ''));
            if ($name === '') {
                continue;
            }
            db_insert(
                'INSERT INTO candidates (election_id, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?)',
                [(int) $election['id'], mb_substr($name, 0, 80), mb_substr(trim((string) ($cols[1] ?? '')), 0, 60), mb_substr(trim((string) ($cols[2] ?? '')), 0, 300), $now],
            );
            $imported += 1;
        }
        audit((int) $ctx['user']['id'], 'election.candidates_imported', ['electionId' => (int) $election['id'], 'count' => $imported], $ctx['ip']);
        send_json(200, ['imported' => $imported]);
    });

    $admin('PATCH', '/api/admin/elections/:id', static function (array $ctx): void {
        $row = get_election($ctx['params']['id']);
        if ($row === null) {
            fail(404, 'That election could not be found.', 'not_found');
        }

        $body = $ctx['body'];
        $has = static fn (string $key): bool => array_key_exists($key, $body);
        $next = [
            'title' => $has('title') ? require_text($body['title'], 3, 120, 'Title') : $row['title'],
            'description' => $has('description') ? optional_text($body['description'], 2000, 'Description') : $row['description'],
            'resultsVisibility' => $has('resultsVisibility')
                ? one_of($body['resultsVisibility'], ['always', 'after_vote', 'after_close', 'hidden'])
                : $row['results_visibility'],
            'maxChoices' => $has('maxChoices') ? max(1, (int) $body['maxChoices']) : (int) $row['max_choices'],
            'ballotType' => $has('ballotType') && in_array($body['ballotType'], ['single', 'ranked'], true) ? $body['ballotType'] : (string) ($row['ballot_type'] ?? 'single'),
            'brandColor' => $has('brandColor') ? (as_text($body['brandColor']) ?: null) : ($row['brand_color'] ?? null),
            'logoUrl' => $has('logoUrl') ? (as_text($body['logoUrl']) ?: null) : ($row['logo_url'] ?? null),
            'opensAt' => $has('opensAt') ? parse_date($body['opensAt'], 'Opening time') : sql_to_iso($row['opens_at']),
            'closesAt' => $has('closesAt') ? parse_date($body['closesAt'], 'Closing time') : sql_to_iso($row['closes_at']),
            'status' => $row['status'],
        ];

        if ($next['opensAt'] !== null && $next['closesAt'] !== null && strtotime($next['closesAt']) <= strtotime($next['opensAt'])) {
            fail(400, 'Closing time must be after opening time.', 'invalid_date');
        }

        if ($has('status')) {
            $next['status'] = one_of($body['status'], ['draft', 'open', 'closed']);
            if ($next['status'] === 'open' && count_candidates((int) $row['id']) < 2) {
                fail(400, 'Add at least two candidates before opening voting.', 'not_enough_candidates');
            }
            if ($next['status'] === 'draft' && count_votes((int) $row['id']) > 0) {
                fail(409, 'Elections that already contain ballots cannot return to draft.', 'has_ballots');
            }
        }

        $now = now_iso();
        db_exec(
            'UPDATE elections
             SET title = ?, description = ?, results_visibility = ?, max_choices = ?,
                 ballot_type = ?, brand_color = ?, logo_url = ?,
                 opens_at = ?, closes_at = ?, status = ?, updated_at = ?
             WHERE id = ?',
            [
                $next['title'],
                $next['description'],
                $next['resultsVisibility'],
                $next['maxChoices'],
                $next['ballotType'],
                $next['brandColor'],
                $next['logoUrl'],
                iso_to_sql($next['opensAt']),
                iso_to_sql($next['closesAt']),
                $next['status'],
                iso_to_sql($now),
                (int) $row['id'],
            ],
        );

        $before = [
            'title' => $row['title'],
            'description' => $row['description'],
            'resultsVisibility' => $row['results_visibility'],
            'opensAt' => sql_to_iso($row['opens_at']),
            'closesAt' => sql_to_iso($row['closes_at']),
            'status' => $row['status'],
        ];
        $changed = [];
        foreach ($next as $key => $value) {
            if ($before[$key] !== $value) {
                $changed[] = $key;
            }
        }

        audit((int) $ctx['user']['id'], 'election.update', ['electionId' => (int) $row['id'], 'changed' => $changed], $ctx['ip']);
        $updated = get_election((int) $row['id']);
        send_json(200, ['election' => serialize_election($updated, ['id' => (int) $ctx['user']['id'], 'role' => 'admin'])]);
    });

    $admin('DELETE', '/api/admin/elections/:id', static function (array $ctx): void {
        $row = get_election($ctx['params']['id']);
        if ($row === null) {
            fail(404, 'That election could not be found.', 'not_found');
        }
        if (count_votes((int) $row['id']) > 0) {
            fail(409, 'Elections with cast ballots cannot be deleted.', 'has_ballots');
        }
        db_exec('DELETE FROM elections WHERE id = ?', [(int) $row['id']]);
        audit((int) $ctx['user']['id'], 'election.delete', ['electionId' => (int) $row['id'], 'title' => $row['title']], $ctx['ip']);
        send_json(200, ['ok' => true]);
    });

    $admin('GET', '/api/admin/elections/:id/results', static function (array $ctx): void {
        $row = get_election($ctx['params']['id']);
        if ($row === null) {
            fail(404, 'That election could not be found.', 'not_found');
        }

        $results = election_results((int) $row['id']);
        $cfg = config('db');
        $isPg = ($cfg['driver'] ?? 'mysql') === 'pgsql';
        $bucketExpr = $isPg
            ? "to_char(voted_at, 'YYYY-MM-DD\"T\"HH24:00:00.000\"Z\"')"
            : "DATE_FORMAT(voted_at, '%Y-%m-%dT%H:00:00.000Z')";
        $timeline = db_all(
            "SELECT $bucketExpr AS bucket, COUNT(*) AS votes
             FROM participation WHERE election_id = ?
             GROUP BY bucket ORDER BY bucket ASC",
            [(int) $row['id']],
        );
        foreach ($timeline as &$point) {
            $point['votes'] = (int) $point['votes'];
        }
        unset($point);

        $bounds = db_one(
            'SELECT MIN(voted_at) AS firstVote, MAX(voted_at) AS lastVote FROM participation WHERE election_id = ?',
            [(int) $row['id']],
        );

        send_json(200, [
            'election' => serialize_election($row, ['id' => 0, 'role' => 'admin']),
            'results' => $results,
            'timeline' => $timeline,
            'firstVoteAt' => $bounds === null ? null : sql_to_iso($bounds['firstVote']),
            'lastVoteAt' => $bounds === null ? null : sql_to_iso($bounds['lastVote']),
            'registeredVoters' => count_active_users(),
        ]);
    });

    $admin('POST', '/api/admin/elections/:id/candidates', static function (array $ctx): void {
        $row = get_election($ctx['params']['id']);
        if ($row === null) {
            fail(404, 'That election could not be found.', 'not_found');
        }
        if ($row['status'] === 'closed') {
            fail(409, 'This election is closed.', 'closed');
        }
        if (count_votes((int) $row['id']) > 0) {
            fail(409, 'Candidates cannot be added after ballots have been cast.', 'has_ballots');
        }

        $body = $ctx['body'];
        $name = require_text($body['name'] ?? null, 1, 80, 'Candidate name');
        $party = optional_text($body['party'] ?? null, 60, 'Party or affiliation');
        $bio = optional_text($body['bio'] ?? null, 300, 'Short description');
        $id = db_insert(
            'INSERT INTO candidates (election_id, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?)',
            [(int) $row['id'], $name, $party, $bio, iso_to_sql(now_iso())],
        );
        audit((int) $ctx['user']['id'], 'candidate.create', [
            'electionId' => (int) $row['id'],
            'candidateId' => $id,
            'name' => $name,
        ], $ctx['ip']);
        send_json(201, ['candidate' => ['id' => $id, 'name' => $name, 'party' => $party, 'bio' => $bio]]);
    });

    $admin('PATCH', '/api/admin/candidates/:id', static function (array $ctx): void {
        $candidate = db_one('SELECT * FROM candidates WHERE id = ?', [to_int($ctx['params']['id']) ?? 0]);
        if ($candidate === null) {
            fail(404, 'That candidate could not be found.', 'not_found');
        }
        $election = get_election((int) $candidate['election_id']);
        if ($election === null) {
            fail(404, 'That election could not be found.', 'not_found');
        }
        if ($election['status'] === 'closed') {
            fail(409, 'This election is closed.', 'closed');
        }
        if (count_votes((int) $election['id']) > 0) {
            fail(409, 'Candidates cannot be edited after ballots have been cast.', 'has_ballots');
        }

        $body = $ctx['body'];
        $has = static fn (string $key): bool => array_key_exists($key, $body);
        $name = $has('name') ? require_text($body['name'], 1, 80, 'Candidate name') : $candidate['name'];
        $party = $has('party') ? optional_text($body['party'], 60, 'Party or affiliation') : $candidate['party'];
        $bio = $has('bio') ? optional_text($body['bio'], 300, 'Short description') : $candidate['bio'];
        db_exec('UPDATE candidates SET name = ?, party = ?, bio = ? WHERE id = ?', [$name, $party, $bio, (int) $candidate['id']]);
        audit((int) $ctx['user']['id'], 'candidate.update', [
            'electionId' => (int) $election['id'],
            'candidateId' => (int) $candidate['id'],
            'name' => $name,
        ], $ctx['ip']);
        send_json(200, ['candidate' => ['id' => (int) $candidate['id'], 'name' => $name, 'party' => $party, 'bio' => $bio]]);
    });

    $admin('DELETE', '/api/admin/candidates/:id', static function (array $ctx): void {
        $candidate = db_one('SELECT * FROM candidates WHERE id = ?', [to_int($ctx['params']['id']) ?? 0]);
        if ($candidate === null) {
            fail(404, 'That candidate could not be found.', 'not_found');
        }
        $election = get_election((int) $candidate['election_id']);
        if ($election === null) {
            fail(404, 'That election could not be found.', 'not_found');
        }
        if (count_votes((int) $election['id']) > 0) {
            fail(409, 'Candidates cannot be removed after ballots have been cast.', 'has_ballots');
        }
        db_exec('DELETE FROM candidates WHERE id = ?', [(int) $candidate['id']]);
        audit((int) $ctx['user']['id'], 'candidate.delete', [
            'electionId' => (int) $election['id'],
            'candidateId' => (int) $candidate['id'],
            'name' => $candidate['name'],
        ], $ctx['ip']);
        send_json(200, ['ok' => true]);
    });

    $admin('GET', '/api/admin/users', static function (array $ctx): void {
        $search = mb_substr(trim((string) query_value($ctx['query'], 'q', '')), 0, 80);
        $scope = viewer_scope($ctx['user']);
        $orgCond = $scope > 0 ? 'organization_id = ? AND ' : '';
        $scopeParams = $scope > 0 ? [$scope] : [];
        if ($search !== '') {
            $pattern = '%' . $search . '%';
            $rows = db_all(
                'SELECT * FROM users WHERE ' . $orgCond . '(name LIKE ? OR email LIKE ?) ORDER BY created_at DESC LIMIT 200',
                array_merge($scopeParams, [$pattern, $pattern]),
            );
        } else {
            $rows = db_all(
                'SELECT * FROM users WHERE ' . $orgCond . '1 = 1 ORDER BY created_at DESC LIMIT 200',
                $scopeParams,
            );
        }

        $electionIds = array_map(static fn (array $row): int => (int) $row['id'], db_all('SELECT id FROM elections'));
        $users = [];
        foreach ($rows as $row) {
            $count = 0;
            foreach ($electionIds as $electionId) {
                if (has_voted($electionId, (int) $row['id'])) {
                    $count += 1;
                }
            }
            $users[] = array_merge(public_user($row), ['ballotsCast' => $count]);
        }

        send_json(200, ['users' => $users]);
    });

    $admin('POST', '/api/admin/users', static function (array $ctx): void {
        $body = $ctx['body'];
        $name = require_text($body['name'] ?? null, 2, 80, 'Full name');
        $email = normalize_email($body['email'] ?? null);
        $password = validate_password($body['password'] ?? null);
        $scope = org_scope($ctx['user']);
        $allowedRoles = $scope > 0 ? ['voter', 'observer', 'org_admin'] : ['voter', 'admin', 'observer', 'org_admin'];
        $role = array_key_exists('role', $body) ? one_of($body['role'], $allowedRoles) : 'voter';
        if (db_one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            fail(409, 'An account with that email already exists.', 'email_taken');
        }
        $now = now_iso();
        $id = db_insert(
            'INSERT INTO users (name, email, password_hash, role, active, organization_id, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
            [$name, $email, hash_password($password), $role, $scope > 0 ? $scope : null, iso_to_sql($now)],
        );
        $created = db_one('SELECT * FROM users WHERE id = ?', [$id]);
        audit((int) $ctx['user']['id'], 'user.create', ['userId' => $id, 'email' => $email, 'role' => $role], $ctx['ip']);
        send_json(201, ['user' => public_user($created)]);
    });

    $admin('POST', '/api/admin/users/import', static function (array $ctx): void {
        $body = $ctx['body'];
        $csv = as_text($body['csv'] ?? null);
        $lines = preg_split('/\r\n|\r|\n/', $csv) ?: [];
        $created = 0;
        $skipped = 0;
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            $parts = str_getcsv($line);
            if (count($parts) < 2) {
                continue;
            }
            $name = trim((string) $parts[0]);
            $email = strtolower(trim((string) $parts[1]));
            $password = isset($parts[2]) && trim((string) $parts[2]) !== '' ? trim((string) $parts[2]) : random_token(12);
            if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $skipped++;
                continue;
            }
            if (db_one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
                $skipped++;
                continue;
            }
            try {
                validate_password($password);
            } catch (Throwable) {
                $password = random_token(12) . 'A1!';
            }
            $scope = org_scope($ctx['user']);
            $id = db_insert(
                "INSERT INTO users (name, email, password_hash, role, active, organization_id, created_at) VALUES (?, ?, ?, 'voter', 1, ?, ?)",
                [$name, $email, hash_password($password), $scope > 0 ? $scope : null, iso_to_sql(now_iso())],
            );
            $created++;
            audit((int) $ctx['user']['id'], 'user.import', ['userId' => $id, 'email' => $email], $ctx['ip']);
        }
        send_json(200, ['created' => $created, 'skipped' => $skipped]);
    });

    $admin('PATCH', '/api/admin/users/:id', static function (array $ctx): void {
        $target = db_one('SELECT * FROM users WHERE id = ?', [to_int($ctx['params']['id']) ?? 0]);
        if ($target === null) {
            fail(404, 'That user could not be found.', 'not_found');
        }

        $body = $ctx['body'];
        $has = static fn (string $key): bool => array_key_exists($key, $body);
        $scope = org_scope($ctx['user']);
        $allowedRoles = $scope > 0 ? ['voter', 'observer', 'org_admin'] : ['voter', 'admin', 'observer', 'org_admin'];
        $role = $has('role') ? one_of($body['role'], $allowedRoles) : $target['role'];
        $active = $has('active') ? (js_bool($body['active']) ? 1 : 0) : (int) $target['active'];

        if ((int) $target['id'] === (int) $ctx['user']['id']) {
            if ($role !== $target['role']) {
                fail(400, 'You cannot change your own role.', 'self_edit');
            }
            if ($active !== (int) $target['active']) {
                fail(400, 'You cannot deactivate your own account.', 'self_edit');
            }
        }

        $activeAdmins = (int) db_scalar("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1");
        $demoting = $target['role'] === 'admin' && ($role !== 'admin' || $active === 0);
        if ($demoting && $activeAdmins <= 1) {
            fail(409, 'At least one active administrator is required.', 'last_admin');
        }

        db_exec('UPDATE users SET role = ?, active = ? WHERE id = ?', [$role, $active, (int) $target['id']]);
        if ($active === 0) {
            db_exec('DELETE FROM sessions WHERE user_id = ?', [(int) $target['id']]);
        }
        audit((int) $ctx['user']['id'], 'user.update', [
            'userId' => (int) $target['id'],
            'role' => $role,
            'active' => $active === 1,
        ], $ctx['ip']);
        $updated = db_one('SELECT * FROM users WHERE id = ?', [(int) $target['id']]);
        send_json(200, ['user' => public_user($updated)]);
    });

    $admin('GET', '/api/admin/audit', static function (array $ctx): void {
        $limit = min(max((int) (query_value($ctx['query'], 'limit', '100') ?? 100), 1), 200);
        $offset = max((int) (query_value($ctx['query'], 'offset', '0') ?? 0), 0);
        $filter = mb_substr(trim((string) query_value($ctx['query'], 'action', '')), 0, 60);
        $prefix = $filter !== '' ? $filter . '%' : '%';

        $scope = viewer_scope($ctx['user']);
        $scopeCond = $scope > 0 ? ' AND u.organization_id = ?' : '';
        $scopeParams = $scope > 0 ? [$scope] : [];
        $rows = db_all(
            'SELECT a.id, a.action, a.details, a.ip, a.created_at, u.name AS actor_name
             FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
             WHERE a.action LIKE ?' . $scopeCond . '
             ORDER BY a.id DESC LIMIT ' . $limit . ' OFFSET ' . $offset,
            array_merge([$prefix], $scopeParams),
        );
        $total = (int) db_scalar(
            'SELECT COUNT(*) FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id WHERE a.action LIKE ?' . $scopeCond,
            array_merge([$prefix], $scopeParams),
        );

        $entries = array_map(static function (array $row): array {
            $row['id'] = (int) $row['id'];
            $row['details'] = safe_json($row['details']);
            $row['created_at'] = sql_to_iso($row['created_at']);
            return $row;
        }, $rows);

        send_json(200, ['total' => $total, 'entries' => $entries]);
    });

    /* -------------------------------------------------------------- */
    /* Data access & deletion (GDPR-style rights)                     */
    /* -------------------------------------------------------------- */

    $add('GET', '/api/data-request', static function (array $ctx): void {
        $user = $ctx['user'];
        if ($user === null) {
            fail(401, 'Sign in to request your data.', 'auth_required');
        }
        $id = (int) $user['id'];
        $profile = db_one('SELECT id, name, email, role, active, student_id, recovery_email, phone, organization_id, created_at, last_login_at, digest_optin, mfa_enabled FROM users WHERE id = ?', [$id]);
        $elections = db_all('SELECT id, title, status, created_at FROM elections WHERE created_by = ? ORDER BY created_at DESC', [$id]);
        $participation = db_all('SELECT p.election_id, e.title, p.voted_at FROM participation p JOIN elections e ON e.id = p.election_id WHERE p.voter_id = ? ORDER BY p.voted_at DESC', [$id]);
        $sessions = db_all('SELECT id, created_at, expires_at, ip, user_agent FROM sessions WHERE user_id = ? ORDER BY created_at DESC', [$id]);
        $notifications = db_all('SELECT id, type, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [$id]);
        send_json(200, [
            'exportedAt' => now_iso(),
            'profile' => $profile,
            'elections' => $elections,
            'participation' => $participation,
            'sessions' => $sessions,
            'notifications' => $notifications,
        ]);
    }, ['auth' => true]);

    $add('DELETE', '/api/data-request', static function (array $ctx): void {
        $user = $ctx['user'];
        if ($user === null) {
            fail(401, 'Sign in to request data deletion.', 'auth_required');
        }
        $body = $ctx['body'];
        $confirm = as_text($body['confirm'] ?? '');
        if ($confirm !== 'DELETE MY DATA') {
            fail(400, 'Type "DELETE MY DATA" to confirm permanent deletion.', 'confirmation_required');
        }
        $password = as_text($body['password'] ?? null);
        $row = db_one('SELECT password_hash FROM users WHERE id = ?', [(int) $user['id']]);
        if ($row === null || !verify_password($password, (string) $row['password_hash'])) {
            fail(401, 'Password is required to confirm deletion.', 'invalid_password');
        }
        $id = (int) $user['id'];
        db_transaction(static function () use ($id): void {
            db_exec('DELETE FROM notifications WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM sessions WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM phone_verifications WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM backup_codes WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM mfa_challenges WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM webauthn_challenges WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM trusted_devices WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM api_keys WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM election_templates WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM organization_invites WHERE organization_id IN (SELECT id FROM organizations WHERE created_by = ?)', [$id]);
            db_exec('DELETE FROM poll_subscriptions WHERE user_id = ?', [$id]);
            db_exec('DELETE FROM participation WHERE voter_id = ?', [$id]);
            db_exec('UPDATE users SET name = ?, email = ?, password_hash = NULL, recovery_email = NULL, phone = NULL, organization_id = NULL, active = 0, email_verified_at = NULL, mfa_secret = NULL, mfa_enabled = 0, digest_optin = 0 WHERE id = ?', ['Deleted User', 'deleted_' . $id . '@openballot.invalid', null, $id]);
        });
        clear_cookie((string) config('session_cookie'));
        audit($id, 'auth.data_deleted', [], $_SERVER['REMOTE_ADDR'] ?? null);
        send_json(200, ['ok' => true, 'message' => 'Your account data has been deleted.']);
    }, ['auth' => true]);

    /* -------------------------------------------------------------- */
    /* Marketing unsubscribe                                          */
    /* -------------------------------------------------------------- */

    $add('POST', '/api/unsubscribe', static function (array $ctx): void {
        $user = $ctx['user'];
        $email = null;
        if ($user !== null) {
            $email = (string) ($user['email'] ?? '');
        } else {
            $email = strtolower(trim(as_text($ctx['body']['email'] ?? null)));
            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                fail(400, 'A valid email address is required.', 'invalid_email');
            }
        }
        db_exec('UPDATE users SET digest_optin = 0 WHERE email = ?', [$email]);
        audit(null, 'security.unsubscribe', ['email' => $email], $_SERVER['REMOTE_ADDR'] ?? null);
        send_json(200, ['ok' => true, 'message' => 'You have been unsubscribed from marketing and digest emails.']);
    });

    $add('GET', '/api/unsubscribe/:token', static function (array $ctx): void {
        $token = (string) $ctx['params']['token'];
        $hash = sha256($token);
        $row = db_one('SELECT u.id, u.email FROM users u JOIN password_resets pr ON pr.user_id = u.id WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > ?', [$hash, iso_to_sql(now_iso())]);
        if ($row === null) {
            fail(404, 'Unsubscribe link is invalid or has expired.', 'not_found');
        }
        db_exec('UPDATE users SET digest_optin = 0 WHERE id = ?', [(int) $row['id']]);
        db_exec('UPDATE password_resets SET used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $row['id']]);
        send_json(200, ['ok' => true, 'message' => 'You have been unsubscribed from digest emails.']);
    });

    return $routes;
}

/**
 * Dispatch an /api request. Assumes security headers are already sent.
 */
function handle_api(string $pathname, string $method, string $version = 'v0'): void
{
    apply_scheduled_election_statuses();
    header('X-API-Version: ' . $version);
    $ip = client_ip();
    $session = get_session();
    $user = $session['user'] ?? null;

    $matches = [];
    foreach (api_routes() as $candidate) {
        if (preg_match($candidate['regex'], $pathname) === 1) {
            $matches[] = $candidate;
        }
    }

    $match = null;
    foreach ($matches as $candidate) {
        if ($candidate['method'] === $method) {
            $match = $candidate;
            break;
        }
    }

    if ($match === null) {
        if ($matches !== []) {
            $allowed = array_values(array_unique(array_map(
                static fn (array $candidate): string => $candidate['method'],
                $matches,
            )));
            header('Allow: ' . implode(', ', $allowed));
            send_json(405, error_envelope(405, 'Method not allowed.', 'method_not_allowed'));
        } else {
            send_json(404, error_envelope(404, 'Not found.', 'not_found'));
        }
        return;
    }

    $params = [];
    preg_match($match['regex'], $pathname, $values);
    array_shift($values);
    foreach ($match['names'] as $index => $name) {
        $params[$name] = rawurldecode($values[$index] ?? '');
    }

    try {
        $options = $match['options'];
        if (!empty($options['admin']) && !is_admin_user($user)) {
            if ($user === null) {
                throw new HttpError(401, 'Sign in to continue.', 'auth_required');
            }
            // Observers may read election state, results, schema and audit — never mutate.
            $observerRead = $method === 'GET' && ($user['role'] ?? '') === 'observer'
                && preg_match('#^/api/admin/(overview|elections|audit|schema)(/.*)?$#', $pathname) === 1
                && !str_contains($pathname, '/results/signed');
            if (!$observerRead) {
                throw new HttpError(403, 'Administrator access required.', 'forbidden');
            }
        }
        // Organization administrators get a scoped subset of the admin API.
        if (is_org_admin($user) && str_starts_with($pathname, '/api/admin/')) {
            $allowed = preg_match('#^/api/admin/(overview|elections|users|audit|schema)(/.*)?$#', $pathname) === 1;
            if (!$allowed) {
                throw new HttpError(403, 'Platform administrator access required.', 'forbidden');
            }
            if (preg_match('#^/api/admin/elections/(\d+)(/|$)#', $pathname, $mm) === 1) {
                $election = get_election($mm[1]);
                if ($election === null || !can_manage_election($election, $user)) {
                    throw new HttpError(404, 'Election not found.', 'not_found');
                }
            }
            if (preg_match('#^/api/admin/candidates/(\d+)(/|$)#', $pathname, $mm) === 1) {
                $cand = db_one('SELECT e.organization_id AS organization_id FROM candidates c JOIN elections e ON e.id = c.election_id WHERE c.id = ?', [(int) $mm[1]]);
                if ($cand === null || (int) $cand['organization_id'] !== org_scope($user)) {
                    throw new HttpError(404, 'Candidate not found.', 'not_found');
                }
            }
            if (preg_match('#^/api/admin/users/(\d+)(/|$)#', $pathname, $mm) === 1) {
                $member = db_one('SELECT organization_id FROM users WHERE id = ?', [(int) $mm[1]]);
                if ($member === null || (int) $member['organization_id'] !== org_scope($user)) {
                    throw new HttpError(404, 'User not found.', 'not_found');
                }
            }
        }
        if (!empty($options['auth']) && $user === null) {
            throw new HttpError(401, 'Sign in to continue.', 'auth_required');
        }

        $mutating = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        if ($mutating) {
            $exempt = $pathname === '/api/auth/login' || $pathname === '/api/auth/admin/login' || $pathname === '/api/auth/register'
                || $pathname === '/api/organizations/register'
                || $pathname === '/api/auth/forgot-password' || $pathname === '/api/auth/reset-password'
                || $pathname === '/api/auth/verify-email' || $pathname === '/api/auth/mfa/challenge'
                || $pathname === '/api/auth/request-otp' || $pathname === '/api/auth/verify-otp'
                || $pathname === '/api/unsubscribe'
                || $pathname === '/api/account/data-request'
                || preg_match('#^/api/elections/\d+/results/verify$#', $pathname) === 1
                || preg_match('#^/api/polls/[^/]+/(vote|report)$#', $pathname) === 1;
            if (!$exempt) {
                if ($session === null) {
                    throw new HttpError(401, 'Sign in to continue.', 'auth_required');
                }
                $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
                if (!is_string($token) || $token === '' || !safe_equal($token, $session['csrf'])) {
                    throw new HttpError(403, 'Security token missing or invalid. Refresh the page and try again.', 'csrf_failed');
                }
            }

            $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
            if (is_string($origin) && $origin !== '') {
                $originHost = parse_url($origin, PHP_URL_HOST);
                $originPort = parse_url($origin, PHP_URL_PORT);
                if (is_string($originHost) && $originHost !== '') {
                    $originHost .= $originPort !== null ? ':' . $originPort : '';
                } else {
                    $originHost = null;
                }
                $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
                if ($originHost === null || $originHost !== $host) {
                    throw new HttpError(403, 'Cross-origin request blocked.', 'cross_origin');
                }
            }
        }

        $body = [];
        if ($mutating) {
            $type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
            if ($type !== '' && !str_contains($type, 'application/json')) {
                throw new HttpError(415, 'Send JSON with Content-Type: application/json.', 'unsupported_media_type');
            }
            $body = read_json_body();
        }

        $ctx = [
            'pathname' => $pathname,
            'method' => $method,
            'apiVersion' => $version,
            'params' => $params,
            'query' => $_GET,
            'body' => $body,
            'user' => $user,
            'session' => $session,
            'ip' => $ip,
        ];

        ($match['handler'])($ctx);
    } catch (HttpError $error) {
        $status = $error->status;
        if ($status >= 500) {
            error_log(sprintf('[error] %s %s: %s', $method, $pathname, $error->getMessage()));
        }
        $message = $status >= 500
            ? 'Something went wrong on our end. Please try again.'
            : $error->getMessage();
        send_json($status, error_envelope($status, $message, $error->errorCode), $error->headers);
    } catch (Throwable $error) {
        error_log(sprintf(
            '[error] %s %s: %s in %s:%d',
            $method,
            $pathname,
            $error->getMessage(),
            $error->getFile(),
            $error->getLine(),
        ));
        report_error($error->getMessage(), ['method' => $method, 'path' => $pathname, 'file' => $error->getFile(), 'line' => $error->getLine()]);
        send_json(500, error_envelope(500, 'Something went wrong on our end. Please try again.', 'error'));
    }
}
