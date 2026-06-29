<?php

namespace App\Billing;

/**
 * Dados normalizados de uma cobrança recém-criada, devolvidos ao front.
 */
class CheckoutSession
{
    public function __construct(
        public readonly string $provider,
        public readonly string $reference,   // id externo da cobrança (provider_ref)
        public readonly string $method,      // pix | card | crypto
        public readonly int $amountCents,
        public readonly string $currency = 'BRL',
        public readonly ?string $pixCode = null,
        public readonly ?string $qrImage = null,    // data-uri ou URL do QR
        public readonly ?string $redirectUrl = null, // checkout hospedado (cartão/stripe)
        public readonly bool $autoConfirmable = false, // stub/dev: pode confirmar via endpoint
    ) {
    }

    public function toArray(): array
    {
        return [
            'provider' => $this->provider,
            'reference' => $this->reference,
            'method' => $this->method,
            'amount_cents' => $this->amountCents,
            'currency' => $this->currency,
            'pix_code' => $this->pixCode,
            'qr_image' => $this->qrImage,
            'redirect_url' => $this->redirectUrl,
            'auto_confirmable' => $this->autoConfirmable,
        ];
    }
}
