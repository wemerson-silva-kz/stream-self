// Comando ingest: recebe a transmissão do OBS, valida a stream key e roda o
// FFmpeg (ABR -> LL-HLS).
//
// Dois modos (INGEST_MODE):
//   - rtmp (default): servidor RTMP em Go (yutopp/go-rtmp) na porta :1935.
//     A stream key vem do "stream key" do OBS; cada publish dispara um FFmpeg.
//   - srt: lê um único stream SRT (STREAM_KEY no ambiente) — útil p/ testes.
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
	mode := config.Env("INGEST_MODE", "rtmp")
	mediaRoot := config.Env("MEDIA_ROOT", "/srv/media")
	encoder := config.Env("FFMPEG_ENCODER", "libx264") // ou h264_nvenc
	internalURL := config.Env("LARAVEL_INTERNAL_URL", "http://localhost:8000/internal")
	internalSecret := config.Env("INTERNAL_SECRET", "change-me")

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	resolver := ingest.NewKeyResolver(internalURL, internalSecret)
	pipe := &ingest.Pipeline{
		MediaRoot:      mediaRoot,
		Encoder:        encoder,
		SegmentSeconds: config.EnvInt("HLS_TIME", 2),
		ListSize:       config.EnvInt("HLS_LIST_SIZE", 30),
	}

	switch mode {
	case "rtmp":
		addr := config.Env("RTMP_ADDR", ":1935")
		srv := &ingest.RTMPServer{Addr: addr, Resolver: resolver, Pipeline: pipe}
		log.Printf("ingest: servidor RTMP em %s (encoder=%s)", addr, encoder)
		if err := srv.ListenAndServe(ctx); err != nil && ctx.Err() == nil {
			log.Fatalf("ingest: rtmp: %v", err)
		}

	case "srt":
		streamKey := os.Getenv("STREAM_KEY")
		input := config.Env("INGEST_INPUT", "srt://0.0.0.0:9000?mode=listener")
		if streamKey == "" {
			log.Fatal("ingest(srt): STREAM_KEY ausente")
		}
		liveID, ok := resolver.Resolve(ctx, streamKey)
		if !ok {
			log.Fatalf("ingest(srt): stream_key inválida")
		}
		log.Printf("ingest(srt): chave válida, live=%d, iniciando FFmpeg", liveID)
		if err := pipe.Start(ctx, liveID, input); err != nil {
			log.Fatalf("ingest(srt): pipeline encerrou: %v", err)
		}

	default:
		log.Fatalf("ingest: INGEST_MODE desconhecido: %s", mode)
	}
}
