<?php

declare(strict_types=1);

/**
 * Centralized validation + error envelope helpers.
 *
 * Validator collects field errors so clients get all problems at once:
 *   $v = new Validator($body);
 *   $v->text('name', 2, 80)->email('email')->password('password');
 *   $data = $v->validated(); // throws 422 with details on failure
 */

final class Validator
{
    private array $data;
    private array $errors = [];
    private array $clean = [];

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    public function text(string $field, int $min = 1, int $max = 255, ?string $label = null): self
    {
        $label = $label ?? $field;
        $value = $this->data[$field] ?? null;
        if (!is_string($value) || trim($value) === '') {
            $this->errors[$field] = "$label is required.";
            return $this;
        }
        $value = trim($value);
        if (mb_strlen($value) < $min || mb_strlen($value) > $max) {
            $this->errors[$field] = "$label must be between $min and $max characters.";
            return $this;
        }
        $this->clean[$field] = $value;
        return $this;
    }

    public function email(string $field = 'email'): self
    {
        $value = $this->data[$field] ?? null;
        if (!is_string($value) || filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
            $this->errors[$field] = 'A valid email address is required.';
            return $this;
        }
        $this->clean[$field] = strtolower(trim($value));
        return $this;
    }

    public function password(string $field = 'password', int $min = 8): self
    {
        $value = $this->data[$field] ?? null;
        if (!is_string($value) || strlen($value) < $min) {
            $this->errors[$field] = "Password must be at least $min characters.";
            return $this;
        }
        $this->clean[$field] = $value;
        return $this;
    }

    public function integer(string $field, ?int $min = null, ?int $max = null): self
    {
        $value = $this->data[$field] ?? null;
        if (!is_int($value) && !(is_string($value) && ctype_digit($value))) {
            $this->errors[$field] = ucfirst($field) . ' must be a whole number.';
            return $this;
        }
        $value = (int) $value;
        if (($min !== null && $value < $min) || ($max !== null && $value > $max)) {
            $this->errors[$field] = ucfirst($field) . ' is out of range.';
            return $this;
        }
        $this->clean[$field] = $value;
        return $this;
    }

    public function enum(string $field, array $allowed): self
    {
        $value = $this->data[$field] ?? null;
        if (!is_string($value) || !in_array($value, $allowed, true)) {
            $this->errors[$field] = ucfirst($field) . ' must be one of: ' . implode(', ', $allowed) . '.';
            return $this;
        }
        $this->clean[$field] = $value;
        return $this;
    }

    public function optional(string $field, mixed $default = null): self
    {
        $this->clean[$field] = $this->data[$field] ?? $default;
        return $this;
    }

    public function failIfInvalid(): void
    {
        if ($this->errors === []) {
            return;
        }
        throw new HttpError(
            422,
            'Please correct the highlighted fields.',
            'validation_failed',
            ['X-Validation-Errors' => base64_encode(json_encode($this->errors))],
        );
    }

    /** Attach field details to a validation error via the global error context. */
    public function validated(): array
    {
        if ($this->errors !== []) {
            set_error_details($this->errors);
            fail(422, 'Please correct the highlighted fields.', 'validation_failed');
        }
        return $this->clean;
    }

    public function errors(): array
    {
        return $this->errors;
    }
}

/** Per-request error details + timestamp, injected into the error envelope. */
function set_error_details(array $details): void
{
    $GLOBALS['__ob_error_details'] = $details;
}

function error_envelope(int $status, string $message, string $code): array
{
    $error = [
        'code' => $code,
        'message' => $message,
        'timestamp' => now_iso(),
    ];
    if (isset($GLOBALS['__ob_error_details']) && is_array($GLOBALS['__ob_error_details'])) {
        $error['details'] = $GLOBALS['__ob_error_details'];
        $GLOBALS['__ob_error_details'] = null;
    }
    return ['error' => $error];
}
