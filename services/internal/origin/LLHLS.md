# LL-HLS — estado e packager de partial segments

## Estado atual (real)

- Pipeline FFmpeg emite **HLS fmp4** com segmentos curtos e **GOP fechado alinhado
  ao segmento** (`SegmentSeconds`, env `HLS_TIME`). Com `HLS_TIME=1` a latência
  fica na faixa de **HLS de baixa latência (~2-4s)** — suficiente para a maioria
  dos casos de live para assinantes.
- O origin serve playlists/segmentos com paywall por segmento.

## O que falta para LL-HLS "de verdade" (`EXT-X-PART`)

LL-HLS sub-segundo exige **partial segments** (`#EXT-X-PART`), **`EXT-X-PRELOAD-HINT`**
e **blocking playlist reload** (`_HLS_msn`/`_HLS_part`). O FFmpeg mainline **não**
emite `EXT-X-PART` — então isto é responsabilidade de um packager dedicado no origin.

### Design do packager (a implementar)

1. **Ingest dos parciais**: o FFmpeg escreve o segmento em progresso; o packager
   observa o arquivo crescer (fsnotify/poll) e fatia em "parts" de ~200-334ms,
   registrando `(segIndex, partIndex, byteOffset, byteLen, duration, independent)`.
2. **Playlist LL-HLS**: por rendition, gerar o `index.m3u8` com:
   - `#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=<3*part>`
   - `#EXT-X-PART-INF:PART-TARGET=<part_dur>`
   - para cada part: `#EXT-X-PART:DURATION=..,URI="seg_N.m4s",BYTERANGE=..[,INDEPENDENT=YES]`
   - `#EXT-X-PRELOAD-HINT:TYPE=PART,URI="seg_{N+1}.m4s",BYTERANGE-START=..`
3. **Blocking reload**: handler do origin segura a resposta da playlist até que o
   `(_HLS_msn,_HLS_part)` pedido exista (long-poll com timeout), devolvendo a
   playlist já contendo a part nova.
4. **Byte-range nos segmentos**: servir `seg_N.m4s` com `Range` para entregar só
   a part pedida (o `http.ServeContent` já honra Range).

### Por que não está implementado aqui

Exige um stream RTMP/SRT ao vivo para validar timing de parts, blocking reload e
o comportamento do player (hls.js LL-HLS). É um componente que só se valida com
tráfego real — entregar sem validação serviria playlists incorretas ao player.
O caminho acima é o plano concreto para fechá-lo em um ambiente de staging com OBS.
