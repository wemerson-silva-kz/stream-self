<?php

namespace App\Billing;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

/**
 * Orquestra o ciclo de assinatura sobre qualquer PaymentGateway:
 * checkout -> cobrança pendente -> webhook -> ativação do tier paid.
 */
class BillingService
{
    public function __construct(private readonly BillingManager $manager)
    {
    }

    public function gateway(): PaymentGateway
    {
        return $this->manager->driver();
    }

    public function defaultPlan(): Plan
    {
        return Plan::where('slug', config('billing.default_plan', 'premium'))->firstOrFail();
    }

    /**
     * Inicia uma cobrança e registra a assinatura como `pending`.
     */
    public function startCheckout(User $user, Plan $plan, string $method): CheckoutSession
    {
        $gateway = $this->gateway();
        $session = $gateway->createCheckout($user, $plan, $method);

        Subscription::updateOrCreate(
            ['provider' => $session->provider, 'provider_ref' => $session->reference],
            [
                'user_id' => $user->id,
                'plan_id' => $plan->id,
                'status' => 'pending',
            ],
        );

        return $session;
    }

    /**
     * Aplica um evento de webhook normalizado à assinatura correspondente.
     * Retorna true se algo foi alterado.
     */
    public function applyEvent(WebhookEvent $event): bool
    {
        $sub = Subscription::where('provider_ref', $event->reference)->latest('id')->first();
        if (! $sub) {
            return false;
        }

        switch ($event->type) {
            case WebhookEvent::PAYMENT_CONFIRMED:
                $sub->update([
                    'status' => 'active',
                    'current_period_end' => now()->addDays((int) config('billing.period_days', 30)),
                ]);
                $this->publishTier($sub, 'paid');
                break;

            case WebhookEvent::PAYMENT_FAILED:
                $sub->update(['status' => 'past_due']);
                break;

            case WebhookEvent::SUBSCRIPTION_CANCELED:
                $sub->update(['status' => 'canceled']);
                $this->publishTier($sub, 'free');
                break;

            default:
                return false;
        }

        return true;
    }

    /**
     * Notifica os serviços Go (edge/chat) em tempo real via Redis, para que o
     * usuário passe a paid sem precisar recarregar. Falha em silêncio se o
     * Redis não estiver disponível (o tier ainda persiste no banco).
     */
    private function publishTier(Subscription $sub, string $tier): void
    {
        try {
            Redis::publish('billing', json_encode([
                'type' => 'tier_change',
                'user' => 'user:'.$sub->user_id,
                'tier' => $tier,
            ]));
        } catch (\Throwable $e) {
            Log::warning('billing: redis publish falhou: '.$e->getMessage());
        }
    }
}
