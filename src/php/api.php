<?php

declare(strict_types=1);

/**
 * API routes and dispatcher.
 *
 * Every state-changing route uses prepared SQL statements and is guarded by a
 * session-bound CSRF token. Request/response shapes match the frontend.
 */

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

    /* -------------------------------------------------------------- */
    /* Public: stats                                                   */
    /* -------------------------------------------------------------- */

    $add('GET', '/api/health', static function (array $ctx): void {
        send_json(200, ['ok' => true, 'time' => now_iso(), 'app' => config('app_name')]);
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

        if (db_one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            fail(409, 'An account with that email already exists.', 'email_taken');
        }

        $now = now_iso();
        $id = db_insert(
            "INSERT INTO users (name, email, password_hash, role, active, created_at)
             VALUES (?, ?, ?, 'voter', 1, ?)",
            [$name, $email, hash_password($password), iso_to_sql($now)],
        );

        // Send verification e-mail (best effort; link is also written to data/mail.log).
        $token = random_token(32);
        $hash = sha256($token);
        db_exec(
            'INSERT INTO email_verifications (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
            [$id, $hash, iso_to_sql(now_iso_at(time() + 86400)), iso_to_sql($now)],
        );
        $link = (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/#/verify-email/' . $token);
        send_mail($email, 'Verify your Open Ballot e-mail', "Verify your e-mail address:\n\n{$link}\n\nThe link expires in 24 hours.");

        $user = [
            'id' => $id,
            'name' => $name,
            'email' => $email,
            'role' => 'voter',
            'active' => true,
            'emailVerified' => false,
            'createdAt' => $now,
        ];
        $csrf = create_session($user, $ctx['ip']);
        audit($id, 'auth.register', ['email' => $email], $ctx['ip']);
        send_json(201, ['user' => $user, 'csrf' => $csrf]);
    });

    $add('POST', '/api/auth/login', static function (array $ctx): void {
        ensure_limit('login:ip:' . $ctx['ip'], 20, 900, 'Too many sign-in attempts. Wait a moment and try again.');
        $body = $ctx['body'];
        $email = strtolower(trim(as_text($body['email'] ?? null)));
        ensure_limit(
            'login:email:' . ($email !== '' ? $email : 'unknown'),
            8,
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

        $now = now_iso();
        if (!empty($row['mfa_enabled']) && !empty($row['mfa_secret'])) {
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
        if ((string) $row['role'] !== 'admin') {
            audit((int) $row['id'], 'auth.admin_login_denied', ['email' => $email], $ctx['ip']);
            fail(403, 'Administrator access required.', 'forbidden');
        }

        $now = now_iso();
        db_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [iso_to_sql($now), (int) $row['id']]);
        $row['last_login_at'] = iso_to_sql($now);
        $user = public_user($row);
        $csrf = create_session($user, $ctx['ip']);
        audit((int) $row['id'], 'auth.admin_login', [], $ctx['ip']);
        send_json(200, ['user' => $user, 'csrf' => $csrf]);
    });

    $add('POST', '/api/auth/forgot-password', static function (array $ctx): void {
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
            $link = (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/#/reset-password/' . $token);
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

    $add('POST', '/api/auth/resend-verification', static function (array $ctx): void {
        $user = $ctx['user'];
        if ($user === null) {
            fail(401, 'Sign in to continue.', 'auth_required');
        }
        $row = db_one('SELECT * FROM users WHERE id = ?', [$user['id']]);
        if ($row !== null && $row['email_verified_at'] === null) {
            $token = random_token(32);
            $hash = sha256($token);
            db_exec(
                'INSERT INTO email_verifications (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
                [(int) $row['id'], $hash, iso_to_sql(now_iso_at(time() + 86400)), iso_to_sql(now_iso())],
            );
            $link = (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/#/verify-email/' . $token);
            send_mail((string) $row['email'], 'Verify your Open Ballot e-mail', "Verify your e-mail address:\n\n{$link}\n\nThe link expires in 24 hours.");
            audit((int) $row['id'], 'auth.verification_sent', [], $ctx['ip']);
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
            audit((int) $row['id'], 'auth.mfa_failed', [], $ctx['ip']);
            fail(401, 'Invalid authentication code.', 'invalid_code');
        }
        db_exec('DELETE FROM mfa_challenges WHERE id = ?', [(int) $row['id']]);
        $now = now_iso();
        db_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [iso_to_sql($now), (int) $row['id']]);
        $row['last_login_at'] = iso_to_sql($now);
        $user = public_user($row);
        $csrf = create_session($user, $ctx['ip']);
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
                        db_exec(
                            'INSERT INTO vote_choices (vote_id, candidate_id) VALUES (?, ?)',
                            [$voteId, (int) $c['id']],
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
        ]);
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

    $admin('GET', '/api/admin/overview', static function (array $ctx): void {
        $users = (int) db_scalar('SELECT COUNT(*) FROM users');
        $activeUsers = count_active_users();
        $admins = (int) db_scalar("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1");
        $elections = db_all('SELECT * FROM elections');

        $statusCounts = ['draft' => 0, 'scheduled' => 0, 'open' => 0, 'closed' => 0];
        foreach ($elections as $election) {
            $statusCounts[effective_status($election)] += 1;
        }

        $startOfDay = (new DateTimeImmutable('today', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.v');
        $ballotsToday = (int) db_scalar('SELECT COUNT(*) FROM participation WHERE voted_at >= ?', [$startOfDay]);

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
             ORDER BY a.id DESC LIMIT 8',
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
                'total' => (int) db_scalar('SELECT COUNT(*) FROM votes'),
                'today' => $ballotsToday,
            ],
            'activeElections' => $activeElections,
            'recentActivity' => $recentActivity,
        ]);
    });

    $admin('GET', '/api/admin/elections', static function (array $ctx): void {
        $rows = db_all(
            "SELECT * FROM elections
             ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, created_at DESC",
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
               (title, description, status, results_visibility, max_choices, opens_at, closes_at, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $title,
                $description,
                'draft',
                $resultsVisibility,
                $maxChoices,
                iso_to_sql($opensAt),
                iso_to_sql($closesAt),
                (int) $ctx['user']['id'],
                iso_to_sql($now),
                iso_to_sql($now),
            ],
        );

        $row = get_election($id);
        audit((int) $ctx['user']['id'], 'election.create', ['electionId' => $id, 'title' => $title], $ctx['ip']);
        send_json(201, ['election' => serialize_election($row, ['id' => (int) $ctx['user']['id'], 'role' => 'admin'])]);
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
                 opens_at = ?, closes_at = ?, status = ?, updated_at = ?
             WHERE id = ?',
            [
                $next['title'],
                $next['description'],
                $next['resultsVisibility'],
                $next['maxChoices'],
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
        if ($search !== '') {
            $pattern = '%' . $search . '%';
            $rows = db_all(
                'SELECT * FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT 200',
                [$pattern, $pattern],
            );
        } else {
            $rows = db_all('SELECT * FROM users ORDER BY created_at DESC LIMIT 200');
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
        $role = array_key_exists('role', $body) ? one_of($body['role'], ['voter', 'admin']) : 'voter';
        if (db_one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            fail(409, 'An account with that email already exists.', 'email_taken');
        }
        $now = now_iso();
        $id = db_insert(
            'INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
            [$name, $email, hash_password($password), $role, iso_to_sql($now)],
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
            $id = db_insert(
                "INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, 'voter', 1, ?)",
                [$name, $email, hash_password($password), iso_to_sql(now_iso())],
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
        $role = $has('role') ? one_of($body['role'], ['voter', 'admin']) : $target['role'];
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

        $rows = db_all(
            'SELECT a.id, a.action, a.details, a.ip, a.created_at, u.name AS actor_name
             FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
             WHERE a.action LIKE ?
             ORDER BY a.id DESC LIMIT ' . $limit . ' OFFSET ' . $offset,
            [$prefix],
        );
        $total = (int) db_scalar('SELECT COUNT(*) FROM audit_log WHERE action LIKE ?', [$prefix]);

        $entries = array_map(static function (array $row): array {
            $row['id'] = (int) $row['id'];
            $row['details'] = safe_json($row['details']);
            $row['created_at'] = sql_to_iso($row['created_at']);
            return $row;
        }, $rows);

        send_json(200, ['total' => $total, 'entries' => $entries]);
    });

    return $routes;
}

/**
 * Dispatch an /api request. Assumes security headers are already sent.
 */
function handle_api(string $pathname, string $method, string $version = 'v0'): void
{
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
            send_json(405, ['error' => ['message' => 'Method not allowed.', 'code' => 'method_not_allowed']]);
        } else {
            send_json(404, ['error' => ['message' => 'Not found.', 'code' => 'not_found']]);
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
        if (!empty($options['admin']) && ($user === null || $user['role'] !== 'admin')) {
            if ($user === null) {
                throw new HttpError(401, 'Sign in to continue.', 'auth_required');
            }
            throw new HttpError(403, 'Administrator access required.', 'forbidden');
        }
        if (!empty($options['auth']) && $user === null) {
            throw new HttpError(401, 'Sign in to continue.', 'auth_required');
        }

        $mutating = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        if ($mutating) {
            $exempt = $pathname === '/api/auth/login' || $pathname === '/api/auth/admin/login' || $pathname === '/api/auth/register'
                || $pathname === '/api/auth/forgot-password' || $pathname === '/api/auth/reset-password'
                || $pathname === '/api/auth/verify-email' || $pathname === '/api/auth/mfa/challenge';
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
        send_json($status, ['error' => ['message' => $message, 'code' => $error->errorCode]], $error->headers);
    } catch (Throwable $error) {
        error_log(sprintf(
            '[error] %s %s: %s in %s:%d',
            $method,
            $pathname,
            $error->getMessage(),
            $error->getFile(),
            $error->getLine(),
        ));
        send_json(500, ['error' => [
            'message' => 'Something went wrong on our end. Please try again.',
            'code' => 'error',
        ]]);
    }
}
