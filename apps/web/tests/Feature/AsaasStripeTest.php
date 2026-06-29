<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AsaasStripeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('billing.default_plan', 'premium');
        Plan::create(['slug' => 'premium', 'name' => 'Premium', 'price_cents' => 2990, 'currency' => 'BRL']);
    }

    public function test_asaas_pix_checkout_and_webhook_activation()
    {
        config()->set('billing.driver', 'asaas');
        config()->set('billing.asaas.key', 'asaas-key');
        config()->set('billing.asaas.base_url', 'https://api.asaas.com');

        Http::fake([
            'api.asaas.com/v3/customers' => Http::response(['id' => 'cus_1'], 200),
            'api.asaas.com/v3/payments' => Http::response(['id' => 'pay_1'], 200),
            'api.asaas.com/v3/payments/pay_1/pixQrCode' => Http::response(['payload' => 'PIX-COPIA', 'encodedImage' => base64_encode('x')], 200),
        ]);

        $user = User::factory()->create();
        $this->actingAs($user)->post('/billing/subscribe', ['method' => 'pix'])->assertRedirect();

        $sub = Subscription::where('provider', 'asaas')->latest('id')->first();
        $this->assertSame('pending', $sub->status);

        $this->post('/webhooks/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['externalReference' => $sub->provider_ref],
        ])->assertOk();

        $this->assertSame('active', $sub->fresh()->status);
    }

    public function test_stripe_checkout_redirect_and_signed_webhook()
    {
        config()->set('billing.driver', 'stripe');
        config()->set('billing.stripe.secret', 'sk_test');
        config()->set('billing.stripe.webhook_secret', 'whsec_test');

        Http::fake([
            'api.stripe.com/v1/checkout/sessions' => Http::response([
                'id' => 'cs_1', 'url' => 'https://checkout.stripe.com/c/cs_1',
            ], 200),
        ]);

        $user = User::factory()->create();
        $this->actingAs($user)->post('/billing/subscribe', ['method' => 'card'])->assertRedirect();

        $sub = Subscription::where('provider', 'stripe')->latest('id')->first();
        $this->assertSame('pending', $sub->status);

        // webhook assinado corretamente -> ativa
        $payload = json_encode([
            'type' => 'checkout.session.completed',
            'data' => ['object' => ['client_reference_id' => $sub->provider_ref]],
        ]);
        $ts = (string) time();
        $sig = 't='.$ts.',v1='.hash_hmac('sha256', $ts.'.'.$payload, 'whsec_test');

        $this->call('POST', '/webhooks/stripe', [], [], [], [
            'HTTP_STRIPE_SIGNATURE' => $sig,
            'CONTENT_TYPE' => 'application/json',
        ], $payload)->assertOk();

        $this->assertSame('active', $sub->fresh()->status);
    }

    public function test_stripe_rejects_bad_signature()
    {
        config()->set('billing.driver', 'stripe');
        config()->set('billing.stripe.webhook_secret', 'whsec_test');

        $user = User::factory()->create();
        $plan = Plan::first();
        $sub = Subscription::create([
            'user_id' => $user->id, 'plan_id' => $plan->id, 'status' => 'pending',
            'provider' => 'stripe', 'provider_ref' => 'stripe_ref_x',
        ]);

        $payload = json_encode([
            'type' => 'checkout.session.completed',
            'data' => ['object' => ['client_reference_id' => 'stripe_ref_x']],
        ]);

        $this->call('POST', '/webhooks/stripe', [], [], [], [
            'HTTP_STRIPE_SIGNATURE' => 't=1,v1=deadbeef',
            'CONTENT_TYPE' => 'application/json',
        ], $payload)->assertOk();

        // assinatura inválida -> NÃO ativa
        $this->assertSame('pending', $sub->fresh()->status);
    }
}
