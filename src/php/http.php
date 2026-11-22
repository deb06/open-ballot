<?php

declare(strict_types=1);

/**
 * HTTP helpers: security headers, JSON responses, cookies, request bodies
 * and static file serving.
 */

final class HttpError extends RuntimeException
{
    public int $status;
    public string $errorCode;
    public array $headers;

    public function __construct(int $status, string $message, string $code = 'error', array $headers = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $code;
        $this->headers = $headers;
    }
}

function fail(int $status, string $message, string $code = 'error'): never
{
    throw new HttpError($status, $message, $code);
}

const MIME_TYPES = [
    '.html' => 'text/html; charset=utf-8',
    '.css' => 'text/css; charset=utf-8',
    '.js' => 'text/javascript; charset=utf-8',
    '.mjs' => 'text/javascript; charset=utf-8',
    '.json' => 'application/json; charset=utf-8',
    '.svg' => 'image/svg+xml',
    '.png' => 'image/png',
    '.jpg' => 'image/jpeg',
    '.jpeg' => 'image/jpeg',
    '.webp' => 'image/webp',
    '.ico' => 'image/x-icon',
    '.txt' => 'text/plain; charset=utf-8',
    '.xml' => 'application/xml; charset=utf-8',
    '.webmanifest' => 'application/manifest+json',
];

function security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('X-Permitted-Cross-Domain-Policies: none');
    header('X-DNS-Prefetch-Control: off');
    header('Origin-Agent-Cluster: ?1');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()');
    if (request_is_secure()) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
    }
    header(
        'Content-Security-Policy: ' . implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'sha256-1vtGRdulwnqb8Ao0s4+BpbUIXEoo6+kouLUx5lAQyl8='",
            "object-src 'none'",
            "upgrade-insecure-requests",
            "style-src 'self'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self'",
            "form-action 'self'",
            "base-uri 'none'",
            "frame-ancestors 'none'",
        ]),
    );
    // Indicate that site content must not be used for AI/ML training.
    header('X-AI-Training: no-training');
    header('X-Robots-Tag: noai, noimageai');
}

/**
 * Serve the SPA shell for real app routes with a lightweight <noscript>
 * content block so crawlers that do not run JavaScript still see meaning.
 */
function app_shell_ssr(string $pathname): string
{
    $path = trim($pathname, '/');
    if ($path === '') {
        return '<noscript><div style="max-width:760px;margin:40px auto;padding:24px;font-family:sans-serif">'
            . '<h1>Open Ballot — Secure Online Voting</h1>'
            . '<p>Open Ballot is a secure, anonymous and receipt-verifiable online voting platform for student and community elections. One person, one vote.</p>'
            . '<p>Browse open elections, review candidates, cast a secret ballot and verify your receipt. JavaScript is required to use the application.</p>'
            . '</div></noscript>';
    }
    if ($path === 'help') {
        return '<noscript><div style="max-width:760px;margin:40px auto;padding:24px;font-family:sans-serif">'
            . '<h1>Help & FAQ</h1><p>How do I vote? Register, browse open elections, review candidates and cast your ballot. A receipt proves your ballot was counted.</p>'
            . '<p>How do I keep my account safe? Use a strong password, enable a passkey and save your one-time backup codes.</p></div></noscript>';
    }
    if ($path === 'privacy') {
        return '<noscript><div style="max-width:760px;margin:40px auto;padding:24px;font-family:sans-serif">'
            . '<h1>Privacy</h1><p>Open Ballot stores only the data needed to run an election. Ballots are anonymous: the record of who voted is separate from what was chosen. No advertising or third-party analytics.</p></div></noscript>';
    }
    if (preg_match('#^election/(\d+)$#', $path, $m) === 1) {
        try {
            db_ensure_ready();
            $election = db_one(
                'SELECT title, description, status FROM elections WHERE id = ? AND status != \'draft\'',
                [(int) $m[1]],
            );
            if ($election !== null) {
                return '<noscript><div style="max-width:760px;margin:40px auto;padding:24px;font-family:sans-serif">'
                    . '<h1>' . htmlspecialchars((string) $election['title'], ENT_QUOTES, 'UTF-8') . '</h1>'
                    . '<p>' . htmlspecialchars(mb_substr((string) $election['description'], 0, 500), ENT_QUOTES, 'UTF-8') . '</p>'
                    . '<p>Status: ' . htmlspecialchars((string) $election['status'], ENT_QUOTES, 'UTF-8') . '. JavaScript is required to vote.</p>'
                    . '</div></noscript>';
            }
        } catch (Throwable) {
            // fall through to a generic snippet
        }
        return '<noscript><div style="max-width:760px;margin:40px auto;padding:24px;font-family:sans-serif">'
            . '<h1>Open Ballot election</h1><p>Browse open elections and cast a secret, receipt-verifiable ballot.</p></div></noscript>';
    }
    return '';
}

function send_json(int $status, mixed $payload, array $extraHeaders = []): void
{
    if (headers_sent()) {
        return;
    }

    $body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($body === false) {
        $status = 500;
        $body = '{"error":{"message":"Something went wrong on our end. Please try again.","code":"error"}}';
    }

    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Length: ' . strlen($body));
    header('Cache-Control: no-store');
    foreach ($extraHeaders as $name => $value) {
        header($name . ': ' . $value);
    }
    echo $body;
}

function parse_cookies(): array
{
    return is_array($_COOKIE) ? $_COOKIE : [];
}

function request_is_secure(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    $forwarded = (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '');
    return strtolower(trim(explode(',', $forwarded)[0] ?? '')) === 'https';
}

function set_cookie(string $name, string $value, ?int $maxAgeSeconds = null): void
{
    $options = [
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Strict',
        'secure' => request_is_secure(),
    ];
    if ($maxAgeSeconds !== null) {
        $options['expires'] = $maxAgeSeconds === 0 ? 1 : time() + $maxAgeSeconds;
    }
    setcookie($name, $value, $options);
}

function clear_cookie(string $name): void
{
    set_cookie($name, '', 0);
}

function read_json_body(int $limit = 131072): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > $limit) {
        fail(413, 'Request body is too large.', 'payload_too_large');
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    if (strlen($raw) > $limit) {
        fail(413, 'Request body is too large.', 'payload_too_large');
    }

    try {
        $parsed = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        fail(400, 'Request body is not valid JSON.', 'invalid_json');
    }

    if (!is_array($parsed) || ($parsed !== [] && array_is_list($parsed))) {
        fail(400, 'Request body must be a JSON object.', 'invalid_body');
    }
    return $parsed;
}

function client_ip(): string
{
    if (config('trust_proxy')) {
        $forwarded = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0] ?? '');
        if ($forwarded !== '') {
            return $forwarded;
        }
    }
    $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    return $remote !== '' ? $remote : 'unknown';
}

/**
 * Serve a file from public/. Returns false when the path cannot be served.
 */
function serve_static(string $pathname): bool
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method !== 'GET' && $method !== 'HEAD') {
        return false;
    }

    $relative = rawurldecode($pathname);
    if (str_contains($relative, "\0")) {
        return false;
    }
    // Do not expose the API specification or internal documentation to the public.
    if ($relative === '/openapi.json') {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo '{"error":{"message":"Not found.","code":"not_found"}}';
        return true;
    }
    if ($relative === '/' || $relative === '') {
        $relative = '/index.html';
    }

    $publicDir = (string) config('public_dir');
    $root = realpath($publicDir);
    if ($root === false) {
        return false;
    }

    $candidate = $root . DIRECTORY_SEPARATOR . ltrim(
        str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relative),
        DIRECTORY_SEPARATOR,
    );
    $target = realpath($candidate);
    if ($target === false || !is_file($target)) {
        return false;
    }

    $rootPrefix = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if ($target !== $root && !str_starts_with($target, $rootPrefix)) {
        return false;
    }

    $extension = strtolower(pathinfo($target, PATHINFO_EXTENSION));
    $type = MIME_TYPES['.' . $extension] ?? 'application/octet-stream';

    $mtime = (int) filemtime($target);
    $size = (int) filesize($target);
    $etag = '"' . dechex($mtime) . '-' . dechex($size) . '"';

    header('ETag: ' . $etag);
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
    /* Always revalidate: static assets change during development and a stale
       script breaks the page. The ETag/Last-Modified pair keeps revalidation
       cheap (304 with an empty body) once the file has not changed. */
    header('Cache-Control: no-cache, must-revalidate');

    $ifNoneMatch = trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''));
    $ifModifiedSince = trim((string) ($_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? ''));

    $notModified = false;
    if ($ifNoneMatch !== '') {
        $tags = array_map('trim', explode(',', $ifNoneMatch));
        $notModified = in_array('*', $tags, true) || in_array($etag, $tags, true);
    } elseif ($ifModifiedSince !== '') {
        $since = strtotime($ifModifiedSince);
        $notModified = $since !== false && $mtime <= $since;
    }

    if ($notModified) {
        http_response_code(304);
        return true;
    }

    http_response_code(200);
    header('Content-Type: ' . $type);
    header('Content-Length: ' . $size);

    if ($method !== 'HEAD') {
        readfile($target);
    }
    return true;
}
