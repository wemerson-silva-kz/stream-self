<?php

namespace App\Billing\Gateways;

use App\Billing\CheckoutSession;
use App\Billing\PaymentGateway;
use App\Billing\WebhookEvent;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Driver de desenvolvimento: cria uma cobrança fake confirmável na hora
 * (sem credenciais). Permite rodar todo o fluxo registrar -> assinar -> paid.
 */
class StubGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'stub';
    }

    public function createCheckout(User $user, Plan $plan, string $method): CheckoutSession
    {
        return new CheckoutSession(
            provider: 'stub',
            reference: 'stub_'.Str::uuid()->toString(),
            method: $method,
            amountCents: $plan->price_cents,
            currency: $plan->currency,
            pixCode: '00020126STUB-PIX-'.strtoupper(Str::random(24)).'5204000053039865802BR6304ABCD',
            autoConfirmable: true,
        );
    }

    /**
     * O stub não recebe webhook de provider; a confirmação vem do endpoint
     * interno de simulação (BillingController@simulate), que monta o evento.
     */
    public function parseWebhook(Request $request): ?WebhookEvent
    {
        $ref = (string) $request->input('reference');
        if ($ref === '') {
            return null;
        }

        return new WebhookEvent(WebhookEvent::PAYMENT_CONFIRMED, $ref, $request->all());
    }
}
