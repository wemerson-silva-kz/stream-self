<?php

namespace App\Http\Controllers;

use App\Models\ChatBan;
use App\Models\ChatMessage;
use App\Models\Live;
use App\Models\User;
use App\Support\StreamRedis;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Moderação real: publica eventos no Redis (canal live:{id}) que os nós de chat
 * Go aplicam em tempo real (mod_delete remove a msg, ban derruba a conexão),
 * além de persistir o estado durável (soft-delete da msg, registro do ban).
 */
class ModerationController extends Controller
{
    private function channel(Live $live): string
    {
        return 'live:'.$live->id;
    }

    /** POST /streamer/lives/{live}/moderation/delete */
    public function deleteMessage(Request $request, Live $live): RedirectResponse
    {
        $this->authorize('update', $live);
        $id = $request->input('message_id');

        StreamRedis::publish($this->channel($live), ['t' => 'mod_delete', 'live' => $live->id, 'id' => $id]);

        if (is_numeric($id)) {
            ChatMessage::where('id', $id)->where('live_id', $live->id)->delete();
        }

        return back();
    }

    /** POST /streamer/lives/{live}/moderation/ban */
    public function ban(Request $request, Live $live): RedirectResponse
    {
        $this->authorize('update', $live);
        $data = $request->validate([
            'target' => 'required|string|max:120',   // sub do chat: "user:123" | "anon:..."
            'reason' => 'nullable|string|max:200',
        ]);

        StreamRedis::sadd("ban:{$live->id}", $data['target']);
        StreamRedis::publish($this->channel($live), [
            't' => 'ban', 'live' => $live->id, 'meta' => ['target' => $data['target']],
        ]);

        // Persiste quando o alvo é um usuário real (user:{id}).
        if (str_starts_with($data['target'], 'user:')) {
            $uid = (int) substr($data['target'], 5);
            if (User::whereKey($uid)->exists()) {
                ChatBan::create(['live_id' => $live->id, 'user_id' => $uid, 'reason' => $data['reason'] ?? 'mod']);
            }
        }

        return back();
    }

    /** POST /streamer/lives/{live}/moderation/unban */
    public function unban(Request $request, Live $live): RedirectResponse
    {
        $this->authorize('update', $live);
        $target = (string) $request->validate(['target' => 'required|string'])['target'];

        StreamRedis::srem("ban:{$live->id}", $target);
        if (str_starts_with($target, 'user:')) {
            ChatBan::where('live_id', $live->id)->where('user_id', (int) substr($target, 5))->delete();
        }

        return back();
    }

    /** POST /streamer/lives/{live}/moderation/mode */
    public function mode(Request $request, Live $live): RedirectResponse
    {
        $this->authorize('update', $live);
        $data = $request->validate([
            'mode' => 'required|in:slow,subs,followers,emotes',
            'on' => 'required|boolean',
        ]);

        StreamRedis::publish($this->channel($live), [
            't' => 'system', 'live' => $live->id,
            'meta' => ['mode' => $data['mode'], 'on' => $data['on']],
        ]);

        return back();
    }

    /** POST /streamer/lives/{live}/moderation/clear */
    public function clear(Request $request, Live $live): RedirectResponse
    {
        $this->authorize('update', $live);
        StreamRedis::publish($this->channel($live), ['t' => 'clear', 'live' => $live->id]);

        return back();
    }
}
