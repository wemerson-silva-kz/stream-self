package chat

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/redis/go-redis/v9"

	"streamself/services/shared/auth"
)

const (
	maxBodyLen     = 500
	sendBuffer     = 64
	rateLimitBurst = 3
	rateLimitPer   = 6 * time.Second // ~1 msg / 2s sustentado, burst 3
)

// Server expõe o handler WebSocket.
type Server struct {
	hub      *Hub
	verifier *auth.Verifier
	rdb      *redis.Client
}

func NewServer(rdb *redis.Client, verifier *auth.Verifier) *Server {
	return &Server{hub: NewHub(rdb), verifier: verifier, rdb: rdb}
}

// inbound é o que o cliente envia.
type inbound struct {
	Type string `json:"t"`    // "msg"
	Body string `json:"body"`
}

// HandleWS: GET /ws?token=<jwt>&live=<id>
func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	claims, err := s.verifier.Parse(token)
	if err != nil || !claims.HasScope("chat") {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	liveID, err := parseLiveID(claims.Live)
	if err != nil {
		http.Error(w, "bad live", http.StatusBadRequest)
		return
	}

	if s.isBanned(r.Context(), liveID, claims.Sub) {
		http.Error(w, "banned", http.StatusForbidden)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		// Em produção restrinja OriginPatterns ao domínio do front.
		InsecureSkipVerify: true,
	})
	if err != nil {
		return
	}
	defer conn.CloseNow()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	c := &client{sub: claims.Sub, send: make(chan []byte, sendBuffer), cancel: cancel}
	if first := s.hub.add(liveID, c); first {
		go s.hub.runRedis(ctx, liveID)
	}
	defer s.hub.remove(liveID, c)

	// Presença: gauge de viewers (real) consumido pelas métricas do dashboard.
	s.rdb.Incr(ctx, viewersKey(liveID))
	s.rdb.Expire(ctx, viewersKey(liveID), 12*time.Hour)
	defer s.rdb.Decr(context.Background(), viewersKey(liveID))

	s.hub.Publish(ctx, Outbound{Type: "join", Live: liveID, TS: time.Now().Unix(),
		User: &UserRef{ID: claims.Sub, Name: claims.Name}})

	go s.writePump(ctx, conn, c)
	s.readPump(ctx, conn, c, claims, liveID)

	s.hub.Publish(ctx, Outbound{Type: "leave", Live: liveID, TS: time.Now().Unix(),
		User: &UserRef{ID: claims.Sub, Name: claims.Name}})
}

func (s *Server) writePump(ctx context.Context, conn *websocket.Conn, c *client) {
	for {
		select {
		case <-ctx.Done():
			return
		case payload := <-c.send:
			wctx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err := conn.Write(wctx, websocket.MessageText, payload)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

func (s *Server) readPump(ctx context.Context, conn *websocket.Conn, c *client, claims *auth.ViewerClaims, liveID int64) {
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var in inbound
		if json.Unmarshal(data, &in) != nil || in.Type != "msg" {
			continue
		}
		body := strings.TrimSpace(in.Body)
		if body == "" {
			continue
		}
		if len(body) > maxBodyLen {
			body = body[:maxBodyLen]
		}
		if !Allow(ctx, s.rdb, claims.Sub, liveID, rateLimitBurst, rateLimitPer) {
			continue // silenciosamente descarta msgs acima do limite
		}

		out := Outbound{
			Type: "msg",
			ID:   strconv.FormatInt(time.Now().UnixNano(), 36),
			Live: liveID,
			User: &UserRef{ID: claims.Sub, Name: claims.Name},
			Body: body,
			TS:   time.Now().Unix(),
		}
		s.hub.Publish(ctx, out)
		s.enqueuePersist(ctx, out) // grava async no Postgres via worker
		s.countMessage(ctx, liveID)
	}
}

// countMessage incrementa o contador de mensagens da janela de 1 minuto atual.
// As métricas (msgs/min) leem a janela corrente.
func (s *Server) countMessage(ctx context.Context, liveID int64) {
	minute := time.Now().Unix() / 60
	key := "msgs:" + itoa(liveID) + ":" + strconv.FormatInt(minute, 10)
	s.rdb.Incr(ctx, key)
	s.rdb.Expire(ctx, key, 2*time.Minute)
}

func viewersKey(liveID int64) string { return "viewers:" + itoa(liveID) }

// enqueuePersist empurra a mensagem para um Redis Stream consumido pelo worker.
func (s *Server) enqueuePersist(ctx context.Context, out Outbound) {
	uid := strings.TrimPrefix(out.User.ID, "user:")
	s.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: "chat:persist",
		MaxLen: 1_000_000,
		Approx: true,
		Values: map[string]any{
			"live": out.Live, "user": uid, "body": out.Body, "ts": out.TS,
		},
	})
}

func (s *Server) isBanned(ctx context.Context, liveID int64, sub string) bool {
	// Bans são empurrados pelo Laravel para um set Redis (global e por live).
	g, _ := s.rdb.SIsMember(ctx, "ban:global", sub).Result()
	if g {
		return true
	}
	l, _ := s.rdb.SIsMember(ctx, "ban:"+itoa(liveID), sub).Result()
	return l
}

func parseLiveID(s string) (int64, error) {
	return strconv.ParseInt(strings.TrimPrefix(s, "live:"), 10, 64)
}

var _ = log.Printf
