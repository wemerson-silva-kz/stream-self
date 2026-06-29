# ---- Build dos assets (Vite/React) ----
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Imagem de runtime (php-fpm + nginx) ----
# serversideup/php já traz nginx + php-fpm + healthcheck prontos para Laravel.
FROM serversideup/php:8.3-fpm-nginx AS app

ENV PHP_OPCACHE_ENABLE=1 \
    AUTORUN_ENABLED=true \
    AUTORUN_LARAVEL_MIGRATION=true \
    AUTORUN_LARAVEL_CONFIG_CACHE=true \
    AUTORUN_LARAVEL_ROUTE_CACHE=true

USER root
RUN install-php-extensions pdo_pgsql
USER www-data

WORKDIR /var/www/html

# Dependências PHP (sem dev), aproveitando cache do composer.
COPY --chown=www-data:www-data composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

# Código + assets compilados.
COPY --chown=www-data:www-data . .
COPY --chown=www-data:www-data --from=assets /app/public/build ./public/build
RUN composer dump-autoload --optimize --no-dev

# A porta 8080 é o default do serversideup (nginx).
EXPOSE 8080
