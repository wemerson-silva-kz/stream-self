<?php

namespace App\Http\Controllers;

use App\Billing\BillingService;
use App\Billing\WebhookEvent;
use App\Models\Plan;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BillingController extends Controller
{
    public function __construct(private readonly BillingService $billing)
    {
    }

    /**
     * Inicia a assinatura do plano padrão. Requer login.
     * Com o driver stub, confirma na hora (sem credenciais) — fechando o loop
     * registrar -> assinar -> paid. Com driver real, cria a cobrança pendente
     * e a confirmação chega depois via webhook.
     *
     * POST /billing/subscribe
     */
    public function subscribe(Request $request): RedirectResponse
    {
        $request->validate(['method' => 'nullable|in:pix,card,crypto']);

        $user = $request->user();
        $plan = $this->resolvePlan();
        $method = (string) $request->input('method', 'pix');

        $session = $this->billing->startCheckout($user, $plan, $method);

        // Stub/dev: confirma imediatamente simulando o webhook do provider.
        if ($session->autoConfirmable) {
            $this->billing->applyEvent(new WebhookEvent(WebhookEvent::PAYMENT_CONFIRMED, $session->reference));

            return back()->with('status', 'Assinatura ativa — acesso liberado.');
        }

        // Driver real: guarda os dados da cobrança p/ a tela exibir (PIX/redirect).
        return back()->with('checkout', $session->toArray());
    }

    /**
     * Webhook dos providers reais. POST /webhooks/{provider}
     */
    public function webhook(Request $request, string $provider): \Illuminate\Http\Response
    {
        $gateway = app(\App\Billing\BillingManager::class)->driver($provider);
        $event = $gateway->parseWebhook($request);

        if ($event) {
            $this->billing->applyEvent($event);
        }

        // Providers esperam 200 para não reenviar.
        return response('', 200);
    }

    private function resolvePlan(): Plan
    {
        return Plan::where('slug', config('billing.default_plan', 'premium'))->first()
            ?? $this->billing->defaultPlan();
    }
}
