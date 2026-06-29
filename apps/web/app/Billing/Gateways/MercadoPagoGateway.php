<?php

namespace App\Billing\Gateways;

use App\Billing\CheckoutSession;
use App\Billing\PaymentGateway;
use App\Billing\WebhookEvent;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Driver Mercado Pago (PIX nativo forte no BR + cartão + recorrência).
 *
 * Esqueleto pronto. Para ativar: criar pagamento PIX via API
 * (POST /v1/payments) com config('billing.mercadopago.token'); o response traz
 * point_of_interaction.transaction_data.qr_code (copia-e-cola) e qr_code_base64.
 */
class MercadoPagoGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'mercadopago';
    }

    public function createCheckout(User $user, Plan $plan, string $method): CheckoutSession
    {
        // TODO: POST https://api.mercadopago.com/v1/payments
        //   { transaction_amount, payment_method_id: 'pix', payer, external_reference }
        // reference = external_reference (gerado por nós) ou id do pagamento;
        // pixCode = qr_code; qrImage = 'data:image/png;base64,'.qr_code_base64.
        throw new \RuntimeException('MercadoPagoGateway não configurado: defina MERCADOPAGO_TOKEN e implemente createCheckout.');
    }

    public function parseWebhook(Request $request): ?WebhookEvent
    {
        // TODO: validar x-signature; buscar o pagamento por id; mapear status
        // 'approved' -> PAYMENT_CONFIRMED, 'rejected'/'cancelled' -> PAYMENT_FAILED.
        // reference = external_reference do pagamento.
        return null;
    }
}
