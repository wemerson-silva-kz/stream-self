<?php

namespace App\Support;

use Illuminate\Support\Facades\Redis;

/**
 * Acesso ao Redis compartilhado com os serviços Go, tolerante a falha:
 * se o Redis estiver indisponível, as operações viram no-op em vez de quebrar
 * a requisição (métricas voltam zeradas, moderação ainda persiste no banco).
 *
 * Usa chaves CRUAS (REDIS_PREFIX vazio) para casar com as do plano Go.
 */
class StreamRedis
{
    public static function get(string $key): ?string
    {
        try {
            $v = Redis::get($key);

            return $v === null ? null : (string) $v;
        } catch (\Throwable) {
            return null;
        }
    }

    public static function publish(string $channel, array $payload): void
    {
        try {
            Redis::publish($channel, json_encode($payload));
        } catch (\Throwable) {
            // silencioso: o efeito persistente (DB) já cobre o estado durável.
        }
    }

    public static function sadd(string $key, string $member): void
    {
        try {
            Redis::sadd($key, [$member]);
        } catch (\Throwable) {
        }
    }

    public static function srem(string $key, string $member): void
    {
        try {
            Redis::srem($key, [$member]);
        } catch (\Throwable) {
        }
    }
}
