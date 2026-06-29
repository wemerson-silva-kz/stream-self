// Package ingest valida a stream_key e roda o pipeline FFmpeg (ABR -> LL-HLS).
package ingest

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Encoder seleciona o codec: "h264_nvenc" (GPU) ou "libx264" (CPU).
type Pipeline struct {
	MediaRoot string
	Encoder   string // h264_nvenc | libx264
	// SegmentSeconds: duração do segmento ao vivo. Menor = menor latência
	// (à custa de mais arquivos/overhead). Default 2.
	SegmentSeconds int
	// ListSize: nº de segmentos mantidos na playlist ao vivo = janela de DVR.
	// Maior = mais buffer p/ pausar/voltar (estilo YouTube). Default 30.
	ListSize int
}

func (p *Pipeline) segDur() int {
	if p.SegmentSeconds > 0 {
		return p.SegmentSeconds
	}
	return 2
}

func (p *Pipeline) listSize() int {
	if p.ListSize > 0 {
		return p.ListSize
	}
	return 30
}

// nextSegNumber devolve o próximo índice de segmento TS livre no diretório do
// VOD (maior seg_N.ts existente + 1), para continuar a gravação após reconexão.
func nextSegNumber(dir string) int {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	max := -1
	for _, e := range entries {
		var n int
		if _, err := fmt.Sscanf(e.Name(), "seg_%d.ts", &n); err == nil && n > max {
			max = n
		}
	}
	return max + 1
}

// cleanVodDir remove resíduos de uma gravação anterior (segmentos, init e
// playlists) para iniciar um VOD limpo.
func cleanVodDir(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		name := e.Name()
		if strings.HasSuffix(name, ".ts") || strings.HasSuffix(name, ".m4s") ||
			strings.HasSuffix(name, ".mp4") || strings.HasSuffix(name, ".m3u8") {
			_ = os.Remove(filepath.Join(dir, name))
		}
	}
}

// Variantes ABR: rótulo, escala, bitrate alvo (kbps).
var renditions = []struct {
	w, h, bitrate, maxrate, bufsize int
}{
	{1920, 1080, 5000, 5350, 7500},
	{1280, 720, 3000, 3210, 4500},
	{854, 480, 1200, 1285, 1800},
}

// Start dispara o FFmpeg para uma live, lendo do input (ex.: srt://... ou pipe)
// e escrevendo LL-HLS em MediaRoot/{liveID}/. Bloqueia até o processo terminar.
func (p *Pipeline) Start(ctx context.Context, liveID int64, input string) error {
	return p.run(ctx, liveID, []string{"-i", input}, nil)
}

// StartFLV roda o pipeline lendo um stream FLV de um io.Reader (usado pela ponte
// do servidor RTMP: go-rtmp -> FLV -> stdin do FFmpeg).
func (p *Pipeline) StartFLV(ctx context.Context, liveID int64, r io.Reader) error {
	return p.run(ctx, liveID, []string{"-f", "flv", "-i", "pipe:0"}, r)
}

func (p *Pipeline) run(ctx context.Context, liveID int64, inputArgs []string, stdin io.Reader) error {
	outDir := filepath.Join(p.MediaRoot, fmt.Sprintf("%d", liveID))
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	for i := range renditions {
		if err := os.MkdirAll(filepath.Join(outDir, fmt.Sprintf("%d", i)), 0o755); err != nil {
			return err
		}
	}
	// Diretório do VOD (gravação): playlist 'event', segmentos preservados.
	vodDir := filepath.Join(outDir, "vod")
	if err := os.MkdirAll(vodDir, 0o755); err != nil {
		return err
	}
	// Continuidade da gravação: se já há segmentos .ts, é uma RECONEXÃO — continua
	// de onde parou. Senão é um INÍCIO — limpa resíduos (inclui fmp4 legado) p/ um
	// playlist VOD limpo.
	vodStart := nextSegNumber(vodDir)
	if vodStart == 0 {
		cleanVodDir(vodDir)
	}

	enc := p.Encoder
	if enc == "" {
		enc = "libx264"
	}

	args := append([]string{"-hide_banner", "-loglevel", "warning"}, inputArgs...)
	args = append(args,
		"-filter_complex",
		"[0:v]split=5[v1][v2][v3][v4][v5];" +
			"[v1]scale=w=1920:h=1080[v1out];" +
			"[v2]scale=w=1280:h=720[v2out];" +
			"[v3]scale=w=854:h=480[v3out];" +
			"[v4]scale=w=1280:h=720[vodout];" +
			// branch de preview: frame pequeno (640px) ~1/s p/ thumbnail/poster
			"[v5]scale=w=640:h=-2,fps=1[previmg]",
	)
	for i, r := range renditions {
		args = append(args,
			"-map", fmt.Sprintf("[v%dout]", i+1),
			fmt.Sprintf("-c:v:%d", i), enc,
			fmt.Sprintf("-b:v:%d", i), fmt.Sprintf("%dk", r.bitrate),
			fmt.Sprintf("-maxrate:v:%d", i), fmt.Sprintf("%dk", r.maxrate),
			fmt.Sprintf("-bufsize:v:%d", i), fmt.Sprintf("%dk", r.bufsize),
		)
	}
	// GOP alinhado ao segmento (fechado) para ABR/seek limpos e baixa latência.
	gop := fmt.Sprintf("%d", p.segDur()*24)
	segT := fmt.Sprintf("%d", p.segDur())

	// 3 trilhas de áudio (uma por variante).
	args = append(args, "-map", "a:0", "-map", "a:0", "-map", "a:0",
		"-c:a", "aac", "-b:a", "128k", "-ac", "2",
		"-g", gop, "-keyint_min", gop, "-sc_threshold", "0",
		"-f", "hls", "-hls_time", segT, "-hls_list_size", fmt.Sprintf("%d", p.listSize()),
		"-hls_flags", "independent_segments+delete_segments+program_date_time",
		"-hls_segment_type", "fmp4",
		"-master_pl_name", "master.m3u8",
		"-hls_segment_filename", filepath.Join(outDir, "%v", "seg_%d.m4s"),
		"-var_stream_map", "v:0,a:0 v:1,a:1 v:2,a:2",
		filepath.Join(outDir, "%v", "index.m3u8"),
	)

	// Saída de GRAVAÇÃO (VOD): 720p, playlist 'event' (cresce, nunca deleta).
	// CONTINUIDADE entre reconexões do OBS: usamos MPEG-TS (segmentos auto-
	// contidos, sem init.mp4 compartilhado) + append_list + start_number a partir
	// do último segmento já gravado — assim uma queda/reconexão NÃO apaga o que
	// já foi gravado; o replay continua de onde parou (vodStart calculado acima).
	args = append(args,
		"-map", "[vodout]", "-map", "a:0",
		"-c:v", enc, "-b:v", "3000k", "-maxrate", "3210k", "-bufsize", "4500k",
		"-c:a", "aac", "-b:a", "128k", "-ac", "2",
		"-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
		"-f", "hls", "-hls_time", "4", "-hls_playlist_type", "event",
		"-hls_flags", "independent_segments+program_date_time+append_list+omit_endlist",
		"-hls_segment_type", "mpegts",
		"-start_number", fmt.Sprintf("%d", vodStart),
		"-master_pl_name", "master.m3u8",
		"-hls_segment_filename", filepath.Join(vodDir, "seg_%d.ts"),
		filepath.Join(vodDir, "index.m3u8"),
	)

	// Saída de PREVIEW: um único JPEG (preview.jpg) atualizado ~1x/s — usado
	// como poster/thumbnail público da live (sem áudio).
	args = append(args,
		"-map", "[previmg]", "-an",
		"-f", "image2", "-update", "1", "-q:v", "6", "-y",
		filepath.Join(outDir, "preview.jpg"),
	)

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Stdin = stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
