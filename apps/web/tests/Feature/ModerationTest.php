<?php

namespace Tests\Feature;

use App\Models\ChatBan;
use App\Models\ChatMessage;
use App\Models\Live;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModerationTest extends TestCase
{
    use RefreshDatabase;

    private function liveOwnedBy(User $user): Live
    {
        return Live::create(['owner_id' => $user->id, 'title' => 'L', 'slug' => 'l-'.$user->id, 'status' => 'live']);
    }

    public function test_owner_can_delete_a_message()
    {
        $owner = User::factory()->create();
        $live = $this->liveOwnedBy($owner);
        $msg = ChatMessage::create(['live_id' => $live->id, 'user_id' => null, 'body' => 'spam', 'created_at' => now()]);

        $this->actingAs($owner)
            ->post("/streamer/lives/{$live->id}/moderation/delete", ['message_id' => $msg->id])
            ->assertRedirect();

        $this->assertSoftDeleted('chat_messages', ['id' => $msg->id]);
    }

    public function test_owner_can_ban_a_real_user_and_it_persists()
    {
        $owner = User::factory()->create();
        $target = User::factory()->create();
        $live = $this->liveOwnedBy($owner);

        $this->actingAs($owner)
            ->post("/streamer/lives/{$live->id}/moderation/ban", ['target' => "user:{$target->id}", 'reason' => 'spam'])
            ->assertRedirect();

        $this->assertDatabaseHas('chat_bans', ['live_id' => $live->id, 'user_id' => $target->id]);
    }

    public function test_non_owner_cannot_moderate()
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $live = $this->liveOwnedBy($owner);

        $this->actingAs($other)
            ->post("/streamer/lives/{$live->id}/moderation/ban", ['target' => 'user:9'])
            ->assertForbidden();
    }

    public function test_chat_mode_and_clear_are_authorized_and_ok()
    {
        $owner = User::factory()->create();
        $live = $this->liveOwnedBy($owner);

        $this->actingAs($owner)->post("/streamer/lives/{$live->id}/moderation/mode", ['mode' => 'slow', 'on' => true])->assertRedirect();
        $this->actingAs($owner)->post("/streamer/lives/{$live->id}/moderation/clear")->assertRedirect();
    }

    public function test_metrics_endpoint_returns_zeroed_shape_without_redis()
    {
        $owner = User::factory()->create();
        $live = $this->liveOwnedBy($owner);

        $this->get("/api/live/{$live->id}/metrics")
            ->assertOk()
            ->assertJsonStructure(['viewers', 'msgs_per_min', 'status', 'live_data']);

        // limpa qualquer ban residual em teste sem redis
        ChatBan::query()->delete();
    }
}
