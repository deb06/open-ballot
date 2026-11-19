<?php

declare(strict_types=1);

/**
 * Runtime configuration. Everything is overridable through environment
 * variables so the app can be deployed without touching source code.
 */

$root = dirname(__DIR__, 2);

$dataDir = env_value('DATA_DIR');
$dataDir = $dataDir === null ? $root . DIRECTORY_SEPARATOR . 'data' : rtrim($dataDir, '\\/');
if (!is_dir($dataDir) && !mkdir($dataDir, 0775, true) && !is_dir($dataDir)) {
    throw new RuntimeException('Cannot create data directory: ' . $dataDir);
}

return [
    'root' => $root,
    'public_dir' => $root . DIRECTORY_SEPARATOR . 'public',
    'data_dir' => $dataDir,
    'app_name' => env_value('APP_NAME', 'Open Ballot'),
    'session_cookie' => 'ob_session',
    'session_ttl' => 7 * 24 * 60 * 60,
    'trust_proxy' => env_value('TRUST_PROXY', '0') === '1',
    'db' => [
        'driver' => env_value('DB_DRIVER', 'mysql'),
        'host' => env_value('DB_HOST', '127.0.0.1'),
        'port' => (int) env_value('DB_PORT', env_value('DB_DRIVER', 'mysql') === 'pgsql' ? '5433' : '3307'),
        'name' => env_value('DB_NAME', 'open_ballot'),
        'user' => env_value('DB_USER', env_value('DB_DRIVER', 'mysql') === 'pgsql' ? 'postgres' : 'openballot'),
        'pass' => env_value('DB_PASS', env_value('DB_DRIVER', 'mysql') === 'pgsql' ? '' : 'OpenBallot#2026'),
    ],
    'admin' => [
        'name' => env_value('ADMIN_NAME', 'Election Administrator'),
        'email' => strtolower((string) env_value('ADMIN_EMAIL', 'admin@openballot.local')),
        'password' => env_value('ADMIN_PASSWORD', 'Admin#2026'),
    ],
    'mail' => [
        'from' => env_value('MAIL_FROM', 'no-reply@openballot.local'),
    ],
];
