package chat

import (
	"context"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// itoa helper compartilhado no pacote.
func itoa(n int64) string { return strconv.FormatInt(n, 10) }

// Token bucket simples no Redis: refill por janela.
// Retorna true se a mensagem é permitida.
//
// Implementação fixed-window leve (1 msg a cada `per`, burst `burst`).
var rateLimitScript = redis.NewScript(`
local key = KEYS[1]
local burst = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local n = redis.call('INCR', key)
if n == 1 then
  redis.call('EXPIRE', key, ttl)
end
if n > burst then
  return 0
end
return 1
`)

// Allow aplica rate-limit por (sub,live). burst mensagens por janela de `per`.
func Allow(ctx context.Context, rdb *redis.Client, sub string, liveID int64, burst int, per time.Duration) bool {
	key := "rl:" + itoa(liveID) + ":" + sub
	res, err := rateLimitScript.Run(ctx, rdb, []string{key}, burst, int(per.Seconds())).Int()
	if err != nil {
		// fail-open em erro de infra para não derrubar o chat.
		return true
	}
	return res == 1
}
