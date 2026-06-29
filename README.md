# stream-self — Plataforma de Streaming Self-Host

Live para assinantes com chat em tempo real, freemium configurável (20-30 min) e
escala para 5k→20k viewers por live. Ver [ARQUITETURA.md](ARQUITETURA.md) para o
desenho completo.

## Stack

| Camada | Tecnologia | Papel |
|---|---|---|
| Control plane | **Laravel 12 + Inertia + React** (`apps/web`) | auth, billing, admin, emissão de JWT |
| Vídeo | **Go origin** (`services/cmd/origin`) | serve LL-HLS + **paywall** por segmento |
| Ingest | **Go ingest + FFmpeg** (`services/cmd/ingest`) | RTMP/SRT → ABR → LL-HLS |
| Chat | **Go chat** (`services/cmd/chat`) | WebSocket + Redis Pub/Sub |
| Persistência chat | **Go persist** (`services/cmd/persist`) | Redis Stream → Postgres em lote |
| Estado quente | **Redis** | watch-time, presença, pub/sub, bans |
| Dados | **Postgres** (prod) / SQLite (dev) | users, planos, assinaturas, lives |
| Edge | **Nginx** (`deploy/nginx`) | cache de segmentos LL-HLS |

> **Regra de ouro:** Laravel nunca fica no caminho do vídeo nem do chat. Só
> autentica e emite o JWT. Todo tráfego de alta frequência é Go.

## Estrutura

```
apps/web/          Laravel + Inertia + React (control plane)
services/
  cmd/{chat,origin,ingest,persist}/   binários Go
  internal/{chat,origin,ingest}/      lógica
  shared/{auth,config}/               JWT + env
deploy/            docker-compose + nginx
ARQUITETURA.md     desenho detalhado
```

## Rodar em desenvolvimento

### 1. Control plane (Laravel)
```bash
cd apps/web
composer install && npm install
php artisan migrate:fresh --seed   # cria plano, live demo e stream_key
npm run dev                        # Vite
php artisan serve                  # http://localhost:8000
```

Validar a emissão de token:
```bash
php artisan stream:probe
```

### 2. Plano de dados (Go) — precisa de Go 1.23 + Docker
```bash
cd services
go mod tidy        # baixa coder/websocket, go-redis, golang-jwt, pgx
go build ./...     # compila os 4 binários

cd ../deploy
docker compose up --build   # postgres, redis, chat, origin, persist, ingest, edge
```

### 3. Transmitir (OBS)
- Servidor: `srt://SEU_IP:9000?streamid=<stream_key>`
- Pegue a `stream_key` no banco (tabela `stream_keys`, live demo já tem uma).

### 4. Assistir
1. Front pede `GET /api/live/{id}/token` → recebe JWT + `playback_url` + `chat_ws_url`.
2. Player (hls.js) toca `playback_url` mandando `?token=<jwt>`.
3. Chat conecta em `chat_ws_url?token=<jwt>&live=<id>`.
4. Free: após `freemium_seconds` o origin responde 403 e empurra evento `paywall`
   pelo WS → React mostra modal de upgrade.

## Variáveis-chave (compartilhadas Laravel ↔ Go)

| Var | Onde | Nota |
|---|---|---|
| `STREAM_JWT_SECRET` | ambos | **deve ser idêntico**; HS256 exige ≥ 32 bytes |
| `INTERNAL_SECRET` | Laravel + ingest | autentica a rota `/internal/stream-keys/resolve` |
| `STREAM_GLOBAL_FREEMIUM_SECONDS` | Laravel | fallback; live/plano têm precedência |
| `MEDIA_ROOT` | origin + ingest | diretório dos segmentos LL-HLS |

## Estado atual

✅ Schema + models + migrations + seed
✅ Emissão de JWT de viewer (tier/fsec resolvidos live > plano > global) — **testado**
✅ Serviços Go: chat (WS+pubsub+ratelimit), origin (paywall), ingest (FFmpeg ABR), persist
✅ docker-compose + nginx edge

### Próximos passos sugeridos
- [ ] Player React (hls.js) + UI de chat + modal de paywall (Inertia pages)
- [ ] Packager LL-HLS real em Go (partial segments `EXT-X-PART`) no origin
- [ ] Servidor RTMP (`yutopp/go-rtmp`) no ingest além do SRT
- [ ] Webhooks de billing → ativa subscription → publica `tier_upgrade` no Redis
- [ ] Painel admin (criar live, rotacionar stream_key, moderar chat)
- [ ] Trocar dev p/ Postgres + RS256 (Laravel assina, Go só valida c/ pública)
