# Plataforma de Streaming Self-Host — Arquitetura

Stack: **Go** (vídeo + chat, plano de dados) · **Laravel + React/Inertia** (control plane) ·
**Postgres** (persistência) · **Redis** (estado quente + pub/sub) · **LL-HLS** (entrega) ·
**OBS RTMP/SRT** (ingest) · **VPS bare metal** (Hetzner-style).

Meta: 1 live em destaque + multi-live, freemium configurável (20-30 min), 5k→20k viewers/live.

---

## 1. Esquema do banco + contrato do JWT de viewer

### Tabelas (Postgres)

```sql
-- usuários e auth (Laravel)
users(
  id BIGINT PK, name, email UNIQUE, password,
  created_at, updated_at
)

plans(
  id PK, slug UNIQUE,            -- free | basic | premium
  name, price_cents INT, currency,
  features JSONB,               -- {"hd": true, "multi_live": true}
  freemium_seconds INT NULL,    -- override global do paywall por plano
  created_at, updated_at
)

subscriptions(
  id PK, user_id FK, plan_id FK,
  status,                       -- active | past_due | canceled
  provider,                     -- stripe | cakto ...
  provider_ref,                 -- id externo
  current_period_end TIMESTAMP,
  created_at, updated_at
)
-- index: (user_id, status)

lives(
  id PK, owner_id FK(users),
  title, slug UNIQUE, description,
  status,                       -- offline | live | ended
  visibility,                   -- public | subscribers
  freemium_seconds INT NULL,    -- override por live (precede o do plano)
  is_featured BOOL,             -- a "1 live" em destaque
  started_at, ended_at,
  created_at, updated_at
)
-- index: (status), (is_featured) WHERE is_featured

stream_keys(
  id PK, live_id FK UNIQUE,
  key TEXT UNIQUE,              -- segredo do OBS; rotacionável
  revoked_at TIMESTAMP NULL,
  created_at
)

chat_messages(
  id BIGINT PK, live_id FK, user_id FK,
  body TEXT, created_at,
  deleted_at TIMESTAMP NULL     -- moderação (soft delete)
)
-- index: (live_id, id) p/ paginação de histórico

chat_bans(
  id PK, live_id FK NULL,       -- NULL = ban global
  user_id FK, reason, until TIMESTAMP NULL, created_at
)
```

> Mensagens NÃO são gravadas de forma síncrona pelo chat Go no caminho quente.
> O Go publica no Redis e um worker grava em lote no Postgres (histórico/moderação).

### Contrato do JWT de viewer

Laravel emite ao entrar na live. Curto, assinado (HS256 com segredo compartilhado, ou
RS256 se quiser que o Go só tenha a chave pública).

```jsonc
// Header: { "alg": "HS256", "typ": "JWT" }
{
  "sub": "user:12345",        // id do viewer (ou "anon:<uuid>" p/ não logado)
  "live": "live:678",
  "tier": "free",             // free | paid  (derivado da subscription ativa)
  "fsec": 1800,               // freemium_seconds resolvido p/ esta live (live > plan > global)
  "scope": "watch chat",      // o que pode fazer
  "iat": 1750000000,
  "exp": 1750003600           // ~1h; renovável via /token/refresh no Laravel
}
```

Resolução de `tier`/`fsec` no Laravel ao emitir:
`fsec = live.freemium_seconds ?? plan.freemium_seconds ?? GLOBAL_FREEMIUM_SECONDS`.
`tier = subscription ativa que cobre a live ? "paid" : "free"`.

**Token de segmento** (separado, vida ~30s) é emitido pelo edge Go ao validar o JWT,
embutido na playlist, para impedir hot-linking das URLs de `.m4s`.

---

## 2. Serviço Go de chat (realtime)

### Topologia

```
viewer ──WS──▶ [chat-node A] ─┐
viewer ──WS──▶ [chat-node A]  ├─publish─▶ Redis Pub/Sub (canal: live:{id})
viewer ──WS──▶ [chat-node B] ─┘            │
                                  subscribe ▼
                          cada nó faz fan-out local p/ suas conexões
```

- Conexões: `gobwas/ws` (1 goroutine de leitura + epoll p/ escrita, ~poucos KB/conn).
  20k conns ≈ ~1 nó; deixe 2-3 p/ folga + HA.
- Estado de presença e rate-limit: Redis (`live:{id}:online` set, contadores por user).
- Cada nó: ao receber msg do cliente →
  1. valida JWT (`scope` contém `chat`, não banido)
  2. rate-limit (token bucket no Redis: ex. 1 msg / 2s, burst 3)
  3. `PUBLISH live:{id} {payload}`
  4. enfileira p/ persistência (Redis Stream `chat:persist`)
- Worker separado consome `chat:persist` → `INSERT` em lote no Postgres (a cada 200ms/500 msgs).

### Estrutura de pastas (serviço Go chat)

```
services/chat/
  cmd/chat/main.go
  internal/
    ws/          # upgrade, hub por live, fan-out
    auth/        # validação JWT viewer
    ratelimit/   # token bucket Redis
    pubsub/      # wrapper Redis pub/sub
    presence/    # online set + heartbeat
    persist/     # consumer do stream -> Postgres batch
  go.mod
```

### Payload de mensagem

```jsonc
{ "t": "msg", "id": "snowflake", "live": 678, "u": {"id":12345,"name":"Ana"},
  "body": "olá", "ts": 1750000000 }
// outros tipos: "join", "leave", "paywall", "mod_delete", "system"
```

### Anti-abuso / moderação
- Rate-limit no servidor (acima). Mensagens > N chars truncadas.
- Comandos de mod via REST no Laravel → publica `mod_delete`/`ban` no Redis → nós aplicam.
- Em picos (20k msgs/s ilegível), ative **modo agregado**: nós amostram/coalescem e
  enviam batches a cada 250ms ao cliente em vez de 1-a-1.

---

## 3. Ingest + transcode (LL-HLS, multi-live)

### Fluxo

```
OBS ──RTMP/SRT──▶ [ingest Go] ──valida stream_key──▶ FFmpeg (ABR) ──▶ LL-HLS no disco/origin
```

- Servidor RTMP/SRT em Go (ex.: `yutopp/go-rtmp` p/ RTMP; SRT via lib C ou processo `srt-live-transmit`).
- Ao conectar, extrai `stream_key` → consulta Laravel/DB → se válido e não revogado,
  marca `live.status = live` e dispara FFmpeg. Senão, derruba a conexão.
- 1 live = 1 pipeline FFmpeg. Multi-live = N pipelines; escala por nó (CPU) ou GPU NVENC.

### Comando FFmpeg ABR + LL-HLS

```bash
ffmpeg -i "srt://0.0.0.0:9000?streamid=<key>" \
  -filter_complex "[0:v]split=3[v1][v2][v3]; \
    [v1]scale=w=1920:h=1080[v1out]; \
    [v2]scale=w=1280:h=720[v2out]; \
    [v3]scale=w=854:h=480[v3out]" \
  -map "[v1out]" -c:v:0 h264_nvenc -b:v:0 5000k -maxrate:v:0 5350k -bufsize:v:0 7500k \
  -map "[v2out]" -c:v:1 h264_nvenc -b:v:1 3000k -maxrate:v:1 3210k -bufsize:v:1 4500k \
  -map "[v3out]" -c:v:2 h264_nvenc -b:v:2 1200k -maxrate:v:2 1285k -bufsize:v:2 1800k \
  -map a:0 -map a:0 -map a:0 -c:a aac -b:a 128k -ac 2 \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  -f hls -hls_time 2 -hls_list_size 6 \
  -hls_flags independent_segments+delete_segments+program_date_time \
  -lhls 1 -hls_segment_type fmp4 \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "out/%v/seg_%d.m4s" \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
  "out/%v/index.m3u8"
```

LL-HLS de verdade exige **partial segments** (`#EXT-X-PART`) e blocking playlist reload.
Se o FFmpeg da distro não tiver suporte LL-HLS completo, o **origin Go** gera as partes
parciais e o `EXT-X-PRELOAD-HINT` — recomendado fazer o packager em Go para controle total.

### Layout em disco / origin

```
out/{live_id}/
  master.m3u8           # multivariant (1080/720/480)
  0/index.m3u8  seg_*.m4s  init.mp4   # 1080p
  1/index.m3u8  ...                   # 720p
  2/index.m3u8  ...                   # 480p
```

Limpeza: `delete_segments` + janela curta (`hls_list_size 6`). DVR/replay opcional grava
cópia para storage e gera VOD pós-live.

---

## 4. Paywall freemium end-to-end

```
1. Viewer abre /live/{slug} (React/Inertia)
2. React pede JWT: GET /api/live/{id}/token  (Laravel)
   -> Laravel resolve tier + fsec, assina JWT, devolve.
3. Player envia JWT ao edge Go ao buscar master.m3u8.
4. Edge Go valida JWT. Para cada GET de segmento .m4s:
     se tier == paid  -> serve.
     se tier == free  ->
        watched = INCRBY watch:{live}:{user} 2   (2s por segmento)
        EXPIRE watch:{live}:{user} <duração live>
        se watched <= fsec -> serve segmento
        senão -> 403 + header X-Paywall: hit
5. Edge sinaliza o chat-node (Redis) -> publica evento "paywall" p/ aquele user.
6. React recebe "paywall" via WS -> mostra modal de upgrade.
7. Usuário assina -> webhook do provedor -> Laravel ativa subscription ->
   publica "tier_upgrade" no Redis -> edge passa a tratar user como paid (e
   /token/refresh emite novo JWT tier=paid). Vídeo volta sem reload.
```

Notas de robustez:
- Contagem por **segmento servido**, não por tempo de relógio → resistente a pausar/seek.
- `watch:{live}:{user}` com TTL = duração da live evita vazamento de memória no Redis.
- Anon (não logado): chave por `anon_id` no JWT; freemium ainda aplica (mais fácil burlar,
  decisão de produto se permite anônimo).
- Segment tokens curtos evitam compartilhar a URL liberada com terceiros.

---

## 5. Monorepo: como Laravel + Go convivem

```
stream-self/
  apps/
    web/                  # Laravel + Inertia + React (control plane)
      app/ resources/js/ routes/ ...
  services/               # Go (plano de dados)
    ingest/               # RTMP/SRT -> FFmpeg
    origin/               # packager LL-HLS + edge paywall
    chat/                 # WebSocket + Redis pub/sub
    shared/               # pkg comum: jwt, redis, config
  deploy/
    docker-compose.yml    # dev: web, postgres, redis, ingest, origin, chat, nginx
    nginx/                # edge cache p/ segmentos
  ARQUITETURA.md
```

### Limites de responsabilidade
- **Laravel**: auth, billing, admin, emissão de JWT, webhooks. Nunca serve vídeo/WS.
- **Go**: tudo de alta frequência (segmentos, WS, transcode).
- **Comunicação Laravel↔Go**: Redis (eventos: tier_upgrade, ban, mod) +
  HTTP interno para validação de stream_key. JWT é o "passaporte" assinado entre eles.

### Caminho de deploy/escala
1. **MVP**: 1 VPS, docker-compose, 1 live, tudo junto. Aguenta ~1-2k.
2. **Cresceu**: separa edges (origin Go atrás de Nginx/Varnish) em N VPS; chat em 2-3 nós;
   Redis dedicado; Postgres com réplica de leitura.
3. **Multi-live pesado**: nós de transcode com GPU; shard de Redis por live_id; LB geográfico.

Gargalo dominante = **banda de saída** (LL-HLS cacheável mitiga). CPU só pesa no transcode.
```
