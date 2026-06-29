<?php

namespace App\Billing\Gateways;

use App\Billing\CheckoutSession;
use App\Billing\PaymentGateway;
use App\Billing\WebhookEvent;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Driver Asaas (gateway BR focado em PIX/assinatura, taxas baixas).
 *
 * Esqueleto pronto. Para ativar: criar cliente + cobrança/assinatura via API
 * (POST /v3/subscriptions ou /v3/payments) com config('billing.asaas.key');
 * para PIX, buscar o QR em /v3/payments/{id}/pixQrCode.
 */
class AsaasGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'asaas';
    }

    public function createCheckout(User $user, Plan $plan, string $method): CheckoutSession
    {
        // TODO: POST {base}/v3/payments (billingType: 'PIX', value, externalReference)
        // depois GET /v3/payments/{id}/pixQrCode -> { payload, encodedImage }.
        // reference = id do payment; pixCode = payload; qrImage = encodedImage.
        throw new \RuntimeException('AsaasGateway não configurado: defina ASAAS_KEY e implemente createCheckout.');
    }

    public function parseWebhook(Request $request): ?WebhookEvent
    {
        // TODO: validar token do webhook (header asaas-access-token); evento
        // PAYMENT_CONFIRMED/PAYMENT_RECEIVED -> PAYMENT_CONFIRMED;
        // PAYMENT_OVERDUE -> PAYMENT_FAILED. reference = payment.externalReference.
        return null;
    }
}
