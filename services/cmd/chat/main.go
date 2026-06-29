// Comando chat: serviço WebSocket de chat em tempo real.
package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"streamself/services/internal/chat"
	"streamself/services/shared/auth"
	"streamself/services/shared/config"
)

func main() {
	addr := config.Env("CHAT_ADDR", ":8082")
	redisAddr := config.Env("REDIS_ADDR", "localhost:6379")

	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("chat: redis indisponível: %v", err)
	}

	verifier, err := auth.VerifierFromEnv()
	if err != nil {
		log.Fatalf("chat: jwt verifier: %v", err)
	}
	srv := chat.NewServer(rdb, verifier)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", srv.HandleWS)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	httpSrv := &http.Server{Addr: addr, Handler: mux}
	go func() {
		log.Printf("chat: ouvindo em %s (redis=%s)", addr, redisAddr)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("chat: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	log.Println("chat: encerrado")
}
