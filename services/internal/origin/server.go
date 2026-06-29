package origin

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"streamself/services/shared/auth"
)

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

// Server serve os arquivos LL-HLS de mediaRoot/{liveID}/... aplicando o paywall.
type Server struct {
	mediaRoot string
	verifier  *auth.Verifier
	paywall   *Paywall
}

func NewServer(mediaRoot string, rdb *redis.Client, verifier *auth.Verifier) *Server {
	return &Server{mediaRoot: mediaRoot, verifier: verifier, paywall: NewPaywall(rdb)}
}

// ServeHTTP roteia: /live/{id}/master.m3u8, /live/{id}/{variant}/index.m3u8,
// /live/{id}/{variant}/seg_*.m4s
//
// Playlists (.m3u8) liberadas com token válido; cada segmento (.m4s) passa pelo
// paywall quando o tier é free.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// CORS: o player (hls.js) roda no domínio do front e busca os segmentos aqui.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization,Range")
	w.Header().Set("Access-Control-Expose-Headers", "X-Paywall")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.URL.Path == "/healthz" {
		w.WriteHeader(http.StatusOK)
		return
	}

	rel := strings.TrimPrefix(r.URL.Path, "/live/")
	parts := strings.SplitN(rel, "/", 2)
	if len(parts) < 2 {
		http.NotFound(w, r)
		return
	}
	liveID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Thumbnail/poster PÚBLICO (preview.jpg): baixa resolução, sem token —
	// usado na home/cards mesmo para quem não está logado.
	if parts[1] == "preview.jpg" {
		clean := filepath.Clean(filepath.Join(s.mediaRoot, parts[0], "preview.jpg"))
		if !strings.HasPrefix(clean, filepath.Clean(s.mediaRoot)) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		f, err := os.Open(clean)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Cache-Control", "no-cache") // atualiza ~1x/s
		http.ServeContent(w, r, clean, fileModTime(f), f)
		return
	}

	// Token via header (player) ou query (?token=).
	token := bearer(r)
	claims, err := s.verifier.Parse(token)
	if err != nil || !claims.HasScope("watch") || claims.Live != "live:"+itoa(liveID) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	isSegment := strings.HasSuffix(r.URL.Path, ".m4s") || strings.HasSuffix(r.URL.Path, ".mp4")
	if isSegment && claims.Tier != "paid" {
		ok, _ := s.paywall.Allow(r.Context(), liveID, claims.Sub, claims.Fsec)
		if !ok {
			s.paywall.SignalPaywall(r.Context(), liveID, claims.Sub)
			w.Header().Set("X-Paywall", "hit")
			http.Error(w, "freemium expirado", http.StatusForbidden)
			return
		}
	}

	// Sirva o arquivo do disco (origin). Em produção o Nginx/Varnish faz cache
	// dos segmentos; este handler é a origem autoritativa do paywall.
	clean := filepath.Clean(filepath.Join(s.mediaRoot, parts[0], parts[1]))
	if !strings.HasPrefix(clean, filepath.Clean(s.mediaRoot)) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	f, err := os.Open(clean)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	if strings.HasSuffix(r.URL.Path, ".m3u8") {
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		w.Header().Set("Cache-Control", "no-cache") // playlists mudam sempre
	} else {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	http.ServeContent(w, r, clean, fileModTime(f), f)
}

func bearer(r *http.Request) string {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	return r.URL.Query().Get("token")
}

func fileModTime(f *os.File) time.Time {
	if fi, err := f.Stat(); err == nil {
		return fi.ModTime()
	}
	return time.Time{}
}
