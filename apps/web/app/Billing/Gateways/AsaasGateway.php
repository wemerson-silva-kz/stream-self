<?php

namespace App\Billing\Gateways;

use App\Billing\CheckoutSession;
use App\Billing\PaymentGateway;
use App\Billing\WebhookEvent;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Driver Asaas — PIX (BR), taxas baixas. Cria cliente + cobrança PIX e busca o
 * QR; a confirmação chega via webhook (PAYMENT_CONFIRMED/RECEIVED).
 *
 * Requer ASAAS_KEY (header access_token) e ASAAS_BASE_URL. Endpoints:
 *   POST {base}/v3/customers
 *   POST {base}/v3/payments
 *   GET  {base}/v3/payments/{id}/pixQrCode
 */
class AsaasGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'asaas';
    }

    private function http()
    {
        $key = (string) config('billing.asaas.key');
        if ($key === '') {
            throw new \RuntimeException('ASAAS_KEY não configurado.');
        }

        return Http::baseUrl(rtrim((string) config('billing.asaas.base_url'), '/'))
            ->withHeaders(['access_token' => $key])
            ->acceptJson();
    }

    public function createCheckout(User $user, Plan $plan, string $method): CheckoutSession
    {
        $reference = 'asaas_'.Str::uuid()->toString();
        $http = $this->http();

        $customer = $http->post('/v3/customers', [
            'name' => $user->name,
            'email' => $user->email,
            'externalReference' => 'user:'.$user->id,
        ])->throw()->json();

        $payment = $http->post('/v3/payments', [
            'customer' => $customer['id'],
            'billingType' => 'PIX',
            'value' => round($plan->price_cents / 100, 2),
            'dueDate' => now()->addDay()->toDateString(),
            'description' => 'Assinatura '.$plan->name,
            'externalReference' => $reference,
        ])->throw()->json();

        $qr = $http->get("/v3/payments/{$payment['id']}/pixQrCode")->throw()->json();

        return new CheckoutSession(
            provider: 'asaas',
            reference: $reference,
            method: 'pix',
            amountCents: $plan->price_cents,
            currency: $plan->currency,
            pixCode: $qr['payload'] ?? null,
            qrImage: isset($qr['encodedImage']) ? 'data:image/png;base64,'.$qr['encodedImage'] : null,
        );
    }

    public function parseWebhook(Request $request): ?WebhookEvent
    {
        // Valida o token do webhook, se configurado.
        $expected = (string) config('billing.asaas.webhook_token');
        if ($expected !== '' && ! hash_equals($expected, (string) $request->header('asaas-access-token'))) {
            return null;
        }

        $event = (string) $request->input('event');
        $reference = $request->input('payment.externalReference');
        if (! $reference) {
            return null;
        }

        return match ($event) {
            'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED' => new WebhookEvent(WebhookEvent::PAYMENT_CONFIRMED, $reference, $request->all()),
            'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED' => new WebhookEvent(WebhookEvent::PAYMENT_FAILED, $reference, $request->all()),
            default => null,
        };
    }
}
