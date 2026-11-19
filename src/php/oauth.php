<?php

declare(strict_types=1);

/** Minimal OAuth2 support for GitHub and Google (no external SDK). */

function oauth_config(string $provider): ?array
{
    $configs = [
        'github' => [
            'id' => env_value('OAUTH_GITHUB_ID'),
            'secret' => env_value('OAUTH_GITHUB_SECRET'),
            'authorize' => 'https://github.com/login/oauth/authorize',
            'token' => 'https://github.com/login/oauth/access_token',
            'user' => 'https://api.github.com/user',
            'scope' => 'read:user user:email',
        ],
        'google' => [
            'id' => env_value('OAUTH_GOOGLE_ID'),
            'secret' => env_value('OAUTH_GOOGLE_SECRET'),
            'authorize' => 'https://accounts.google.com/o/oauth2/v2/auth',
            'token' => 'https://oauth2.googleapis.com/token',
            'user' => 'https://openidconnect.googleapis.com/v1/userinfo',
            'scope' => 'openid email profile',
        ],
    ];
    if (!isset($configs[$provider]) || !$configs[$provider]['id'] || !$configs[$provider]['secret']) {
        return null;
    }
    return $configs[$provider];
}

function oauth_http(string $url, array $options = []): string|false
{
    $context = stream_context_create(['http' => array_merge([
        'timeout' => 5,
        'header' => "User-Agent: Open Ballot\r\nAccept: application/json\r\n",
        'ignore_errors' => true,
    ], $options)]);
    return @file_get_contents($url, false, $context);
}

function oauth_user_info(string $provider, array $cfg, string $code): ?array
{
    $redirect = (string) (env_value('APP_URL', 'http://127.0.0.1:3000') . '/api/auth/oauth/' . $provider . '/callback');
    $tokenBody = http_build_query([
        'client_id' => $cfg['id'], 'client_secret' => $cfg['secret'],
        'code' => $code, 'redirect_uri' => $redirect, 'grant_type' => 'authorization_code',
    ]);
    $tokenResponse = oauth_http($cfg['token'], [
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\nAccept: application/json\r\nUser-Agent: Open Ballot\r\n",
        'content' => $tokenBody,
    ]);
    if ($tokenResponse === false) return null;
    $token = json_decode($tokenResponse, true);
    $access = $token['access_token'] ?? null;
    if (!is_string($access)) return null;
    $userResponse = oauth_http($cfg['user'], [
        'header' => "Authorization: Bearer {$access}\r\nAccept: application/json\r\nUser-Agent: Open Ballot\r\n",
    ]);
    if ($userResponse === false) return null;
    $info = json_decode($userResponse, true);
    if (!is_array($info)) return null;
    return [
        'provider_id' => (string) ($info['id'] ?? $info['sub'] ?? ''),
        'email' => strtolower((string) ($info['email'] ?? '')),
        'name' => (string) ($info['name'] ?? $info['login'] ?? 'Member'),
    ];
}

function oauth_provision(array $info, string $provider): ?array
{
    if ($info['provider_id'] === '' || $info['email'] === '') return null;
    $link = db_one('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_id = ?', [$provider, $info['provider_id']]);
    if ($link !== null) {
        $row = db_one('SELECT * FROM users WHERE id = ?', [(int) $link['user_id']]);
        return $row !== null && (int) $row['active'] === 1 ? $row : null;
    }
    $row = db_one('SELECT * FROM users WHERE email = ?', [$info['email']]);
    if ($row === null) {
        if (env_value('REGISTRATION_OPEN', '1') !== '1') return null;
        db_exec(
            'INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
            [$info['name'], $info['email'], hash_password(random_token(24)), 'voter', iso_to_sql(now_iso())],
        );
        $row = db_one('SELECT * FROM users WHERE email = ?', [$info['email']]);
    }
    if ($row === null || (int) $row['active'] !== 1) return null;
    db_exec('INSERT INTO oauth_accounts (user_id, provider, provider_id, created_at) VALUES (?, ?, ?, ?)', [(int) $row['id'], $provider, $info['provider_id'], iso_to_sql(now_iso())]);
    return $row;
}
