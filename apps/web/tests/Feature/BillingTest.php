<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('billing.driver', 'stub');
        config()->set('billing.default_plan', 'premium');
        Plan::create(['slug' => 'premium', 'name' => 'Premium', 'price_cents' => 2990, 'currency' => 'BRL', 'freemium_seconds' => null]);
    }

    public function test_guests_cannot_subscribe()
    {
        $this->post('/billing/subscribe', ['method' => 'pix'])->assertRedirect('/login');
    }

    public function test_stub_driver_activates_subscription_and_paid_tier()
    {
        $user = User::factory()->create();
        $this->assertNull($user->activeSubscription());

        $this->actingAs($user)
            ->post('/billing/subscribe', ['method' => 'pix'])
            ->assertRedirect();

        $sub = $user->fresh()->activeSubscription();
        $this->assertNotNull($sub);
        $this->assertSame('active', $sub->status);
        $this->assertNotNull($sub->current_period_end);
    }

    public function test_inertia_shares_paid_tier_after_subscribing()
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post('/billing/subscribe', ['method' => 'pix']);

        $this->actingAs($user->fresh())
            ->get('/')
            ->assertInertia(fn ($page) => $page->where('auth.tier', 'paid'));
    }

    public function test_unknown_webhook_reference_does_not_error()
    {
        $this->post('/webhooks/stub', ['reference' => 'nao-existe'])->assertOk();
    }
}
