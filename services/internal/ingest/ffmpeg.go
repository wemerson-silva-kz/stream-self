// Package ingest valida a stream_key e roda o pipeline FFmpeg (ABR -> LL-HLS).
package ingest

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Encoder seleciona o codec: "h264_nvenc" (GPU) ou "libx264" (CPU).
type Pipeline struct {
	MediaRoot string
	Encoder   string // h264_nvenc | libx264
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
	outDir := filepath.Join(p.MediaRoot, fmt.Sprintf("%d", liveID))
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	for i := range renditions {
		if err := os.MkdirAll(filepath.Join(outDir, fmt.Sprintf("%d", i)), 0o755); err != nil {
			return err
		}
	}

	enc := p.Encoder
	if enc == "" {
		enc = "libx264"
	}

	args := []string{"-hide_banner", "-loglevel", "warning", "-i", input,
		"-filter_complex",
		"[0:v]split=3[v1][v2][v3];" +
			"[v1]scale=w=1920:h=1080[v1out];" +
			"[v2]scale=w=1280:h=720[v2out];" +
			"[v3]scale=w=854:h=480[v3out]",
	}
	for i, r := range renditions {
		args = append(args,
			"-map", fmt.Sprintf("[v%dout]", i+1),
			fmt.Sprintf("-c:v:%d", i), enc,
			fmt.Sprintf("-b:v:%d", i), fmt.Sprintf("%dk", r.bitrate),
			fmt.Sprintf("-maxrate:v:%d", i), fmt.Sprintf("%dk", r.maxrate),
			fmt.Sprintf("-bufsize:v:%d", i), fmt.Sprintf("%dk", r.bufsize),
		)
	}
	// 3 trilhas de áudio (uma por variante).
	args = append(args, "-map", "a:0", "-map", "a:0", "-map", "a:0",
		"-c:a", "aac", "-b:a", "128k", "-ac", "2",
		"-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
		"-f", "hls", "-hls_time", "2", "-hls_list_size", "6",
		"-hls_flags", "independent_segments+delete_segments+program_date_time",
		"-hls_segment_type", "fmp4",
		"-master_pl_name", "master.m3u8",
		"-hls_segment_filename", filepath.Join(outDir, "%v", "seg_%d.m4s"),
		"-var_stream_map", "v:0,a:0 v:1,a:1 v:2,a:2",
		filepath.Join(outDir, "%v", "index.m3u8"),
	)

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
