<?php

declare(strict_types=1);

/**
 * Shared bootstrap: environment helpers, configuration and module loading.
 *
 *   require __DIR__ . '/src/php/bootstrap.php';
 */

date_default_timezone_set('UTC');

if (!function_exists('env_value')) {
    /**
     * Read an environment variable, treating empty values as "not set".
     */
    function env_value(string $name, ?string $default = null): ?string
    {
        $value = getenv($name);
        if ($value === false) {
            $value = $_SERVER[$name] ?? $_ENV[$name] ?? null;
        }
        if ($value === null || $value === '') {
            return $default;
        }
        return (string) $value;
    }
}

if (!function_exists('config')) {
    /**
     * Read configuration with dot notation: config('db.host').
     */
    function config(?string $key = null, mixed $default = null): mixed
    {
        static $loaded = null;
        if ($loaded === null) {
            $loaded = require __DIR__ . '/config.php';
        }
        if ($key === null) {
            return $loaded;
        }

        $cursor = $loaded;
        foreach (explode('.', $key) as $part) {
            if (!is_array($cursor) || !array_key_exists($part, $cursor)) {
                return $default;
            }
            $cursor = $cursor[$part];
        }
        return $cursor;
    }
}

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/domain.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/pdf.php';
require_once __DIR__ . '/oauth.php';
require_once __DIR__ . '/sms.php';
require_once __DIR__ . '/api.php';
