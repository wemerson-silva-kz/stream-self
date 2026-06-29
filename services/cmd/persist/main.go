// Comando persist: consome o Redis Stream "chat:persist" e grava mensagens em
// lote no Postgres (histórico/moderação). Mantém o chat fora do caminho do DB.
package main

import (
	"context"
	"log"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"streamself/services/shared/config"
)

const (
	stream    = "chat:persist"
	group     = "persist"
	consumer  = "persist-1"
	batchSize = 500
	flushTick = 200 * time.Millisecond
)

type row struct {
	id   string
	live int64
	user *int64
	body string
	ts   time.Time
}

func main() {
	redisAddr := config.Env("REDIS_ADDR", "localhost:6379")
	pgDSN := config.Env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/streamself")

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	// Cria o consumer group (ignora erro se já existir).
	rdb.XGroupCreateMkStream(ctx, stream, group, "0")

	pool, err := pgxpool.New(ctx, pgDSN)
	if err != nil {
		log.Fatalf("persist: postgres: %v", err)
	}
	defer pool.Close()

	log.Printf("persist: consumindo %s (batch=%d)", stream, batchSize)

	buf := make([]row, 0, batchSize)
	ticker := time.NewTicker(flushTick)
	defer ticker.Stop()

	flush := func() {
		if len(buf) == 0 {
			return
		}
		if err := insertBatch(ctx, pool, buf); err != nil {
			log.Printf("persist: insert: %v", err)
			return // não dá ACK; reprocessa depois
		}
		ids := make([]string, len(buf))
		for i, r := range buf {
			ids[i] = r.id
		}
		rdb.XAck(ctx, stream, group, ids...)
		buf = buf[:0]
	}

	for {
		select {
		case <-ctx.Done():
			flush()
			log.Println("persist: encerrado")
			return
		case <-ticker.C:
			flush()
		default:
			res, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
				Group:    group,
				Consumer: consumer,
				Streams:  []string{stream, ">"},
				Count:    batchSize,
				Block:    flushTick,
			}).Result()
			if err != nil && err != redis.Nil {
				continue
			}
			for _, s := range res {
				for _, m := range s.Messages {
					buf = append(buf, parse(m))
					if len(buf) >= batchSize {
						flush()
					}
				}
			}
		}
	}
}

func parse(m redis.XMessage) row {
	r := row{id: m.ID, body: str(m.Values["body"]), ts: time.Now()}
	r.live, _ = strconv.ParseInt(str(m.Values["live"]), 10, 64)
	if u := str(m.Values["user"]); u != "" {
		if n, err := strconv.ParseInt(u, 10, 64); err == nil {
			r.user = &n
		}
	}
	if tsStr := str(m.Values["ts"]); tsStr != "" {
		if sec, err := strconv.ParseInt(tsStr, 10, 64); err == nil {
			r.ts = time.Unix(sec, 0)
		}
	}
	return r
}

func insertBatch(ctx context.Context, pool *pgxpool.Pool, rows []row) error {
	b := make([][]any, len(rows))
	for i, r := range rows {
		b[i] = []any{r.live, r.user, r.body, r.ts}
	}
	_, err := pool.CopyFrom(ctx,
		pgx.Identifier{"chat_messages"},
		[]string{"live_id", "user_id", "body", "created_at"},
		pgx.CopyFromRows(b),
	)
	return err
}

func str(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
