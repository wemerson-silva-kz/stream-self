<?php

namespace App\Billing;

/**
 * Evento de webhook normalizado, independente do provider.
 */
class WebhookEvent
{
    public const PAYMENT_CONFIRMED = 'payment.confirmed';
    public const PAYMENT_FAILED = 'payment.failed';
    public const SUBSCRIPTION_CANCELED = 'subscription.canceled';

    public function __construct(
        public readonly string $type,
        public readonly string $reference,   // provider_ref que casa com a subscription
        public readonly array $raw = [],
    ) {
    }
}
