<?php

declare(strict_types=1);

/**
 * Best-effort Telegram notifications. Disabled unless both a bot token and a
 * chat id are configured. Delivery failures never affect the user request.
 */

function telegram_enabled(): bool
{
    return env_value('TELEGRAM_BOT_TOKEN') !== null && env_value('TELEGRAM_CHAT_ID') !== null;
}

function telegram_notify(string $message): void
{
    $token = env_value('TELEGRAM_BOT_TOKEN');
    $chat = env_value('TELEGRAM_CHAT_ID');
    if ($token === null || $chat === null || $message === '') {
        return;
    }
    $payload = json_encode([
        'chat_id' => $chat,
        'text' => $message,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        return;
    }

    $url = 'https://api.telegram.org/bot' . $token . '/sendMessage';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch !== false) {
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $payload,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 3,
                CURLOPT_CONNECTTIMEOUT => 2,
                CURLOPT_SSL_VERIFYPEER => true,
            ]);
            curl_exec($ch);
            curl_close($ch);
        }
        return;
    }

    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 3,
        'ignore_errors' => true,
    ]]);
    @file_get_contents($url, false, $context);
}

function telegram_app_name(): string
{
    return (string) config('app_name', 'Open Ballot');
}
