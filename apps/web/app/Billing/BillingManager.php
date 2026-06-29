<?php

namespace App\Billing;

use App\Billing\Gateways\AsaasGateway;
use App\Billing\Gateways\MercadoPagoGateway;
use App\Billing\Gateways\StripeGateway;
use App\Billing\Gateways\StubGateway;
use InvalidArgumentException;

/**
 * Resolve o driver de pagamento a partir de config('billing.driver').
 */
class BillingManager
{
    public function driver(?string $name = null): PaymentGateway
    {
        $name ??= config('billing.driver', 'stub');

        return match ($name) {
            'stub' => new StubGateway(),
            'stripe' => new StripeGateway(),
            'mercadopago' => new MercadoPagoGateway(),
            'asaas' => new AsaasGateway(),
            default => throw new InvalidArgumentException("Driver de billing desconhecido: {$name}"),
        };
    }
}
