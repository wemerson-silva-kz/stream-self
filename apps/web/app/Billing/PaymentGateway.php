<?php

namespace App\Billing;

use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Contrato único para qualquer gateway de pagamento (Stripe, Mercado Pago,
 * Asaas, ...). O resto da aplicação só conhece esta interface — trocar de
 * provider é trocar a env BILLING_DRIVER.
 */
interface PaymentGateway
{
    /** Identificador do driver (stripe | mercadopago | asaas | stub). */
    public function name(): string;

    /**
     * Cria uma cobrança/checkout para o plano e devolve os dados que o front
     * precisa exibir (código PIX/QR, ou URL de redirect do provider).
     */
    public function createCheckout(User $user, Plan $plan, string $method): CheckoutSession;

    /**
     * Valida a assinatura do webhook e normaliza o evento. Retorna null se o
     * payload for inválido/irrelevante.
     */
    public function parseWebhook(Request $request): ?WebhookEvent;
}
