<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MercadoPagoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('billing.driver', 'mercadopago');
        config()->set('billing.default_plan', 'premium');
        config()->set('billing.mercadopago.token', 'TEST-token');
        Plan::create(['slug' => 'premium', 'name' => 'Premium', 'price_cents' => 2990, 'currency' => 'BRL']);
    }

    public function test_pix_checkout_creates_pending_subscription_and_webhook_activates_it()
    {
        $user = User::factory()->create();

        // 1) cria pagamento PIX (cobrança) -> resposta com QR
        Http::fake([
            'api.mercadopago.com/v1/payments' => Http::response([
                'id' => 12345,
                'status' => 'pending',
                'point_of_interaction' => ['transaction_data' => [
                    'qr_code' => '00020126-PIX-COPIA-E-COLA',
                    'qr_code_base64' => base64_encode('PNGDATA'),
                ]],
            ], 201),
        ]);

        $this->actingAs($user)->post('/billing/subscribe', ['method' => 'pix'])->assertRedirect();

        $sub = Subscription::where('provider', 'mercadopago')->latest('id')->first();
        $this->assertNotNull($sub);
        $this->assertSame('pending', $sub->status);

        // 2) webhook approved -> consulta pagamento -> ativa assinatura
        Http::fake([
            'api.mercadopago.com/v1/payments/999' => Http::response([
                'id' => 999, 'status' => 'approved', 'external_reference' => $sub->provider_ref,
            ], 200),
        ]);

        $this->post('/webhooks/mercadopago', ['type' => 'payment', 'data' => ['id' => 999]])->assertOk();

        $sub->refresh();
        $this->assertSame('active', $sub->status);
        $this->assertNotNull($sub->current_period_end);
    }

    public function test_rejected_payment_marks_past_due()
    {
        $user = User::factory()->create();
        Http::fake(['api.mercadopago.com/v1/payments' => Http::response([
            'id' => 1, 'status' => 'pending',
            'point_of_interaction' => ['transaction_data' => ['qr_code' => 'x', 'qr_code_base64' => 'eA==']],
        ], 201)]);
        $this->actingAs($user)->post('/billing/subscribe', ['method' => 'pix']);
        $sub = Subscription::where('provider', 'mercadopago')->latest('id')->first();

        Http::fake(['api.mercadopago.com/v1/payments/5' => Http::response([
            'status' => 'rejected', 'external_reference' => $sub->provider_ref,
        ], 200)]);
        $this->post('/webhooks/mercadopago', ['type' => 'payment', 'data' => ['id' => 5]])->assertOk();

        $this->assertSame('past_due', $sub->fresh()->status);
    }
}
