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
 * Driver Stripe — checkout hospedado (cartão + assinatura recorrente).
 *
 * Requer STRIPE_SECRET e STRIPE_WEBHOOK_SECRET. Endpoints:
 *   POST https://api.stripe.com/v1/checkout/sessions
 * Webhook validado pela assinatura Stripe-Signature (t=..,v1=HMAC).
 */
class StripeGateway implements PaymentGateway
{
    private const BASE = 'https://api.stripe.com';

    public function name(): string
    {
        return 'stripe';
    }

    public function createCheckout(User $user, Plan $plan, string $method): CheckoutSession
    {
        $secret = (string) config('billing.stripe.secret');
        if ($secret === '') {
            throw new \RuntimeException('STRIPE_SECRET não configurado.');
        }
        $reference = 'stripe_'.Str::uuid()->toString();

        // Preço recorrente pré-configurado (STRIPE_PRICE_ID) ou price_data inline.
        $priceId = (string) config('billing.stripe.price_id');
        $form = [
            'mode' => $priceId ? 'subscription' : 'payment',
            'success_url' => config('app.url').'/?checkout=success',
            'cancel_url' => config('app.url').'/?checkout=cancel',
            'client_reference_id' => $reference,
            'customer_email' => $user->email,
            'line_items[0][quantity]' => 1,
        ];
        if ($priceId) {
            $form['line_items[0][price]'] = $priceId;
        } else {
            $form['line_items[0][price_data][currency]'] = strtolower($plan->currency);
            $form['line_items[0][price_data][unit_amount]'] = $plan->price_cents;
            $form['line_items[0][price_data][product_data][name]'] = 'Assinatura '.$plan->name;
        }

        $session = Http::withToken($secret)
            ->asForm()
            ->post(self::BASE.'/v1/checkout/sessions', $form)
            ->throw()
            ->json();

        return new CheckoutSession(
            provider: 'stripe',
            reference: $reference,
            method: 'card',
            amountCents: $plan->price_cents,
            currency: $plan->currency,
            redirectUrl: $session['url'] ?? null,
        );
    }

    public function parseWebhook(Request $request): ?WebhookEvent
    {
        $secret = (string) config('billing.stripe.webhook_secret');
        $payload = $request->getContent();

        if ($secret !== '' && ! $this->signatureValid($payload, (string) $request->header('Stripe-Signature'), $secret)) {
            return null; // assinatura inválida -> ignora
        }

        $event = json_decode($payload, true) ?: [];
        $type = $event['type'] ?? '';
        $object = $event['data']['object'] ?? [];
        $reference = $object['client_reference_id'] ?? ($object['metadata']['reference'] ?? null);
        if (! $reference) {
            return null;
        }

        return match ($type) {
            'checkout.session.completed', 'invoice.paid' => new WebhookEvent(WebhookEvent::PAYMENT_CONFIRMED, $reference, $event),
            'invoice.payment_failed' => new WebhookEvent(WebhookEvent::PAYMENT_FAILED, $reference, $event),
            'customer.subscription.deleted' => new WebhookEvent(WebhookEvent::SUBSCRIPTION_CANCELED, $reference, $event),
            default => null,
        };
    }

    /**
     * Verifica Stripe-Signature: "t=<ts>,v1=<hmac>" onde
     * hmac = HMAC_SHA256("<ts>.<payload>", webhook_secret).
     */
    private function signatureValid(string $payload, string $header, string $secret): bool
    {
        $parts = [];
        foreach (explode(',', $header) as $kv) {
            [$k, $v] = array_pad(explode('=', $kv, 2), 2, '');
            $parts[$k] = $v;
        }
        if (empty($parts['t']) || empty($parts['v1'])) {
            return false;
        }
        $expected = hash_hmac('sha256', $parts['t'].'.'.$payload, $secret);

        return hash_equals($expected, $parts['v1']);
    }
}
