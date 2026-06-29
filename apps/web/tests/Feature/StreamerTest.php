<?php

namespace Tests\Feature;

use App\Models\Live;
use App\Models\StreamKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StreamerTest extends TestCase
{
    use RefreshDatabase;

    public function test_streamer_can_create_a_live_with_stream_key()
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post('/streamer/lives', ['title' => 'Minha primeira live'])
            ->assertRedirect();

        $live = $user->fresh()->lives()->first();
        $this->assertNotNull($live);
        $this->assertSame('offline', $live->status);
        $this->assertNotNull($live->streamKey);
        $this->assertStringStartsWith('sk_live_', $live->streamKey->key);
    }

    public function test_owner_can_toggle_live_status()
    {
        $user = User::factory()->create();
        $live = Live::create([
            'owner_id' => $user->id, 'title' => 'L', 'slug' => 'l', 'status' => 'offline',
        ]);

        $this->actingAs($user)->patch("/streamer/lives/{$live->id}", ['status' => 'live'])->assertRedirect();
        $live->refresh();
        $this->assertSame('live', $live->status);
        $this->assertNotNull($live->started_at);
    }

    public function test_rotating_key_changes_it()
    {
        $user = User::factory()->create();
        $live = Live::create(['owner_id' => $user->id, 'title' => 'L', 'slug' => 'l2', 'status' => 'offline']);
        $live->streamKey()->create(['key' => StreamKey::generate()]);
        $old = $live->streamKey->key;

        $this->actingAs($user)->post("/streamer/lives/{$live->id}/rotate-key")->assertRedirect();

        $this->assertNotSame($old, $live->fresh()->streamKey->key);
    }

    public function test_non_owner_cannot_manage_live()
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $live = Live::create(['owner_id' => $owner->id, 'title' => 'L', 'slug' => 'l3', 'status' => 'offline']);

        $this->actingAs($other)->patch("/streamer/lives/{$live->id}", ['status' => 'live'])->assertForbidden();
        $this->actingAs($other)->post("/streamer/lives/{$live->id}/rotate-key")->assertForbidden();
    }

    public function test_owner_sees_stream_key_in_props_but_others_do_not()
    {
        $owner = User::factory()->create();
        $live = Live::create(['owner_id' => $owner->id, 'title' => 'L', 'slug' => 'l4', 'status' => 'offline', 'is_featured' => true]);
        $live->streamKey()->create(['key' => StreamKey::generate()]);

        $this->actingAs($owner)->get('/')
            ->assertInertia(fn ($page) => $page->where('myLive.stream_key', $live->streamKey->key));

        $other = User::factory()->create();
        $this->actingAs($other)->get('/')
            ->assertInertia(fn ($page) => $page->where('myLive', null));
    }
}
