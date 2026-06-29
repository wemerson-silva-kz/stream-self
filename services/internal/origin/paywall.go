// Package origin serve LL-HLS e aplica o paywall freemium por segmento.
package origin

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// secondsPerSegment é o "peso" de tempo creditado a cada segmento servido.
// Deve casar com -hls_time do FFmpeg (2s).
const secondsPerSegment = 2

// liveTTL: janela de vida das chaves de watch-time (limpeza automática).
const liveTTL = 12 * time.Hour

// Paywall rastreia o tempo assistido por usuário free.
type Paywall struct {
	rdb *redis.Client
}

func NewPaywall(rdb *redis.Client) *Paywall {
	return &Paywall{rdb: rdb}
}

// Allow credita um segmento e diz se o usuário free ainda pode assistir.
// Retorna (permitido, segundosAssistidos).
//
// Contagem por segmento SERVIDO (resistente a pause/seek). fsec=0 desativa o
// freemium (bloqueia logo de cara); tier=paid nunca chama isto.
func (p *Paywall) Allow(ctx context.Context, liveID int64, sub string, fsec int) (bool, int) {
	key := "watch:" + itoa(liveID) + ":" + sub
	watched, err := p.rdb.IncrBy(ctx, key, secondsPerSegment).Result()
	if err != nil {
		// fail-open: problemas de infra não devem cortar o vídeo de quem paga atenção.
		return true, 0
	}
	if watched == secondsPerSegment {
		p.rdb.Expire(ctx, key, liveTTL)
	}
	return int(watched) <= fsec, int(watched)
}

// SignalPaywall publica um evento para o chat-node empurrar o modal ao usuário.
func (p *Paywall) SignalPaywall(ctx context.Context, liveID int64, sub string) {
	p.rdb.Publish(ctx, "live:"+itoa(liveID),
		`{"t":"paywall","live":`+itoa(liveID)+`,"meta":{"target":"`+sub+`"}}`)
}
