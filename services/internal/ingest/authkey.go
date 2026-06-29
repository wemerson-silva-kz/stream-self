package ingest

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"time"
)

// KeyResolver valida a stream_key contra o Laravel (rota interna) e devolve o
// live_id correspondente.
type KeyResolver struct {
	BaseURL string // ex.: http://web/internal
	Secret  string // header compartilhado p/ autenticar o serviço Go
	client  *http.Client
}

func NewKeyResolver(baseURL, secret string) *KeyResolver {
	return &KeyResolver{BaseURL: baseURL, Secret: secret, client: &http.Client{Timeout: 5 * time.Second}}
}

type resolveResp struct {
	LiveID int64 `json:"live_id"`
	Valid  bool  `json:"valid"`
}

// Resolve devolve (liveID, ok). ok=false se a chave for inválida/revogada.
func (k *KeyResolver) Resolve(ctx context.Context, streamKey string) (int64, bool) {
	u := k.BaseURL + "/stream-keys/resolve?key=" + url.QueryEscape(streamKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return 0, false
	}
	req.Header.Set("X-Internal-Secret", k.Secret)

	resp, err := k.client.Do(req)
	if err != nil {
		return 0, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, false
	}
	var r resolveResp
	if json.NewDecoder(resp.Body).Decode(&r) != nil {
		return 0, false
	}
	return r.LiveID, r.Valid
}
