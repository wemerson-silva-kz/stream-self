<?php

return [
    // Driver ativo: stub | stripe | mercadopago | asaas
    'driver' => env('BILLING_DRIVER', 'stub'),

    // Plano padrão cobrado no checkout (slug em `plans`).
    'default_plan' => env('BILLING_DEFAULT_PLAN', 'premium'),

    // Duração de um ciclo de assinatura.
    'period_days' => (int) env('BILLING_PERIOD_DAYS', 30),

    'stripe' => [
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        'price_id' => env('STRIPE_PRICE_ID'),
    ],

    'mercadopago' => [
        'token' => env('MERCADOPAGO_TOKEN'),
        'webhook_secret' => env('MERCADOPAGO_WEBHOOK_SECRET'),
    ],

    'asaas' => [
        'key' => env('ASAAS_KEY'),
        'base_url' => env('ASAAS_BASE_URL', 'https://api.asaas.com'),
        'webhook_token' => env('ASAAS_WEBHOOK_TOKEN'),
    ],
];
