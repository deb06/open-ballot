<?php

declare(strict_types=1);

/**
 * Create (or reset) the database schema and seed data.
 *
 *   php scripts/init-db.php
 *   php scripts/init-db.php --reset
 *   php scripts/init-db.php --database=open_ballot_test --admin-password="TestAdmin#123"
 */

$options = [
    'database' => null,
    'admin-name' => null,
    'admin-email' => null,
    'admin-password' => null,
    'reset' => false,
    'verbose' => false,
];

foreach (array_slice($argv ?? [], 1) as $arg) {
    if ($arg === '--reset') {
        $options['reset'] = true;
        continue;
    }
    if ($arg === '--verbose' || $arg === '-v') {
        $options['verbose'] = true;
        continue;
    }
    if (str_starts_with($arg, '--')) {
        [$key, $value] = array_pad(explode('=', substr($arg, 2), 2), 2, null);
        if (array_key_exists($key, $options) && $value !== null) {
            $options[$key] = $value;
        }
    }
}

if ($options['database'] !== null) {
    putenv('DB_NAME=' . $options['database']);
}
if ($options['admin-name'] !== null) {
    putenv('ADMIN_NAME=' . $options['admin-name']);
}
if ($options['admin-email'] !== null) {
    putenv('ADMIN_EMAIL=' . $options['admin-email']);
}
if ($options['admin-password'] !== null) {
    putenv('ADMIN_PASSWORD=' . $options['admin-password']);
}

require __DIR__ . '/../src/php/bootstrap.php';

try {
    if ($options['reset']) {
        echo "Dropping existing tables…\n";
        db_reset();
    }
    db_ensure_ready();

    $db = config('db');
    $users = (int) db_scalar('SELECT COUNT(*) FROM users');
    $elections = (int) db_scalar('SELECT COUNT(*) FROM elections');
    $candidates = (int) db_scalar('SELECT COUNT(*) FROM candidates');

    echo "Database ready: mysql://{$db['user']}@{$db['host']}:{$db['port']}/{$db['name']}\n";
    echo "  users: {$users}, elections: {$elections}, candidates: {$candidates}\n";
    if ($options['verbose']) {
        echo "  admin: " . config('admin.email') . "\n";
    }
} catch (Throwable $error) {
    fwrite(STDERR, "\nDatabase initialisation failed.\n");
    fwrite(STDERR, '  ' . $error->getMessage() . "\n\n");
    fwrite(STDERR, "Is MariaDB running? Try: powershell -File scripts/db-start.ps1\n\n");
    exit(1);
}
