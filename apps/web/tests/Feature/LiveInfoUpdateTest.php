<?php

namespace Tests\Feature;

use App\Models\Live;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LiveInfoUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_updates_title_and_category()
    {
        $user = User::factory()->create();
        $live = Live::create(['owner_id' => $user->id, 'title' => 'Antigo', 'slug' => 'a', 'status' => 'live']);

        $this->actingAs($user)->patch("/streamer/lives/{$live->id}", [
            'title' => 'AO VIVO: ALEMANHA X PARAGUAI | COPA DO MUNDO FIFA™ 2026',
            'category' => 'Episódio #5',
        ])->assertRedirect();

        $live->refresh();
        $this->assertSame('AO VIVO: ALEMANHA X PARAGUAI | COPA DO MUNDO FIFA™ 2026', $live->title);
        $this->assertSame('Episódio #5', $live->category);
    }
}
