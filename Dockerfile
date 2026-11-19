# syntax=docker/dockerfile:1
FROM php:8.3-cli-alpine

# pdo_pgsql + pdo_mysql so the image works with either backend.
RUN apk add --no-cache postgresql-dev \
 && docker-php-ext-install pdo_pgsql pdo_mysql \
 && rm -rf /var/cache/apk/*

WORKDIR /app
COPY . /app

# Render injects PORT; default to 8080 for local `docker run`.
ENV PORT=8080
EXPOSE 8080

# Initialise the schema/seed on first boot, then serve.
CMD sh -c "php -r 'require \"src/php/bootstrap.php\"; db_ensure_ready();' 2>&1 | tail -5; exec php -S 0.0.0.0:${PORT} -t public router.php"
