<?php

return [
    /*
    | Segredo HS256 compartilhado entre Laravel e os serviços Go (chat/origin).
    | Em produção, troque por par RS256 (Laravel assina com a privada, Go valida
    | com a pública) para que o Go nunca tenha poder de emitir tokens.
    */
    'jwt_secret' => env('STREAM_JWT_SECRET', env('APP_KEY')),

    'jwt_alg' => env('STREAM_JWT_ALG', 'HS256'),

    // Tempo de vida do JWT de viewer (segundos).
    'viewer_token_ttl' => (int) env('STREAM_VIEWER_TOKEN_TTL', 3600),

    // Freemium global padrão (segundos) — usado se live e plano não definirem.
    'global_freemium_seconds' => (int) env('STREAM_GLOBAL_FREEMIUM_SECONDS', 1800),

    // Base URL do edge/origin Go que serve os segmentos LL-HLS.
    'origin_url' => env('STREAM_ORIGIN_URL', 'http://localhost:8081'),

    // Base URL (ws) do serviço de chat Go.
    'chat_ws_url' => env('STREAM_CHAT_WS_URL', 'ws://localhost:8082/ws'),
];
