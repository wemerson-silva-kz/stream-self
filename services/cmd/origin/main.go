// Comando origin: serve LL-HLS e aplica o paywall freemium.
package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"streamself/services/internal/origin"
	"streamself/services/shared/auth"
	"streamself/services/shared/config"
)

func main() {
	addr := config.Env("ORIGIN_ADDR", ":8081")
	redisAddr := config.Env("REDIS_ADDR", "localhost:6379")
	mediaRoot := config.Env("MEDIA_ROOT", "/srv/media")

	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	verifier, err := auth.VerifierFromEnv()
	if err != nil {
		log.Fatalf("origin: jwt verifier: %v", err)
	}
	srv := origin.NewServer(mediaRoot, rdb, verifier)
	httpSrv := &http.Server{Addr: addr, Handler: srv}

	go func() {
		log.Printf("origin: ouvindo em %s (media=%s)", addr, mediaRoot)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("origin: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	log.Println("origin: encerrado")
}
