<?php

declare(strict_types=1);

/**
 * Front controller for the PHP built-in server:
 *
 *   php -S 127.0.0.1:3000 -t public router.php
 *
 * API routes are handled in PHP; everything else is served from public/.
 */

require __DIR__ . '/src/php/bootstrap.php';

security_headers();

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$pathname = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
if (!is_string($pathname) || $pathname === '') {
    $pathname = '/';
}
if (strlen($pathname) > 1 && str_ends_with($pathname, '/')) {
    $pathname = rtrim($pathname, '/');
}
if ($pathname === '') {
    $pathname = '/';
}

$version = 'v0';
if (str_starts_with($pathname, '/api/v1/')) {
    $version = 'v1';
    $pathname = '/api/' . substr($pathname, strlen('/api/v1/'));
}
if ($pathname === '/api/v1') {
    $version = 'v1';
    $pathname = '/api';
}

try {
    if (str_starts_with($pathname, '/api/')) {
        db_ensure_ready();
        handle_api($pathname, $method, $version);
        return true;
    }

    if (serve_static($pathname)) {
        return true;
    }

    // SPA fallback: real app routes (/election/1, /admin/users, …) are all
    // served by the same shell. Requests with a file extension that did not
    // match a real file stay 404 (avoids masking missing assets).
    if (!str_contains(basename($pathname), '.')) {
        $index = (string) config('public_dir') . DIRECTORY_SEPARATOR . 'index.html';
        if (is_file($index)) {
            $html = (string) file_get_contents($index);
            $snippet = app_shell_ssr($pathname);
            if ($snippet !== '') {
                $html = str_replace('</body>', $snippet . "\n  </body>", $html);
            }
            http_response_code(200);
            header('Content-Type: text/html; charset=utf-8');
            header('Cache-Control: no-cache, must-revalidate');
            echo $html;
            return true;
        }
    }

    send_json(404, error_envelope(404, 'Not found.', 'not_found'));
} catch (Throwable $error) {
    error_log(sprintf(
        '[fatal] %s %s: %s in %s:%d',
        $method,
        $pathname,
        $error->getMessage(),
        $error->getFile(),
        $error->getLine(),
    ));
    if (!headers_sent()) {
        send_json(500, error_envelope(500, 'Something went wrong on our end. Please try again.', 'error'));
    }
}

return true;
