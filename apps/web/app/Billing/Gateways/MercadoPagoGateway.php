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
 * Driver Mercado Pago — PIX nativo (BR). Cria um pagamento PIX e devolve o
 * copia-e-cola + QR; a confirmação chega via webhook (status approved).
 *
 * Requer MERCADOPAGO_TOKEN (access token). Endpoints:
 *   POST https://api.mercadopago.com/v1/payments
 *   GET  https://api.mercadopago.com/v1/payments/{id}
 */
class MercadoPagoGateway implements PaymentGateway
{
    private const BASE = 'https://api.mercadopago.com';

    public function name(): string
    {
        return 'mercadopago';
    }

    private function token(): string
    {
        $token = (string) config('billing.mercadopago.token');
        if ($token === '') {
            throw new \RuntimeException('MERCADOPAGO_TOKEN não configurado.');
        }

        return $token;
    }

    public function createCheckout(User $user, Plan $plan, string $method): CheckoutSession
    {
        $reference = 'mp_'.Str::uuid()->toString();

        $resp = Http::withToken($this->token())
            ->withHeaders(['X-Idempotency-Key' => $reference])
            ->acceptJson()
            ->post(self::BASE.'/v1/payments', [
                'transaction_amount' => round($plan->price_cents / 100, 2),
                'description' => 'Assinatura '.$plan->name,
                'payment_method_id' => 'pix',
                'external_reference' => $reference,
                'notification_url' => route('billing.webhook', 'mercadopago'),
                'payer' => ['email' => $user->email],
            ])
            ->throw()
            ->json();

        $tx = $resp['point_of_interaction']['transaction_data'] ?? [];

        return new CheckoutSession(
            provider: 'mercadopago',
            reference: $reference,
            method: 'pix',
            amountCents: $plan->price_cents,
            currency: $plan->currency,
            pixCode: $tx['qr_code'] ?? null,
            qrImage: isset($tx['qr_code_base64']) ? 'data:image/png;base64,'.$tx['qr_code_base64'] : null,
        );
    }

    public function parseWebhook(Request $request): ?WebhookEvent
    {
        // Notificação traz o id do pagamento (body data.id ou query ?id=).
        $paymentId = $request->input('data.id') ?? $request->query('id');
        $topic = $request->input('type') ?? $request->query('topic');
        if (! $paymentId || ($topic && $topic !== 'payment')) {
            return null;
        }

        $payment = Http::withToken($this->token())
            ->acceptJson()
            ->get(self::BASE."/v1/payments/{$paymentId}")
            ->json();

        $reference = $payment['external_reference'] ?? null;
        if (! $reference) {
            return null;
        }

        return match ($payment['status'] ?? '') {
            'approved' => new WebhookEvent(WebhookEvent::PAYMENT_CONFIRMED, $reference, $payment),
            'rejected', 'cancelled' => new WebhookEvent(WebhookEvent::PAYMENT_FAILED, $reference, $payment),
            default => null, // pending/in_process: ignora
        };
    }
}
