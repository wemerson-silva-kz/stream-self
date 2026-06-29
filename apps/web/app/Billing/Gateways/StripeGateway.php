<?php

namespace App\Billing\Gateways;

use App\Billing\CheckoutSession;
use App\Billing\PaymentGateway;
use App\Billing\WebhookEvent;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Driver Stripe (cartão + assinatura recorrente; PIX via Stripe BR).
 *
 * Esqueleto: a estrutura/contrato está pronta. Para ativar, instale o SDK
 * (`composer require stripe/stripe-php`) e preencha os TODOs com as chamadas
 * reais usando config('billing.stripe.secret').
 */
class StripeGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'stripe';
    }

    public function createCheckout(User $user, Plan $plan, string $method): CheckoutSession
    {
        // TODO: \Stripe\Checkout\Session::create([...]) com price recorrente e
        // success_url/cancel_url; usar $session->id como reference e
        // $session->url como redirectUrl.
        throw new \RuntimeException('StripeGateway não configurado: defina STRIPE_SECRET e implemente createCheckout.');
    }

    public function parseWebhook(Request $request): ?WebhookEvent
    {
        // TODO: \Stripe\Webhook::constructEvent($payload, $sigHeader, $secret).
        // Mapear: checkout.session.completed/invoice.paid -> PAYMENT_CONFIRMED,
        // invoice.payment_failed -> PAYMENT_FAILED,
        // customer.subscription.deleted -> SUBSCRIPTION_CANCELED.
        // reference = client_reference_id ou metadata->subscription_ref.
        return null;
    }
}
