// Comando ingest: recebe a stream do OBS (SRT), valida a chave e roda o FFmpeg.
//
// Esqueleto: aqui demonstramos o caminho SRT via listener externo. O servidor
// RTMP completo (yutopp/go-rtmp) entra como evolução; o contrato (Resolve +
// Pipeline.Start) já está pronto.
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"streamself/services/internal/ingest"
	"streamself/services/shared/config"
)

func main() {
	mediaRoot := config.Env("MEDIA_ROOT", "/srv/media")
	encoder := config.Env("FFMPEG_ENCODER", "libx264") // ou h264_nvenc
	internalURL := config.Env("LARAVEL_INTERNAL_URL", "http://localhost:8000/internal")
	internalSecret := config.Env("INTERNAL_SECRET", "change-me")

	// streamKey vem do streamid do SRT (?streamid=) ou do app/key do RTMP.
	streamKey := os.Getenv("STREAM_KEY")
	input := config.Env("INGEST_INPUT", "srt://0.0.0.0:9000?mode=listener")

	if streamKey == "" {
		log.Fatal("ingest: STREAM_KEY ausente (normalmente extraído da conexão)")
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	resolver := ingest.NewKeyResolver(internalURL, internalSecret)
	liveID, ok := resolver.Resolve(ctx, streamKey)
	if !ok {
		log.Fatalf("ingest: stream_key inválida")
	}
	log.Printf("ingest: chave válida, live=%d, iniciando FFmpeg (%s)", liveID, encoder)

	pipe := &ingest.Pipeline{MediaRoot: mediaRoot, Encoder: encoder}
	if err := pipe.Start(ctx, liveID, input); err != nil {
		log.Fatalf("ingest: pipeline encerrou: %v", err)
	}
}
