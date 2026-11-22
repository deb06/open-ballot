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

// A single DATABASE_URL overrides the individual DB_* variables. This lets a
// deployment point at a permanent external database (e.g. Neon) without
// relying on a platform-managed database that may expire.
$dbConfig = [
    'driver' => env_value('DB_DRIVER', 'mysql'),
    'host' => env_value('DB_HOST', '127.0.0.1'),
    'port' => (int) env_value('DB_PORT', env_value('DB_DRIVER', 'mysql') === 'pgsql' ? '5433' : '3307'),
    'name' => env_value('DB_NAME', 'open_ballot'),
    'user' => env_value('DB_USER', env_value('DB_DRIVER', 'mysql') === 'pgsql' ? 'postgres' : 'openballot'),
    'pass' => env_value('DB_PASS', env_value('DB_DRIVER', 'mysql') === 'pgsql' ? '' : 'OpenBallot#2026'),
];

$databaseUrl = env_value('DATABASE_URL');
if ($databaseUrl !== null && $databaseUrl !== '') {
    $parts = parse_url($databaseUrl);
    if (is_array($parts)) {
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        if (str_starts_with($scheme, 'postgres')) {
            $dbConfig['driver'] = 'pgsql';
            // A URL without an explicit port must use the Postgres default,
            // not the local MySQL port that DB_DRIVER defaults to.
            $dbConfig['port'] = 5432;
        }
        if (isset($parts['host'])) $dbConfig['host'] = (string) $parts['host'];
        if (isset($parts['port'])) $dbConfig['port'] = (int) $parts['port'];
        if (isset($parts['path'])) $dbConfig['name'] = ltrim((string) $parts['path'], '/');
        if (isset($parts['user'])) $dbConfig['user'] = rawurldecode((string) $parts['user']);
        if (isset($parts['pass'])) $dbConfig['pass'] = rawurldecode((string) $parts['pass']);
        // Force TLS when the URL asks for it.
        if (isset($parts['query']) && str_contains((string) $parts['query'], 'sslmode=require')) {
            $dbConfig['sslmode'] = 'require';
        }
    }
}

// Default sslmode for pgsql: required in production (Neon/managed PG), but
// configurable for local development without TLS.
if (!isset($dbConfig['sslmode'])) {
    $dbConfig['sslmode'] = env_value('DB_SSLMODE', 'require');
}

$dbConfig['sslmode'] = env_value('DB_SSLMODE', $dbConfig['sslmode']);

return [
    'root' => $root,
    'public_dir' => $root . DIRECTORY_SEPARATOR . 'public',
    'data_dir' => $dataDir,
    'app_name' => env_value('APP_NAME', 'Open Ballot'),
    'session_cookie' => 'ob_session',
    'session_ttl' => 7 * 24 * 60 * 60,
    'trust_proxy' => env_value('TRUST_PROXY', '0') === '1',
    'db' => $dbConfig,
    'admin' => [
        'name' => env_value('ADMIN_NAME', 'Election Administrator'),
        'email' => strtolower((string) env_value('ADMIN_EMAIL', 'admin@openballot.local')),
        'password' => env_value('ADMIN_PASSWORD', 'Admin#2026'),
    ],
    'mail' => [
        'from' => env_value('MAIL_FROM', 'openballot@outlook.com'),
    ],
];
