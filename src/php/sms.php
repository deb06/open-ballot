<?php

declare(strict_types=1);

/**
 * SMS delivery with provider support and a safe local outbox.
 *
 * Providers:
 *   - twilio:   SMS_PROVIDER=twilio, SMS_TWILIO_SID, SMS_TWILIO_TOKEN, SMS_FROM
 *   - generic:  SMS_PROVIDER=generic, SMS_API_URL, SMS_API_KEY (JSON {to, message})
 *
 * If no provider is configured, messages are written to data/sms.log so local
 * development and the smoke suite can inspect them. Nothing is ever silently
 * dropped, and delivery failures never break the user action.
 */

function normalize_phone(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $digits = preg_replace('/[^0-9]/', '', $value) ?? '';
    if (strlen($digits) < 8 || strlen($digits) > 15) {
        return null;
    }
    return '+' . $digits;
}

function sms_enabled(): bool
{
    return env_value('SMS_PROVIDER') !== null;
}

function sms_provider(): string
{
    return strtolower((string) env_value('SMS_PROVIDER', 'none'));
}

function send_sms(string $to, string $message): bool
{
    $provider = sms_provider();
    if ($provider === 'twilio') {
        return sms_send_twilio($to, $message);
    }
    if ($provider === 'generic') {
        return sms_send_generic($to, $message);
    }
    return sms_log($to, $message);
}

function sms_log(string $to, string $message): bool
{
    $path = (string) config('data_dir') . DIRECTORY_SEPARATOR . 'sms.log';
    $written = @file_put_contents(
        $path,
        sprintf("[%s] TO=%s\n%s\n\n", gmdate('c'), $to, str_replace(["\r", "\n"], ' ', $message)),
        FILE_APPEND | LOCK_EX,
    );
    return $written !== false;
}

function sms_send_twilio(string $to, string $message): bool
{
    $sid = env_value('SMS_TWILIO_SID');
    $token = env_value('SMS_TWILIO_TOKEN');
    $from = env_value('SMS_FROM');
    if ($sid === null || $token === null || $from === null) {
        return sms_log($to, $message);
    }
    $url = 'https://api.twilio.com/2010-04-01/Accounts/' . rawurlencode($sid) . '/Messages.json';
    $body = http_build_query(['To' => $to, 'From' => $from, 'Body' => $message]);
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Authorization: Basic " . base64_encode($sid . ':' . $token) . "\r\n"
            . "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => $body,
        'timeout' => 8,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        return false;
    }
    $data = json_decode($response, true);
    return is_array($data) && isset($data['sid']);
}

function sms_send_generic(string $to, string $message): bool
{
    $url = env_value('SMS_API_URL');
    if ($url === null) {
        return sms_log($to, $message);
    }
    $headers = "Content-Type: application/json\r\n";
    $apiKey = env_value('SMS_API_KEY');
    if ($apiKey !== null) {
        $headers .= 'X-API-Key: ' . $apiKey . "\r\n";
    }
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => $headers,
        'content' => json_encode(['to' => $to, 'message' => $message]),
        'timeout' => 8,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        return false;
    }
    $status = $http_response_header[0] ?? '';
    return str_contains($status, ' 2');
}

/** Generate a numeric verification code. */
function sms_code(): string
{
    return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}
