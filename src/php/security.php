<?php

declare(strict_types=1);

/**
 * Password hashing, anonymous voter identifiers, tokens and rate limiting.
 */

function random_token(int $bytes = 32): string
{
    return bin2hex(random_bytes($bytes));
}

function sha256(string $value): string
{
    return hash('sha256', $value);
}

function app_secret(): string
{
    static $secret = null;
    if (is_string($secret)) {
        return $secret;
    }

    // An explicit secret lets a deployment share the key used to mint
    // imported receipt hashes without committing the key to the repository.
    $configured = env_value('APP_SECRET');
    if ($configured !== null && trim($configured) !== '') {
        return $secret = trim($configured);
    }

    $file = config('data_dir') . DIRECTORY_SEPARATOR . 'secret.key';
    if (is_file($file)) {
        $stored = trim((string) file_get_contents($file));
        if ($stored !== '') {
            return $secret = $stored;
        }
    }

    $secret = random_token(32);
    file_put_contents($file, $secret . "\n", LOCK_EX);
    @chmod($file, 0600);
    return $secret;
}

/**
 * Keyed hash used to store receipts without keeping the printed code. The key
 * also protects old, non-anonymous voter hashes during a schema upgrade.
 */
function hmac(string $value): string
{
    return hash_hmac('sha256', $value, app_secret());
}

/** Constant-time comparison that works for strings of any length. */
function safe_equal(string $a, string $b): bool
{
    return hash_equals(sha256($a), sha256($b));
}

/**
 * Check Have I Been Pwned using k-anonymity: only the first 5 characters of
 * the SHA-1 hash are sent. Best-effort — if the service is unreachable the
 * other password rules still apply.
 */
function password_breached(string $password): bool
{
    static $unavailable = false;
    if ($unavailable || env_value('BREACH_CHECK', '1') !== '1') {
        return false;
    }
    $hash = strtoupper(sha1($password));
    $prefix = substr($hash, 0, 5);
    $suffix = substr($hash, 5);
    $context = stream_context_create([
        'http' => ['timeout' => 1, 'header' => "User-Agent: Open Ballot\r\n", 'ignore_errors' => true],
    ]);
    $response = @file_get_contents('https://api.pwnedpasswords.com/range/' . $prefix, false, $context);
    if ($response === false || $response === '') {
        $unavailable = true; // avoid repeated slow calls in this request
        return false;
    }
    foreach (explode("\n", $response) as $line) {
        if (strpos($line, $suffix) === 0) {
            return true;
        }
    }
    return false;
}

/**
 * Prefer Argon2id (memory-hard) and fall back to a high-cost bcrypt where the
 * build does not provide it. Existing hashes are upgraded on successful login.
 */
function password_algorithm(): string
{
    return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
}

/** @return array<string,int> */
function password_options(): array
{
    if (defined('PASSWORD_ARGON2ID')) {
        return ['memory_cost' => 65536, 'time_cost' => 4, 'threads' => 1];
    }
    return ['cost' => 13];
}

function hash_password(string $password): string
{
    return password_hash($password, password_algorithm(), password_options());
}

function verify_password(string $password, string $stored): bool
{
    if ($stored === '') {
        return false;
    }
    return password_verify($password, $stored);
}

/** True when a stored hash should be re-hashed with the current algorithm. */
function password_needs_upgrade(string $stored): bool
{
    if ($stored === '') {
        return false;
    }
    return password_needs_rehash($stored, password_algorithm(), password_options());
}

/** Upgrade a hash after a verified login, keeping the account usable if it fails. */
function upgrade_password_hash(int $userId, string $password, string $stored): void
{
    if (!password_needs_upgrade($stored)) {
        return;
    }
    try {
        $newHash = hash_password($password);
        db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [$newHash, $userId]);
    } catch (Throwable) {
        // Re-hashing is opportunistic; the verified login still succeeds.
    }
}

/**
 * Pre-computed hash so failed logins for unknown accounts take roughly the
 * same time as failed logins for real accounts.
 */
function dummy_hash(): string
{
    static $hash = null;
    if (!is_string($hash)) {
        $hash = hash_password(random_token(16));
    }
    return $hash;
}

/** Fixed-window, in-process rate limiter. */
function rate_limit(string $key, int $max, int $windowSeconds): array
{
    // Shared, database-backed fixed-window limiter so that the limit survives
    // across PHP processes (and, with a shared database, across servers).
    $now = time();
    $cfg = config('db');
    $isPg = ($cfg['driver'] ?? 'mysql') === 'pgsql';
    $keyCol = $isPg ? '"key"' : '`key`';
    $row = db_one("SELECT window_start, count FROM rate_limits WHERE $keyCol = ?", [$key]);
    $windowStart = $now;
    $count = 0;
    if ($row !== null) {
        $existingStart = strtotime((string) $row['window_start']);
        if ($existingStart !== false && $existingStart + $windowSeconds > $now) {
            $windowStart = $existingStart;
            $count = (int) $row['count'];
        }
    }
    $count += 1;
    if ($count > $max) {
        return ['ok' => false, 'retryAfter' => max(1, ($windowStart + $windowSeconds) - $now)];
    }
    $cfg = config('db');
    $isPg = ($cfg['driver'] ?? 'mysql') === 'pgsql';
    $keyCol = $isPg ? '"key"' : '`key`';
    $upsert = $isPg
        ? "INSERT INTO rate_limits ($keyCol, window_start, count) VALUES (?, ?, ?) ON CONFLICT ($keyCol) DO UPDATE SET window_start = EXCLUDED.window_start, count = EXCLUDED.count"
        : "INSERT INTO rate_limits ($keyCol, window_start, count) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE window_start = VALUES(window_start), count = VALUES(count)";
    try {
        db_exec($upsert, [$key, iso_to_sql(now_iso_at($windowStart)), $count]);
    } catch (Throwable) {
        // Fall back to a best-effort in-memory bucket if the database is unavailable.
        static $buckets = [];
        $buckets[$key] = ['count' => $count, 'reset' => $windowStart + $windowSeconds];
    }
    return ['ok' => true, 'retryAfter' => 0];
}

const RECEIPT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOTP_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32_encode(string $data): string
{
    $bits = '';
    for ($i = 0; $i < strlen($data); $i++) {
        $bits .= str_pad(decbin(ord($data[$i])), 8, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 5) as $chunk) {
        if (strlen($chunk) < 5) {
            $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
        }
        $out .= TOTP_BASE32[bindec($chunk)];
    }
    return $out;
}

function base32_decode(string $data): string
{
    $data = strtoupper(preg_replace('/[^A-Z2-7]/', '', $data) ?? '');
    $bits = '';
    for ($i = 0; $i < strlen($data); $i++) {
        $val = strpos(TOTP_BASE32, $data[$i]);
        if ($val === false) {
            continue;
        }
        $bits .= str_pad(decbin($val), 5, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 8) as $byte) {
        if (strlen($byte) === 8) {
            $out .= chr(bindec($byte));
        }
    }
    return $out;
}

function totp_code(string $secret, ?int $timestamp = null): string
{
    $timestamp = $timestamp ?? time();
    $counter = intdiv($timestamp, 30);
    $key = base32_decode($secret);
    $binary = pack('N*', 0) . pack('N*', $counter);
    $binary = str_pad($binary, 8, "\0", STR_PAD_LEFT);
    $hash = hash_hmac('sha1', $binary, $key, true);
    $offset = ord(substr($hash, -1)) & 0x0F;
    $code = (
        ((ord($hash[$offset]) & 0x7F) << 24) |
        ((ord($hash[$offset + 1]) & 0xFF) << 16) |
        ((ord($hash[$offset + 2]) & 0xFF) << 8) |
        (ord($hash[$offset + 3]) & 0xFF)
    ) % 1000000;
    return str_pad((string) $code, 6, '0', STR_PAD_LEFT);
}

function totp_verify(string $secret, string $code, int $window = 1): bool
{
    $now = time();
    for ($i = -$window; $i <= $window; $i++) {
        if (hash_equals(totp_code($secret, $now + ($i * 30)), $code)) {
            return true;
        }
    }
    return false;
}

/**
 * Minimal SMTP delivery with STARTTLS + AUTH. Used when SMTP_HOST is set;
 * otherwise mail()/the local outbox log is used. Returns false on any failure
 * so the caller can fall back safely.
 */
function smtp_send(string $host, int $port, string $user, string $pass, string $from, string $to, string $subject, string $body): bool
{
    $clean = static fn (string $v): string => str_replace(["\r", "\n"], '', $v);
    $host = $clean($host); $from = $clean($from); $to = $clean($to); $subject = $clean($subject);

    $socket = @stream_socket_client('tcp://' . $host . ':' . $port, $errno, $errstr, 8);
    if ($socket === false) { return false; }
    stream_set_timeout($socket, 8);

    $read = static function () use ($socket): string {
        $line = fgets($socket, 4096);
        return $line === false ? '' : $line;
    };
    $send = static function (string $line) use ($socket): void {
        fwrite($socket, $line . "\r\n");
    };
    $expect = static function (int|array $expected) use ($read): bool {
        for ($i = 0; $i < 12; $i += 1) {
            $line = $read();
            if ($line === '') { return false; }
            if (preg_match('/^\d{3}/', $line) === 1) {
                $code = (int) substr($line, 0, 3);
                return is_array($expected) ? in_array($code, $expected, true) : $code === $expected;
            }
        }
        return false;
    };

    if (!$expect(220)) { fclose($socket); return false; }
    $send('EHLO open-ballot.local');
    if (!$expect(250)) { fclose($socket); return false; }

    $tls = env_value('SMTP_TLS', '1') !== '0';
    if ($tls) {
        $send('STARTTLS');
        if (!$expect(220)) { fclose($socket); return false; }
        if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($socket); return false; }
        $send('EHLO open-ballot.local');
        if (!$expect(250)) { fclose($socket); return false; }
    }

    if ($user !== '' && $pass !== '') {
        $send('AUTH PLAIN ' . base64_encode("\0" . $user . "\0" . $pass));
        if (!$expect(235)) {
            $send('AUTH LOGIN');
            if (!$expect(334)) { fclose($socket); return false; }
            $send(base64_encode($user));
            if (!$expect(334)) { fclose($socket); return false; }
            $send(base64_encode($pass));
            if (!$expect(235)) { fclose($socket); return false; }
        }
    }

    $send('MAIL FROM:<' . $from . '>');
    if (!$expect(250)) { fclose($socket); return false; }
    $send('RCPT TO:<' . $to . '>');
    if (!$expect([250, 251])) { fclose($socket); return false; }
    $send('DATA');
    if (!$expect(354)) { fclose($socket); return false; }

    $headers = 'From: ' . $from . "\r\nTo: " . $to . "\r\nSubject: " . $subject
        . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n";
    $payload = preg_replace('/^\./m', '..', $body) ?? $body;
    $send(str_replace("\n", "\r\n", str_replace("\r\n", "\n", $headers . "\r\n" . $payload)) . "\r\n.");
    $ok = $expect(250);
    $send('QUIT');
    fclose($socket);
    return $ok;
}

/**
 * Generic JSON email API (e.g. Brevo). Configure EMAIL_API_URL, EMAIL_API_KEY
 * and optionally EMAIL_API_TEMPLATE with {from}/{to}/{subject}/{body} placeholders.
 */
function email_api_send(string $from, string $to, string $subject, string $body): bool
{
    $url = env_value('EMAIL_API_URL');
    if ($url === null || $url === '') {
        return false;
    }
    $default = json_encode([
        'from' => ['email' => $from, 'name' => 'Open Ballot'],
        'to' => [['email' => $to]],
        'subject' => $subject,
        'textContent' => $body,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($default === false) {
        return false;
    }
    $template = env_value('EMAIL_API_TEMPLATE');
    $payload = $template !== null && $template !== ''
        ? strtr($template, [
            '{from}' => json_encode($from),
            '{to}' => json_encode($to),
            '{subject}' => json_encode($subject),
            '{body}' => json_encode($body),
        ])
        : $default;
    $key = (string) (env_value('EMAIL_API_KEY') ?? '');
    $headers = "Content-Type: application/json\r\n";
    if ($key !== '') {
        $headers .= "api-key: {$key}\r\nAuthorization: Bearer {$key}\r\n";
    }
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => $headers,
        'content' => $payload,
        'timeout' => 10,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents($url, false, $context);
    $status = $http_response_header[0] ?? '';
    if (!str_contains($status, ' 2')) {
        error_log('[email-api] delivery failed: ' . $status . ' ' . substr((string) $response, 0, 300));
        return false;
    }
    return true;
}

/** Send via Resend's HTTPS API. Returns false on any non-2xx response. */
function resend_send(string $apiKey, string $from, string $to, string $subject, string $body): bool
{
    $payload = json_encode([
        'from' => $from,
        'to' => [$to],
        'subject' => $subject,
        'text' => $body,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        return false;
    }
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Authorization: Bearer {$apiKey}\r\nContent-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 10,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents('https://api.resend.com/emails', false, $context);
    $status = $http_response_header[0] ?? '';
    if (!str_contains($status, ' 2')) {
        error_log('[resend] delivery failed: ' . $status . ' ' . substr((string) $response, 0, 300));
        return false;
    }
    return true;
}

function send_mail(string $to, string $subject, string $body): bool
{
    $from = (string) (env_value('SMTP_FROM') ?? config('mail.from') ?? 'no-reply@openballot.local');

    // A generic JSON email API (Brevo, etc.) takes priority when configured.
    if (env_value('EMAIL_API_URL') !== null) {
        return email_api_send($from, $to, $subject, $body);
    }

    // Prefer Resend's HTTP API when a key is configured — more reliable than
    // SMTP and reports real delivery errors.
    $resendKey = env_value('RESEND_API_KEY');
    if ($resendKey === null && str_starts_with((string) env_value('SMTP_PASS', ''), 're_')) {
        $resendKey = env_value('SMTP_PASS');
    }
    if ($resendKey !== null && $resendKey !== '') {
        if (resend_send($resendKey, $from, $to, $subject, $body)) {
            return true;
        }
        return false;
    }

    $smtpHost = env_value('SMTP_HOST');
    if ($smtpHost !== null && $smtpHost !== '') {
        if (smtp_send($smtpHost, (int) env_value('SMTP_PORT', '587'), (string) (env_value('SMTP_USER') ?? ''),
            (string) (env_value('SMTP_PASS') ?? ''), $from, $to, $subject, $body)) {
            return true;
        }
    }

    $headers = "From: {$from}\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    $ok = @mail($to, $subject, $body, $headers);
    if (!$ok) {
        $log = (string) (config('data_dir') . DIRECTORY_SEPARATOR . 'mail.log');
        $written = @file_put_contents($log, sprintf("[%s] TO=%s SUBJECT=%s\n%s\n\n", gmdate('c'), $to, $subject, $body), FILE_APPEND | LOCK_EX);
        // A successfully written outbox entry counts as delivered locally.
        return $written !== false;
    }
    return true;
}

/** Human-friendly, unguessable receipt code: OB-XXXX-XXXX-XXXX-XXXX */
function new_receipt_code(): string
{
    $body = '';
    $length = strlen(RECEIPT_ALPHABET);
    for ($i = 0; $i < 16; $i += 1) {
        $body .= RECEIPT_ALPHABET[random_int(0, $length - 1)];
    }
    return sprintf(
        'OB-%s-%s-%s-%s',
        substr($body, 0, 4),
        substr($body, 4, 4),
        substr($body, 8, 4),
        substr($body, 12, 4),
    );
}

function normalize_receipt(?string $code): string
{
    return preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $code)) ?? '';
}

/** Store only a keyed hash of the one-time receipt code. */
function receipt_hash(string $code): string
{
    return hmac('receipt:' . normalize_receipt($code));
}

/** Receipts issued before the anonymous-ballot upgrade used a plain hash. */
function legacy_receipt_hash(string $code): string
{
    return sha256(normalize_receipt($code));
}
