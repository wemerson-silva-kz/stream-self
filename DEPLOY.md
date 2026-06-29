# Deploy — stream-self

Guia de subida em produção (self-host). Visão da arquitetura: [ARQUITETURA.md](ARQUITETURA.md).

## Pré-requisitos no servidor

- Docker + Docker Compose v2
- (Opcional) GPU NVIDIA + nvidia-container-toolkit para transcode `h264_nvenc`
- Um proxy TLS na frente (Caddy, Traefik ou nginx) terminando HTTPS/WSS
- DNS apontando os subdomínios: `seudominio.com` (app), `cdn.` (edge/vídeo),
  `chat.` (websocket), `ingest.` (RTMP/SRT)

## Passo a passo

```bash
cd deploy
cp .env.example .env
# edite .env: senhas, segredos (>=32 bytes), URLs públicas, billing
nano .env

# gere a APP_KEY e cole no .env
docker compose -f docker-compose.prod.yml --env-file .env run --rm web php artisan key:generate --show

# suba tudo (build + migrate automático via AUTORUN do serversideup/php)
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# seed inicial (planos + 1 live de exemplo) — opcional
docker compose -f docker-compose.prod.yml --env-file .env exec web php artisan db:seed --force
```

## Mapa de portas (publique atrás do proxy TLS)

| Serviço | Porta interna | Host (default) | Exponha como |
|---|---|---|---|
| web (Laravel) | 8080 | `WEB_PORT` 8080 | `https://seudominio.com` |
| edge (LL-HLS) | 80 | `EDGE_PORT` 8085 | `https://cdn.seudominio.com` |
| chat (WS) | 8082 | `CHAT_PORT` 8082 | `wss://chat.seudominio.com` |
| ingest (SRT) | 9000/udp | `SRT_PORT` 9000 | direto (OBS) |

`postgres` e `redis` **não** são expostos ao host — só na rede interna do compose.

## Segredos — checklist

- [ ] `APP_KEY` gerada (`php artisan key:generate --show`)
- [ ] `STREAM_JWT_SECRET` idêntico em web e nos serviços Go, **≥ 32 bytes** (HS256)
- [ ] `INTERNAL_SECRET` forte (rota interna do ingest)
- [ ] `DB_PASSWORD` forte
- [ ] `BILLING_DRIVER` + credenciais do provider (se não for `stub`)

## TLS (exemplo Caddy)

```
seudominio.com        { reverse_proxy web:8080 }
cdn.seudominio.com    { reverse_proxy edge:80 }
chat.seudominio.com   { reverse_proxy chat:8082 }
```

> Webhooks de billing chegam em `https://seudominio.com/webhooks/{provider}`
> (isentos de CSRF; validados pela assinatura do provider).

## Transmitir (OBS)

- Servidor: `srt://ingest.seudominio.com:9000?streamid=<STREAM_KEY>`
- Pegue a `STREAM_KEY` no painel do Streamer (criada por live, rotacionável).

## Escala (resumo de ARQUITETURA.md)

- Gargalo dominante = **banda de saída**. LL-HLS é cacheável → some **edges** (réplicas
  do par origin+nginx) atrás de um LB conforme a audiência cresce.
- **chat**: stateless + Redis Pub/Sub → escale horizontalmente (réplicas do serviço `chat`).
- **transcode/ingest**: 1 pipeline por live; use GPU (`FFMPEG_ENCODER=h264_nvenc`) para muitas lives.
- **postgres**: réplica de leitura quando o histórico/relatórios pesarem.
- **redis**: shard por `live_id` em escala de multi-live pesada.

## Operação

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f web chat origin

# migrações manuais (se AUTORUN desligado)
docker compose -f docker-compose.prod.yml exec web php artisan migrate --force

# parar / atualizar
docker compose -f docker-compose.prod.yml up -d --build   # redeploy
docker compose -f docker-compose.prod.yml down            # parar (mantém volumes)
```

## Status de validação

- ✅ Imagens Go (chat/origin/ingest/persist) **buildam** e rodam (validado em dev).
- ✅ Plano de dados validado ponta a ponta: LL-HLS com token (200/401), chat pub/sub,
  paywall (403 + `X-Paywall`), métricas (viewers/msgs no Redis), ban ao vivo.
- ✅ Control plane: 57 testes PHPUnit passando (auth, billing, streamer, moderação, VOD).
- ⚠️ O `docker-compose.prod.yml` e o `Dockerfile` do web **não foram executados** neste
  ambiente (sem Docker disponível na máquina de desenvolvimento). Revise o primeiro
  `up --build` num staging antes de produção.
