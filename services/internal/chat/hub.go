// Package chat implementa o hub de WebSocket por live com fan-out via Redis Pub/Sub.
package chat

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"github.com/redis/go-redis/v9"
)

// Outbound é a mensagem entregue aos clientes (e trafegada no Redis).
type Outbound struct {
	Type string          `json:"t"`              // msg | join | leave | paywall | mod_delete | system
	ID   string          `json:"id,omitempty"`   // snowflake/uuid
	Live int64           `json:"live"`
	User *UserRef        `json:"u,omitempty"`
	Body string          `json:"body,omitempty"`
	TS   int64           `json:"ts"`
	Meta json.RawMessage `json:"meta,omitempty"` // p/ paywall/mod targeting
}

type UserRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// client é uma conexão WS local a este nó.
type client struct {
	sub    string // identidade do viewer (user:123 / anon:...)
	send   chan []byte
	cancel context.CancelFunc // encerra a conexão (ban ao vivo)
}

// Hub agrega clientes por live e cuida do fan-out local + Redis.
type Hub struct {
	rdb *redis.Client

	mu    sync.RWMutex
	rooms map[int64]map[*client]struct{} // liveID -> conjunto de clientes
}

func NewHub(rdb *redis.Client) *Hub {
	return &Hub{rdb: rdb, rooms: make(map[int64]map[*client]struct{})}
}

func channel(liveID int64) string {
	return "live:" + itoa(liveID)
}

// Subscribe registra uma conexão local; garante uma única goroutine de Redis
// por live neste nó.
func (h *Hub) add(liveID int64, c *client) (firstInRoom bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room, ok := h.rooms[liveID]
	if !ok {
		room = make(map[*client]struct{})
		h.rooms[liveID] = room
		ok = false
	}
	room[c] = struct{}{}
	return !ok
}

func (h *Hub) remove(liveID int64, c *client) (roomEmpty bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room := h.rooms[liveID]
	if room == nil {
		return true
	}
	delete(room, c)
	if len(room) == 0 {
		delete(h.rooms, liveID)
		return true
	}
	return false
}

// fanoutLocal entrega um payload já serializado a todos os clientes locais da live.
func (h *Hub) fanoutLocal(liveID int64, payload []byte) {
	h.mu.RLock()
	room := h.rooms[liveID]
	for c := range room {
		select {
		case c.send <- payload:
		default:
			// cliente lento: descarta (backpressure) em vez de bloquear o fan-out.
		}
	}
	h.mu.RUnlock()
}

// runRedis assina o canal da live e replica para os clientes locais.
// Roda uma vez por live ativa neste nó. Eventos de moderação ("ban") também
// derrubam a conexão local do alvo.
func (h *Hub) runRedis(ctx context.Context, liveID int64) {
	pubsub := h.rdb.Subscribe(ctx, channel(liveID))
	defer pubsub.Close()
	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			payload := []byte(msg.Payload)
			h.maybeEnforce(liveID, payload)
			h.fanoutLocal(liveID, payload)
		}
	}
}

// maybeEnforce inspeciona eventos de moderação e aplica efeitos locais.
// ban -> derruba as conexões do sub alvo neste nó.
func (h *Hub) maybeEnforce(liveID int64, payload []byte) {
	var evt struct {
		Type string `json:"t"`
		Meta struct {
			Target string `json:"target"`
		} `json:"meta"`
	}
	if json.Unmarshal(payload, &evt) != nil || evt.Type != "ban" || evt.Meta.Target == "" {
		return
	}
	h.mu.RLock()
	for c := range h.rooms[liveID] {
		if c.sub == evt.Meta.Target && c.cancel != nil {
			c.cancel()
		}
	}
	h.mu.RUnlock()
}

// Publish envia uma mensagem para TODOS os nós (via Redis).
func (h *Hub) Publish(ctx context.Context, out Outbound) {
	payload, err := json.Marshal(out)
	if err != nil {
		log.Printf("chat: marshal: %v", err)
		return
	}
	if err := h.rdb.Publish(ctx, channel(out.Live), payload).Err(); err != nil {
		log.Printf("chat: publish: %v", err)
	}
}
