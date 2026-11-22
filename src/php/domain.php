<?php

declare(strict_types=1);

/**
 * Validation, date handling, election domain helpers and sessions.
 */

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

function now_iso_at(int $timestamp): string
{
    return (new DateTimeImmutable('@' . $timestamp))
        ->setTimezone(new DateTimeZone('UTC'))
        ->format('Y-m-d\TH:i:s.v\Z');
}

function now_iso(): string
{
    $now = DateTimeImmutable::createFromFormat('U.u', sprintf('%.6F', microtime(true)));
    if ($now === false) {
        return now_iso_at(time());
    }
    return $now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
}

/** Convert an ISO-8601 timestamp to a MySQL DATETIME(3) value in UTC. */
function iso_to_sql(?string $iso): ?string
{
    if ($iso === null || $iso === '') {
        return null;
    }
    try {
        $date = new DateTimeImmutable($iso, new DateTimeZone('UTC'));
    } catch (Throwable) {
        return null;
    }
    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
}

function sql_datetime(string $value): DateTimeImmutable
{
    $utc = new DateTimeZone('UTC');
    $date = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.u', $value, $utc);
    if ($date === false) {
        $date = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $value, $utc);
    }
    if ($date === false) {
        $date = new DateTimeImmutable($value, $utc);
    }
    return $date->setTimezone($utc);
}

/** Convert a MySQL DATETIME(3) value to an ISO-8601 UTC string. */
function sql_to_iso(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    return sql_datetime((string) $value)->format('Y-m-d\TH:i:s.v\Z');
}

function sql_timestamp(mixed $value): int
{
    return sql_datetime((string) $value)->getTimestamp();
}

function parse_date(mixed $value, string $label): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_string($value)) {
        fail(400, $label . ' is not a valid date.', 'invalid_date');
    }
    $text = trim($value);
    if ($text === '') {
        return null;
    }
    try {
        $date = new DateTimeImmutable($text, new DateTimeZone('UTC'));
    } catch (Throwable) {
        fail(400, $label . ' is not a valid date.', 'invalid_date');
    }
    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Convert a JSON scalar to text the way JavaScript's String() mostly does. */
function as_text(mixed $value): string
{
    if ($value === null) {
        return '';
    }
    if (is_bool($value)) {
        return $value ? 'true' : 'false';
    }
    if (is_scalar($value)) {
        return (string) $value;
    }
    return '';
}

function require_text(mixed $value, int $min, int $max, string $label): string
{
    $text = trim(as_text($value));
    $length = mb_strlen($text);
    if ($length < $min) {
        fail(400, sprintf('%s must be at least %d characters.', $label, $min), 'validation');
    }
    if ($length > $max) {
        fail(400, sprintf('%s must be %d characters or fewer.', $label, $max), 'validation');
    }
    // Strip HTML/script tags to prevent XSS
    $text = strip_tags($text);
    // Remove control characters except newlines/tabs
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text);
    return $text;
}

function optional_text(mixed $value, int $max, string $label): string
{
    $text = trim(as_text($value));
    if (mb_strlen($text) > $max) {
        fail(400, sprintf('%s must be %d characters or fewer.', $label, $max), 'validation');
    }
    // Strip HTML/script tags to prevent XSS
    $text = strip_tags($text);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text);
    return $text;
}

function normalize_email(mixed $value): string
{
    $email = strtolower(trim(as_text($value)));
    $length = strlen($email);
    if ($length < 3 || $length > 160 || preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email) !== 1) {
        fail(400, 'Enter a valid email address.', 'invalid_email');
    }
    return $email;
}

function validate_password(mixed $value): string
{
    $password = as_text($value);
    if (strlen($password) < 12) {
        fail(400, 'Password must be at least 12 characters.', 'weak_password');
    }
    if (strlen($password) > 200) {
        fail(400, 'Password must be 200 characters or fewer.', 'weak_password');
    }
    $classes = 0;
    if (preg_match('/[a-z]/', $password)) $classes += 1;
    if (preg_match('/[A-Z]/', $password)) $classes += 1;
    if (preg_match('/[0-9]/', $password)) $classes += 1;
    if (preg_match('/[^A-Za-z0-9]/', $password)) $classes += 1;
    if ($classes < 3) {
        fail(400, 'Use at least three of: lowercase, uppercase, numbers, symbols.', 'weak_password');
    }
    $blocked = ['password', 'password1', 'password123', '12345678', '123456789', '1234567890',
        'qwerty123', 'qwertyuiop', 'letmein1', 'admin123', 'welcome123', 'iloveyou1'];
    if (in_array(strtolower($password), $blocked, true)) {
        fail(400, 'That password is too common. Choose something less predictable.', 'weak_password');
    }
    if (password_breached($password)) {
        fail(400, 'This password has appeared in a known data breach. Choose a different one.', 'breached_password');
    }
    return $password;
}

function to_int(mixed $value): ?int
{
    if (is_int($value)) {
        $number = $value;
    } elseif (is_float($value) && floor($value) === $value) {
        $number = (int) $value;
    } elseif (is_string($value) && preg_match('/^\d+$/', trim($value)) === 1) {
        $number = (int) trim($value);
    } else {
        return null;
    }
    return $number > 0 ? $number : null;
}

/** JavaScript-style truthiness for JSON values. */
function js_bool(mixed $value): bool
{
    if ($value === null || $value === false || $value === 0 || $value === 0.0 || $value === '') {
        return false;
    }
    if (is_string($value)) {
        return !in_array(strtolower($value), ['0', 'false', 'null', 'undefined'], true);
    }
    return (bool) $value;
}

function one_of(mixed $value, array $allowed): string
{
    $text = as_text($value);
    if (!in_array($text, $allowed, true)) {
        fail(400, 'That option is not valid.', 'validation');
    }
    return $text;
}

function safe_json(mixed $value): array|object
{
    if (!is_string($value) || $value === '') {
        return new stdClass();
    }
    try {
        $decoded = json_decode($value, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return new stdClass();
    }
    if (!is_array($decoded)) {
        return new stdClass();
    }
    return $decoded === [] ? new stdClass() : $decoded;
}

function ensure_limit(string $key, int $max, int $windowSeconds, string $message): void
{
    $result = rate_limit($key, $max, $windowSeconds);
    if (!$result['ok']) {
        // Record the throttled action (not the raw key, which can contain an
        // email address) so repeated abuse is visible in the audit trail.
        audit(null, 'security.rate_limit', ['action' => explode(':', $key, 2)[0]], ($_SERVER['REMOTE_ADDR'] ?? null));
        throw new HttpError(429, $message, 'rate_limited', [
            'Retry-After' => (string) $result['retryAfter'],
        ]);
    }
}

function query_value(array $query, string $key, ?string $default = null): ?string
{
    $value = $query[$key] ?? null;
    return is_scalar($value) ? (string) $value : $default;
}

/* ------------------------------------------------------------------ */
/* Election domain                                                     */
/* ------------------------------------------------------------------ */

function get_election(mixed $id): ?array
{
    $numeric = to_int($id);
    if ($numeric === null) {
        return null;
    }
    return db_one('SELECT * FROM elections WHERE id = ?', [$numeric]);
}

function count_candidates(int $electionId): int
{
    return (int) db_scalar('SELECT COUNT(*) FROM candidates WHERE election_id = ?', [$electionId]);
}

/** Number of anonymous ballots recorded for an election. */
function count_votes(int $electionId): int
{
    return (int) db_scalar('SELECT COUNT(*) FROM votes WHERE election_id = ?', [$electionId]);
}

function count_active_users(): int
{
    return (int) db_scalar('SELECT COUNT(*) FROM users WHERE active = 1');
}

function effective_status(array $row, ?int $now = null): string
{
    $now ??= time();
    if ($row['status'] === 'draft') {
        return 'draft';
    }
    if ($row['status'] === 'closed') {
        return 'closed';
    }
    if (!empty($row['opens_at']) && sql_timestamp($row['opens_at']) > $now) {
        return 'scheduled';
    }
    if (!empty($row['closes_at']) && sql_timestamp($row['closes_at']) <= $now) {
        return 'closed';
    }
    return 'open';
}

/**
 * Participation is deliberately separate from ballots: it answers "did this
 * voter take part?" without recording a choice.
 */
function get_participation(int $electionId, int $userId): ?array
{
    return db_one(
        'SELECT voted_at FROM participation WHERE election_id = ? AND voter_id = ?',
        [$electionId, $userId],
    );
}

function has_voted(int $electionId, int $userId): bool
{
    return get_participation($electionId, $userId) !== null;
}

function election_results(int $electionId): array
{
    $rows = db_all(
        'SELECT c.id, c.name, c.party, COUNT(vc.vote_id) AS votes
         FROM candidates c
         LEFT JOIN vote_choices vc ON vc.candidate_id = c.id
         LEFT JOIN votes v ON v.id = vc.vote_id AND v.election_id = c.election_id
         WHERE c.election_id = ?
         GROUP BY c.id, c.name, c.party
         ORDER BY votes DESC, c.id ASC',
        [$electionId],
    );

    $totalVotes = (int) db_scalar('SELECT COUNT(*) FROM votes WHERE election_id = ?', [$electionId]);

    $candidates = [];
    foreach ($rows as $row) {
        $votes = (int) $row['votes'];
        $candidates[] = [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'party' => $row['party'],
            'votes' => $votes,
            'share' => $totalVotes > 0 ? round(($votes / $totalVotes) * 1000) / 10 : 0,
        ];
    }

    return [
        'candidates' => $candidates,
        'totalVotes' => $totalVotes,
        'registeredVoters' => count_active_users(),
    ];
}

function results_are_visible(array $row, ?array $viewer, bool $voted): bool
{
    if ($viewer !== null && $viewer['role'] === 'admin') {
        return true;
    }
    if ($row['status'] === 'draft') {
        return false;
    }

    switch ($row['results_visibility']) {
        case 'always':
            return true;
        case 'after_vote':
            return $voted;
        case 'after_close':
            return effective_status($row) === 'closed';
        default:
            return false;
    }
}

function serialize_election(array $row, ?array $viewer): array
{
    $id = (int) $row['id'];
    $status = effective_status($row);
    $voted = $viewer !== null ? has_voted($id, (int) $viewer['id']) : false;
    $visible = results_are_visible($row, $viewer, $voted);

    $payload = [
        'id' => $id,
        'title' => $row['title'],
        'description' => $row['description'],
        'status' => $status,
        'resultsVisibility' => $row['results_visibility'],
        'maxChoices' => (int) ($row['max_choices'] ?? 1),
        'ballotType' => (string) ($row['ballot_type'] ?? 'single'),
        'kind' => (string) ($row['kind'] ?? 'election'),
        'slug' => $row['slug'] ?? null,
        'organizationId' => isset($row['organization_id']) && $row['organization_id'] !== null ? (int) $row['organization_id'] : null,
        'createdBy' => isset($row['created_by']) && $row['created_by'] !== null ? (int) $row['created_by'] : null,
        'brandColor' => $row['brand_color'] ?? null,
        'logoUrl' => $row['logo_url'] ?? null,
        'opensAt' => sql_to_iso($row['opens_at']),
        'closesAt' => sql_to_iso($row['closes_at']),
        'createdAt' => sql_to_iso($row['created_at']),
        'updatedAt' => sql_to_iso($row['updated_at']),
        'candidateCount' => count_candidates($id),
        'totalVotes' => count_votes($id),
        'registeredVoters' => count_active_users(),
        'hasVoted' => $voted,
        'resultsVisible' => $visible,
    ];

    if ($visible) {
        $payload['results'] = election_results($id);
    }
    return $payload;
}

function audit(?int $actorId, string $action, array $details = [], ?string $ip = null): void
{
    $encoded = $details === [] ? '{}' : (string) json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    db_insert(
        'INSERT INTO audit_log (actor_id, action, details, ip, created_at) VALUES (?, ?, ?, ?, ?)',
        [$actorId, $action, $encoded, $ip, iso_to_sql(now_iso())],
    );
}

/** Create an in-app notification for a user. Best-effort: never breaks the action. */
function notify(?int $userId, string $type, string $title, string $body = '', ?string $link = null): void
{
    if ($userId === null || $userId <= 0) {
        return;
    }
    try {
        db_exec(
            'INSERT INTO notifications (user_id, type, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [$userId, mb_substr($type, 0, 40), mb_substr($title, 0, 160), mb_substr($body, 0, 500), $link, iso_to_sql(now_iso())],
        );
    } catch (Throwable) {
        // Notifications are advisory; failure must not undo the primary action.
    }
}

function public_user(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'role' => $row['role'],
        'active' => array_key_exists('active', $row) ? (bool) (int) $row['active'] : true,
        'studentId' => $row['student_id'] ?? null,
        'emailVerified' => !empty($row['email_verified_at']),
        'mfaEnabled' => !empty($row['mfa_enabled']),
        'phone' => $row['phone'] ?? null,
        'phoneVerified' => !empty($row['phone_verified_at']),
        'createdAt' => sql_to_iso($row['created_at']),
        'lastLoginAt' => sql_to_iso($row['last_login_at'] ?? null),
        'organizationId' => isset($row['organization_id']) && $row['organization_id'] !== null ? (int) $row['organization_id'] : null,
        'platformAdmin' => (string) ($row['role'] ?? '') === 'admin',
        'orgAdmin' => (string) ($row['role'] ?? '') === 'org_admin',
        'ageConfirmed' => !empty($row['age_confirmed']),
        'termsAccepted' => !empty($row['terms_accepted']),
        'termsAcceptedAt' => $row['terms_accepted_at'] !== null ? sql_to_iso($row['terms_accepted_at']) : null,
        'digestOptIn' => !empty($row['digest_optin']),
    ];
}

/* ------------------------------------------------------------------ */
/* Public polls                                                         */
/* ------------------------------------------------------------------ */

function poll_candidates(int $pollId): array
{
    $rows = db_all('SELECT id, name, party, bio FROM candidates WHERE election_id = ? ORDER BY position ASC, id ASC', [$pollId]);
    return array_map(static fn (array $r): array => [
        'id' => (int) $r['id'],
        'name' => (string) $r['name'],
        'party' => (string) $r['party'],
        'bio' => (string) $r['bio'],
    ], $rows);
}

/** Stable, poll-scoped anonymous voter identity stored only as a keyed hash. */
function voter_token_for(int $electionId): string
{
    $name = 'ob_vote_' . $electionId;
    $token = $_COOKIE[$name] ?? '';
    if (!is_string($token) || preg_match('/^[a-f0-9]{64}$/', $token) !== 1) {
        $token = random_token(32);
        set_cookie($name, $token, 60 * 60 * 24 * 365);
    }
    return hmac('poll-voter:' . $electionId . ':' . $token);
}

/* ------------------------------------------------------------------ */
/* Organizations                                                       */
/* ------------------------------------------------------------------ */

function email_domain(string $email): string
{
    $at = strrpos($email, '@');
    return $at === false ? '' : strtolower(substr($email, $at + 1));
}

function organization_public(array $org): array
{
    return [
        'id' => (int) $org['id'],
        'name' => (string) $org['name'],
        'slug' => (string) $org['slug'],
        'domain' => $org['domain'] === null ? null : (string) $org['domain'],
        'membershipMode' => (string) $org['membership_mode'],
        'status' => (string) $org['status'],
        'createdAt' => sql_to_iso($org['created_at']),
    ];
}

function organization_by_id(?int $id): ?array
{
    if ($id === null || $id <= 0) {
        return null;
    }
    return db_one('SELECT * FROM organizations WHERE id = ?', [$id]);
}

function organization_for_domain(string $domain): ?array
{
    if ($domain === '') {
        return null;
    }
    return db_one(
        "SELECT * FROM organizations WHERE lower(domain) = lower(?) AND status = 'active' AND membership_mode = 'domain' LIMIT 1",
        [$domain],
    );
}

function is_platform_admin(?array $user): bool
{
    return $user !== null && (string) ($user['role'] ?? '') === 'admin';
}

function user_organization_id(?array $user): ?int
{
    if ($user === null) {
        return null;
    }
    $id = $user['organization_id'] ?? $user['organizationId'] ?? null;
    return $id === null || $id === '' ? null : (int) $id;
}

function is_org_admin(?array $user): bool
{
    return $user !== null && (string) ($user['role'] ?? '') === 'org_admin'
        && user_organization_id($user) !== null;
}

function is_admin_user(?array $user): bool
{
    return is_platform_admin($user) || is_org_admin($user);
}

/** null = platform admin (all orgs), -1 = denied, positive = scoped org id. */
function org_scope(?array $user): int
{
    if (is_platform_admin($user)) {
        return 0;
    }
    if (is_org_admin($user)) {
        return (int) user_organization_id($user);
    }
    return -1;
}

function organization_for_user(?array $user): ?array
{
    if ($user === null) {
        return null;
    }
    return organization_by_id(user_organization_id($user));
}

/** Like org_scope(), but also scopes read-only observers to their organization. */
function viewer_scope(?array $user): int
{
    $scope = org_scope($user);
    if ($scope >= 0) {
        return $scope;
    }
    if ($user !== null && (string) ($user['role'] ?? '') === 'observer') {
        $orgId = user_organization_id($user);
        return $orgId === null ? -1 : $orgId;
    }
    return -1;
}

function can_manage_election(array $election, ?array $user): bool
{
    $scope = org_scope($user);
    if ($scope === 0) {
        return true;
    }
    if ($scope < 0) {
        return false;
    }
    $owner = isset($election['organization_id']) && $election['organization_id'] !== null
        ? (int) $election['organization_id']
        : 0;
    return $owner === $scope;
}

function invite_role_to_user_role(string $role): string
{
    return $role === 'org_admin' ? 'org_admin' : ($role === 'observer' ? 'observer' : 'voter');
}

/** Attach a user to a domain-verified organization when one claims their email domain. */
function claim_domain_membership(int $userId, string $email): ?array
{
    $existing = db_one('SELECT organization_id FROM users WHERE id = ?', [$userId]);
    if ($existing !== null && $existing['organization_id'] !== null) {
        return organization_by_id((int) $existing['organization_id']);
    }
    $org = organization_for_domain(email_domain($email));
    if ($org === null) {
        return null;
    }
    db_exec('UPDATE users SET organization_id = ? WHERE id = ? AND organization_id IS NULL', [(int) $org['id'], $userId]);
    return $org;
}

/** Accept a pending invite (optionally token-checked) and attach the user to its org. */
function accept_invite_for_user(int $userId, string $email, ?string $token = null): ?array
{
    $sql = 'SELECT * FROM organization_invites WHERE lower(email) = lower(?) AND accepted_at IS NULL';
    $params = [$email];
    if ($token !== null && $token !== '') {
        $sql .= ' AND token = ?';
        $params[] = $token;
    }
    $sql .= ' ORDER BY id ASC LIMIT 1';
    $invite = db_one($sql, $params);
    if ($invite === null) {
        return null;
    }
    if ($invite['expires_at'] !== null && strtotime((string) $invite['expires_at']) < time()) {
        return null;
    }
    $org = organization_by_id((int) $invite['organization_id']);
    if ($org === null || (string) $org['status'] !== 'active') {
        return null;
    }
    db_transaction(static function () use ($userId, $invite, $org): void {
        db_exec(
            'UPDATE users SET organization_id = ?, role = ? WHERE id = ?',
            [(int) $org['id'], invite_role_to_user_role((string) $invite['role']), $userId],
        );
        db_exec('UPDATE organization_invites SET accepted_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $invite['id']]);
    });
    return $org;
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

function get_session(): ?array
{
    $cookies = parse_cookies();
    $name = (string) config('session_cookie');
    $token = $cookies[$name] ?? null;
    if (!is_string($token) || preg_match('/^[a-f0-9]{64}$/', $token) !== 1) {
        return null;
    }

    $id = sha256($token);
    $row = db_one(
        'SELECT s.id, s.csrf, s.expires_at, s.last_seen_at,
                u.id AS user_id, u.name, u.email, u.role, u.active, u.created_at, u.organization_id,
                u.phone, u.phone_verified_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ?',
        [$id],
    );
    if ($row === null) {
        return null;
    }

    if (sql_timestamp($row['expires_at']) <= time() || !(int) $row['active']) {
        db_exec('DELETE FROM sessions WHERE id = ?', [$id]);
        return null;
    }

    // Sliding idle timeout: a session expires after a period of inactivity
    // even when its absolute lifetime is still valid.
    $idleSeconds = max(300, (int) env_value('SESSION_IDLE_HOURS', '24') * 3600);
    $lastSeen = $row['last_seen_at'] === null ? 0 : sql_timestamp($row['last_seen_at']);
    if ($lastSeen > 0 && $lastSeen + $idleSeconds <= time()) {
        db_exec('DELETE FROM sessions WHERE id = ?', [$id]);
        clear_cookie((string) config('session_cookie'));
        audit((int) $row['user_id'], 'security.session_expired', ['reason' => 'idle'], ($_SERVER['REMOTE_ADDR'] ?? null));
        return null;
    }
    db_exec('UPDATE sessions SET last_seen_at = ? WHERE id = ?', [iso_to_sql(now_iso()), $id]);

    return [
        'id' => $row['id'],
        'csrf' => $row['csrf'],
        'expiresAt' => sql_to_iso($row['expires_at']),
        'user' => [
            'id' => (int) $row['user_id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'role' => $row['role'],
            'active' => true,
            'createdAt' => sql_to_iso($row['created_at']),
            'phone' => $row['phone'] ?? null,
            'phoneVerified' => !empty($row['phone_verified_at']),
            'organizationId' => $row['organization_id'] === null ? null : (int) $row['organization_id'],
            'platformAdmin' => (string) $row['role'] === 'admin',
            'orgAdmin' => (string) $row['role'] === 'org_admin',
        ],
    ];
}

function create_session(array $user, string $ip): string
{
    $token = random_token(32);
    $csrf = random_token(24);
    $id = sha256($token);
    $createdAt = time();
    $ttl = (int) config('session_ttl');

    db_exec(
        'INSERT INTO sessions (id, user_id, csrf, created_at, expires_at, last_seen_at, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $id,
            (int) $user['id'],
            $csrf,
            iso_to_sql(now_iso_at($createdAt)),
            iso_to_sql(now_iso_at($createdAt + $ttl)),
            iso_to_sql(now_iso_at($createdAt)),
            $ip,
            mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
        ],
    );

    $sessions = db_all(
        'SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC',
        [(int) $user['id']],
    );
    foreach (array_slice($sessions, 10) as $stale) {
        db_exec('DELETE FROM sessions WHERE id = ?', [$stale['id']]);
    }

    set_cookie((string) config('session_cookie'), $token, $ttl);
    return $csrf;
}


/* --------------------------------------------------------------------------
   Sessions, trusted devices & login alerts
   -------------------------------------------------------------------------- */

function device_name(string $userAgent): string
{
    $ua = strtolower($userAgent);
    $browser = 'Unknown browser';
    if (str_contains($ua, 'edg/')) $browser = 'Edge';
    elseif (str_contains($ua, 'chrome/')) $browser = 'Chrome';
    elseif (str_contains($ua, 'firefox/')) $browser = 'Firefox';
    elseif (str_contains($ua, 'safari/')) $browser = 'Safari';
    $os = 'Unknown device';
    if (str_contains($ua, 'windows')) $os = 'Windows';
    elseif (str_contains($ua, 'android')) $os = 'Android';
    elseif (str_contains($ua, 'iphone') || str_contains($ua, 'ipad')) $os = 'iOS';
    elseif (str_contains($ua, 'mac os')) $os = 'macOS';
    elseif (str_contains($ua, 'linux')) $os = 'Linux';
    return $browser . ' on ' . $os;
}

function session_rows(int $userId, string $currentId): array
{
    $rows = db_all(
        'SELECT id, created_at, expires_at, ip, user_agent FROM sessions
         WHERE user_id = ? ORDER BY created_at DESC',
        [$userId],
    );
    return array_map(static function (array $row) use ($currentId): array {
        return [
            'id' => (string) $row['id'],
            'createdAt' => sql_to_iso($row['created_at']),
            'expiresAt' => sql_to_iso($row['expires_at']),
            'ip' => $row['ip'] ?? null,
            'device' => device_name((string) ($row['user_agent'] ?? '')),
            'current' => hash_equals($currentId, (string) $row['id']),
        ];
    }, $rows);
}

function trusted_cookie_name(): string
{
    return 'ob_trusted';
}

function trusted_cookie_token(): ?string
{
    $cookies = parse_cookies();
    $token = $cookies[trusted_cookie_name()] ?? null;
    return is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token) === 1 ? $token : null;
}

function is_trusted_device(int $userId): bool
{
    $token = trusted_cookie_token();
    if ($token === null) {
        return false;
    }
    $row = db_one(
        'SELECT id, expires_at FROM trusted_devices WHERE user_id = ? AND token_hash = ?',
        [$userId, sha256($token)],
    );
    if ($row === null || sql_timestamp($row['expires_at']) <= time()) {
        clear_cookie(trusted_cookie_name());
        return false;
    }
    return true;
}

function issue_trusted_device(int $userId): void
{
    $token = random_token(32);
    $name = device_name((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
    db_exec(
        'INSERT INTO trusted_devices (user_id, token_hash, name, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        [$userId, sha256($token), mb_substr($name, 0, 120), iso_to_sql(now_iso()), iso_to_sql(now_iso_at(time() + 30 * 86400))],
    );
    set_cookie(trusted_cookie_name(), $token, 30 * 86400);
}

function revoke_trusted_device(int $userId): void
{
    $token = trusted_cookie_token();
    if ($token !== null) {
        db_exec('DELETE FROM trusted_devices WHERE user_id = ? AND token_hash = ?', [$userId, sha256($token)]);
    }
    clear_cookie(trusted_cookie_name());
}

function send_login_alert(array $user, string $ip, string $device): void
{
    $email = (string) ($user['email'] ?? '');
    if ($email === '') {
        return;
    }
    $body = "A new sign-in to your Open Ballot account was just completed.\n\n"
        . "Device: {$device}\nIP address: {$ip}\nTime: " . now_iso() . "\n\n"
        . "If this was you, no action is needed. If you do not recognise this sign-in, change your password immediately.";
    send_mail($email, 'New sign-in to your Open Ballot account', $body);
    if (!empty($user['phoneVerified']) && !empty($user['phone'])) {
        send_sms((string) $user['phone'], 'New Open Ballot sign-in from ' . $device . '. If this was not you, change your password.');
    }
    audit((int) $user['id'], 'auth.login_alert', ['device' => $device], $ip);
}

/**
 * Merkle tree helpers over SHA-256 leaf hashes.
 */
function merkle_hash(string $data): string
{
    return hash('sha256', $data);
}

function merkle_root(array $leaves): string
{
    if ($leaves === []) {
        return str_repeat('0', 64);
    }
    $level = array_values($leaves);
    while (count($level) > 1) {
        $next = [];
        for ($i = 0; $i < count($level); $i += 2) {
            $left = $level[$i];
            $right = $level[$i + 1] ?? $level[$i];
            $next[] = merkle_hash($left . $right);
        }
        $level = $next;
    }
    return $level[0];
}

function merkle_proof(array $leaves, int $index): array
{
    $proof = [];
    $level = array_values($leaves);
    $i = $index;
    while (count($level) > 1) {
        $siblingIndex = ($i % 2 === 0) ? $i + 1 : $i - 1;
        if ($siblingIndex < count($level)) {
            $proof[] = [
                'hash' => $level[$siblingIndex],
                'position' => ($i % 2 === 0) ? 'right' : 'left',
            ];
        } else {
            $proof[] = [
                'hash' => $level[$i],
                'position' => ($i % 2 === 0) ? 'right' : 'left',
            ];
        }
        $next = [];
        for ($j = 0; $j < count($level); $j += 2) {
            $left = $level[$j];
            $right = $level[$j + 1] ?? $level[$j];
            $next[] = merkle_hash($left . $right);
        }
        $level = $next;
        $i = intdiv($i, 2);
    }
    return $proof;
}

function merkle_verify(string $leaf, array $proof, string $root): bool
{
    $current = $leaf;
    foreach ($proof as $step) {
        if ($step['position'] === 'left') {
            $current = merkle_hash($step['hash'] . $current);
        } else {
            $current = merkle_hash($current . $step['hash']);
        }
    }
    return hash_equals($root, $current);
}

/* --------------------------------------------------------------------------
   WebAuthn helpers
   -------------------------------------------------------------------------- */

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): ?string
{
    $data = strtr($data, '-_', '+/');
    $data = str_pad($data, strlen($data) % 4, '=', STR_PAD_RIGHT);
    $decoded = base64_decode($data, true);
    return $decoded === false ? null : $decoded;
}

function store_webauthn_challenge(int $userId, string $challenge, string $type, int $ttlSeconds = 300): void
{
    $hash = sha256($challenge);
    db_exec(
        'INSERT INTO webauthn_challenges (user_id, challenge, type, expires_at) VALUES (?, ?, ?, ?)',
        [$userId, $hash, $type, iso_to_sql(now_iso_at(time() + $ttlSeconds))],
    );
}

function consume_webauthn_challenge(string $challenge, string $type): bool
{
    $hash = sha256($challenge);
    $row = db_one(
        'SELECT id FROM webauthn_challenges WHERE challenge = ? AND type = ? AND expires_at > ? LIMIT 1',
        [$hash, $type, iso_to_sql(now_iso())],
    );
    if ($row === null) {
        return false;
    }
    db_exec('DELETE FROM webauthn_challenges WHERE id = ?', [(int) $row['id']]);
    return true;
}

/* --------------------------------------------------------------------------
   Webhooks (best-effort, fire-and-forget)
   -------------------------------------------------------------------------- */

function fire_webhooks(string $event, array $payload): void
{
    $hooks = db_all("SELECT id, url, secret, events FROM webhooks WHERE active = 1");
    foreach ($hooks as $hook) {
        $events = array_map('trim', explode(',', (string) $hook['events']));
        if (!in_array($event, $events, true) && !in_array('*', $events, true)) {
            continue;
        }
        $body = json_encode([
            'event' => $event,
            'timestamp' => now_iso(),
            'data' => $payload,
        ], JSON_UNESCAPED_SLASHES);
        $signature = hash_hmac('sha256', (string) $body, (string) $hook['secret']);
        // Non-blocking: short timeout, ignore failures so voting is never delayed.
        $response = @file_get_contents((string) $hook['url'], false, stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\nX-Webhook-Signature: {$signature}\r\n",
                'content' => $body,
                'timeout' => 2,
                'ignore_errors' => true,
            ],
        ]));
        $code = null;
        $error = null;
        $lastHeaders = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : null;
        if (is_array($lastHeaders) && isset($lastHeaders[0]) && preg_match('/\s(\d{3})\s/', $lastHeaders[0], $m) === 1) {
            $code = (int) $m[1];
        }
        $success = $response !== false && $code !== null && $code >= 200 && $code < 300;
        if (!$success) {
            $error = $response === false ? 'Connection failed' : 'HTTP ' . ($code ?? 'unknown');
        }
        log_webhook_delivery((int) $hook['id'], $event, (string) $body, $code, $success, $error);
        db_exec('UPDATE webhooks SET last_sent_at = ? WHERE url = ?', [iso_to_sql(now_iso()), $hook['url']]);
    }
}

/* --------------------------------------------------------------------------
   Signed results (HMAC-SHA256 with a dedicated key in DATA_DIR)
   -------------------------------------------------------------------------- */

function results_signing_key(): string
{
    $path = (string) config('data_dir') . DIRECTORY_SEPARATOR . 'results-signing.key';
    if (!is_file($path)) {
        $key = bin2hex(random_bytes(32));
        file_put_contents($path, $key);
        chmod($path, 0600);
        return $key;
    }
    return trim((string) file_get_contents($path));
}

function sign_results_payload(array $payload): string
{
    $canonical = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return hash_hmac('sha256', (string) $canonical, results_signing_key());
}

function verify_results_signature(array $payload, string $signature): bool
{
    return hash_equals(sign_results_payload($payload), $signature);
}

function signed_results_for(int $electionId): array
{
    $election = get_election($electionId);
    if ($election === null) {
        fail(404, 'Election not found.', 'not_found');
    }
    $rows = db_all(
        'SELECT c.name AS name, c.party AS party, COUNT(vc.vote_id) AS votes
         FROM candidates c
         LEFT JOIN vote_choices vc ON vc.candidate_id = c.id
         WHERE c.election_id = ?
         GROUP BY c.id ORDER BY votes DESC, c.id ASC',
        [$electionId],
    );
    $total = 0;
    foreach ($rows as $r) {
        $total += (int) $r['votes'];
    }
    $candidates = [];
    foreach ($rows as $r) {
        $candidates[] = [
            'name' => (string) $r['name'],
            'party' => (string) ($r['party'] ?? ''),
            'votes' => (int) $r['votes'],
            'share' => $total > 0 ? round(((int) $r['votes'] / $total) * 100, 2) : 0,
        ];
    }
    $payload = [
        'electionId' => $electionId,
        'title' => (string) $election['title'],
        'status' => (string) $election['status'],
        'totalVotes' => $total,
        'candidates' => $candidates,
        'generatedAt' => now_iso(),
    ];
    $key = results_signing_key();
    return [
        'payload' => $payload,
        'signature' => sign_results_payload($payload),
        'algorithm' => 'HMAC-SHA256',
        'keyFingerprint' => substr(hash('sha256', $key), 0, 16),
    ];
}

/* --------------------------------------------------------------------------
   Scheduled election status transitions
   -------------------------------------------------------------------------- */

function apply_scheduled_election_statuses(): void
{
    $now = iso_to_sql(now_iso());
    try {
        db_exec(
            "UPDATE elections SET status = 'open', updated_at = ?
             WHERE status = 'draft' AND opens_at IS NOT NULL AND opens_at <= ?
               AND (SELECT COUNT(*) FROM candidates c WHERE c.election_id = elections.id) >= 2",
            [$now, $now],
        );
        db_exec(
            "UPDATE elections SET status = 'closed', updated_at = ?
             WHERE status = 'open' AND closes_at IS NOT NULL AND closes_at <= ?",
            [$now, $now],
        );
    } catch (Throwable) {
        /* best effort */
    }
}

/* --------------------------------------------------------------------------
   Platform ops: API keys, health snapshots, error reporting
   -------------------------------------------------------------------------- */

function api_key_issue(int $userId, string $name): array
{
    $key = 'obk_' . bin2hex(random_bytes(24));
    $prefix = substr($key, 0, 12);
    db_exec(
        'INSERT INTO api_keys (user_id, name, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?)',
        [$userId, $name, sha256($key), $prefix, iso_to_sql(now_iso())],
    );
    return ['key' => $key, 'prefix' => $prefix];
}

function api_key_authenticate(): bool
{
    $header = $_SERVER['HTTP_X_API_KEY'] ?? null;
    if (!is_string($header) || !str_starts_with($header, 'obk_')) {
        return false;
    }
    $row = db_one(
        'SELECT id, user_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL',
        [sha256($header)],
    );
    if ($row === null) {
        return false;
    }
    db_exec('UPDATE api_keys SET last_used_at = ? WHERE id = ?', [iso_to_sql(now_iso()), (int) $row['id']]);
    return true;
}

function record_health_snapshot(string $status, array $checks): void
{
    try {
        $last = db_one('SELECT recorded_at FROM health_snapshots ORDER BY recorded_at DESC LIMIT 1');
        if ($last !== null && sql_timestamp($last['recorded_at']) + 3600 > time()) {
            return;
        }
        db_exec(
            'INSERT INTO health_snapshots (recorded_at, status, checks) VALUES (?, ?, ?)',
            [iso_to_sql(now_iso()), $status, json_encode($checks)],
        );
    } catch (Throwable) { /* health history is best-effort */ }
}

function report_error(string $message, array $context = []): void
{
    $dsn = env_value('SENTRY_DSN');
    if ($dsn === null || $dsn === '') {
        return;
    }
    $payload = json_encode([
        'message' => $message,
        'timestamp' => gmdate('c'),
        'environment' => env_value('APP_ENV', 'production'),
        'extra' => $context,
    ]);
    $contextStream = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $payload,
            'timeout' => 1,
            'ignore_errors' => true,
        ],
    ]);
    @file_get_contents($dsn, false, $contextStream);
}

function log_webhook_delivery(int $webhookId, string $event, string $payload, ?int $code, bool $success, ?string $error): void
{
    try {
        db_exec(
            'INSERT INTO webhook_deliveries (webhook_id, event, payload, response_code, success, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$webhookId, $event, mb_substr($payload, 0, 4000), $code, $success ? 1 : 0, $error === null ? null : mb_substr($error, 0, 300), iso_to_sql(now_iso())],
        );
    } catch (Throwable) { /* delivery log is best-effort */ }
}

/** Instant-runoff tally: returns rounds and the winner for ranked ballots. */
function irv_results(int $electionId): array
{
    $candidates = db_all('SELECT id, name, party FROM candidates WHERE election_id = ? ORDER BY position, id', [$electionId]);
    if (!$candidates) return ['rounds' => [], 'winner' => null];
    $names = [];
    foreach ($candidates as $c) $names[(int) $c['id']] = $c['name'];
    $ballots = [];
    $rows = db_all(
        'SELECT vc.vote_id, vc.candidate_id, vc.rank FROM vote_choices vc
         JOIN votes v ON v.id = vc.vote_id WHERE v.election_id = ? ORDER BY vc.vote_id, vc.rank',
        [$electionId],
    );
    foreach ($rows as $r) {
        $vid = (string) $r['vote_id'];
        $ballots[$vid][(int) $r['rank']] = (int) $r['candidate_id'];
    }
    foreach ($ballots as &$prefs) ksort($prefs);
    unset($prefs);

    $active = array_map(static fn (array $c): int => (int) $c['id'], $candidates);
    $rounds = [];
    $winner = null;
    while (count($active) > 0) {
        $counts = array_fill_keys($active, 0);
        foreach ($ballots as $prefs) {
            foreach ($prefs as $cid) {
                if (in_array($cid, $active, true)) { $counts[$cid] += 1; break; }
            }
        }
        arsort($counts);
        $total = array_sum($counts);
        $rounds[] = [
            'counts' => array_map(static fn (int $cid, int $n): array => ['id' => $cid, 'name' => $names[$cid] ?? '', 'votes' => $n], array_keys($counts), array_values($counts)),
            'total' => $total,
        ];
        $top = array_key_first($counts);
        if ($top === null || $total === 0) break;
        if (reset($counts) > $total / 2) { $winner = (int) $top; break; }
        $lowest = array_key_last($counts);
        $active = array_values(array_filter($active, static fn (int $cid): bool => $cid !== $lowest));
    }
    return ['rounds' => $rounds, 'winner' => $winner === null ? null : ($names[$winner] ?? null)];
}
