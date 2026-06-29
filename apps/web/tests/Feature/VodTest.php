<?php

namespace Tests\Feature;

use App\Models\Live;
use App\Models\User;
use App\Models\Vod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VodTest extends TestCase
{
    use RefreshDatabase;

    public function test_ending_a_live_creates_a_vod()
    {
        $user = User::factory()->create();
        $live = Live::create([
            'owner_id' => $user->id, 'title' => 'Ranked', 'slug' => 'ranked',
            'status' => 'live', 'started_at' => now()->subHours(2),
        ]);

        $this->actingAs($user)->patch("/streamer/lives/{$live->id}", ['status' => 'ended'])->assertRedirect();

        $vod = Vod::where('live_id', $live->id)->first();
        $this->assertNotNull($vod);
        $this->assertSame('Ranked', $vod->title);
        $this->assertGreaterThan(0, $vod->duration_seconds);
        $this->assertNotNull($vod->published_at);
    }

    public function test_ending_already_ended_live_does_not_duplicate_vod()
    {
        $user = User::factory()->create();
        $live = Live::create(['owner_id' => $user->id, 'title' => 'X', 'slug' => 'x', 'status' => 'ended', 'ended_at' => now()]);

        $this->actingAs($user)->patch("/streamer/lives/{$live->id}", ['status' => 'ended']);

        $this->assertSame(0, Vod::where('live_id', $live->id)->count());
    }

    public function test_episodes_prop_lists_published_vods()
    {
        $user = User::factory()->create();
        Live::create(['owner_id' => $user->id, 'title' => 'Feat', 'slug' => 'feat', 'status' => 'offline', 'is_featured' => true]);
        Vod::create([
            'owner_id' => $user->id, 'title' => 'Replay 1', 'slug' => 'replay-1',
            'duration_seconds' => 6120, 'views' => 48000, 'visibility' => 'public', 'published_at' => now(),
        ]);

        $this->get('/')->assertInertia(
            fn ($page) => $page->has('episodes', 1)
                ->where('episodes.0.title', 'Replay 1')
                ->where('episodes.0.dur', '1h 42min')
                ->where('episodes.0.views', '48k')
        );
    }

    public function test_episodes_prop_is_null_when_no_vods()
    {
        $user = User::factory()->create();
        Live::create(['owner_id' => $user->id, 'title' => 'Feat', 'slug' => 'feat', 'status' => 'offline', 'is_featured' => true]);

        $this->get('/')->assertInertia(fn ($page) => $page->where('episodes', null));
    }
}
