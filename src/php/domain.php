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
    return $text;
}

function optional_text(mixed $value, int $max, string $label): string
{
    $text = trim(as_text($value));
    if (mb_strlen($text) > $max) {
        fail(400, sprintf('%s must be %d characters or fewer.', $label, $max), 'validation');
    }
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
    if (strlen($password) < 8) {
        fail(400, 'Password must be at least 8 characters.', 'weak_password');
    }
    if (strlen($password) > 200) {
        fail(400, 'Password must be 200 characters or fewer.', 'weak_password');
    }
    $blocked = ['password', 'password1', '12345678', '123456789', 'qwerty123', 'letmein1', 'admin123'];
    if (in_array(strtolower($password), $blocked, true)) {
        fail(400, 'That password is too common. Choose something less predictable.', 'weak_password');
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
        'createdAt' => sql_to_iso($row['created_at']),
        'lastLoginAt' => sql_to_iso($row['last_login_at'] ?? null),
    ];
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
        'SELECT s.id, s.csrf, s.expires_at,
                u.id AS user_id, u.name, u.email, u.role, u.active, u.created_at
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
        'INSERT INTO sessions (id, user_id, csrf, created_at, expires_at, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            $id,
            (int) $user['id'],
            $csrf,
            iso_to_sql(now_iso_at($createdAt)),
            iso_to_sql(now_iso_at($createdAt + $ttl)),
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
    $hooks = db_all("SELECT url, secret, events FROM webhooks WHERE active = 1");
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
        @file_get_contents((string) $hook['url'], false, stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\nX-Webhook-Signature: {$signature}\r\n",
                'content' => $body,
                'timeout' => 2,
                'ignore_errors' => true,
            ],
        ]));
        db_exec('UPDATE webhooks SET last_sent_at = ? WHERE url = ?', [iso_to_sql(now_iso()), $hook['url']]);
    }
}
