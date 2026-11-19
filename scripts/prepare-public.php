<?php

declare(strict_types=1);

/**
 * Safety check run before the app is exposed publicly.
 *
 * If the seeded administrator still uses the default password, replace it with
 * a strong generated one, sign out existing sessions and save the credentials
 * to data/admin-credentials.txt (gitignored).
 *
 *   php scripts/prepare-public.php
 */

require __DIR__ . '/../src/php/bootstrap.php';

$defaultPassword = 'Admin#2026';
$email = (string) config('admin.email');

try {
    db_ensure_ready();
    $admin = db_one('SELECT id, password_hash FROM users WHERE email = ?', [$email]);

    if ($admin === null) {
        echo "No administrator account found for {$email}.\n";
        exit(0);
    }

    if (!verify_password($defaultPassword, (string) $admin['password_hash'])) {
        echo "Administrator password is already set to a non-default value.\n";
        exit(0);
    }

    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    $body = '';
    for ($i = 0; $i < 22; $i += 1) {
        $body .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    $password = 'OB-' . $body . '-2026';

    db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [
        hash_password($password),
        (int) $admin['id'],
    ]);
    db_exec('DELETE FROM sessions');

    $credentials = "Admin email:    {$email}\r\n"
        . "Admin password: {$password}\r\n"
        . 'Generated:      ' . now_iso() . "\r\n"
        . "Change this from Account -> Password after signing in.\r\n";
    $file = config('data_dir') . DIRECTORY_SEPARATOR . 'admin-credentials.txt';
    file_put_contents($file, $credentials, LOCK_EX);
    @chmod($file, 0600);

    echo "The default administrator password was replaced before going public.\n";
    echo "  Email:    {$email}\n";
    echo "  Password: {$password}\n";
    echo "  Saved to: data\\admin-credentials.txt\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Could not prepare the public instance: ' . $error->getMessage() . "\n");
    exit(1);
}
