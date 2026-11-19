# syntax=docker/dockerfile:1
FROM php:8.3-cli-alpine

# System deps + PHP extensions.
RUN apk add --no-cache postgresql-dev git unzip curl \
 && docker-php-ext-install pdo_pgsql pdo_mysql \
 && rm -rf /var/cache/apk/*

# Composer.
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . /app

# Install WebAuthn library (used by passkey endpoints once verification is wired).
RUN composer require web-auth/webauthn-lib --no-interaction --optimize-autoloader 2>/dev/null || true

ENV PORT=8080
EXPOSE 8080

CMD sh -c "php -r 'require \"src/php/bootstrap.php\"; db_ensure_ready();' 2>&1 | tail -5; exec php -S 0.0.0.0:${PORT} -t public router.php"
