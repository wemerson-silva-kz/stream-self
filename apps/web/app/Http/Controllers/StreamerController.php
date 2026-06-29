<?php

namespace App\Http\Controllers;

use App\Models\Live;
use App\Models\StreamKey;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StreamerController extends Controller
{
    /**
     * Cria a live do streamer (uma por dono neste MVP) + stream key.
     * POST /streamer/lives
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:120',
            'description' => 'nullable|string|max:2000',
            'freemium_seconds' => 'nullable|integer|min:0|max:86400',
        ]);

        $user = $request->user();

        $live = Live::create([
            'owner_id' => $user->id,
            'title' => $data['title'],
            'slug' => $this->uniqueSlug($data['title']),
            'description' => $data['description'] ?? null,
            'status' => 'offline',
            'visibility' => 'public',
            'freemium_seconds' => $data['freemium_seconds'] ?? null,
            'is_featured' => Live::count() === 0, // primeira live vira destaque
        ]);

        $live->streamKey()->create(['key' => StreamKey::generate()]);

        return back()->with('status', 'Live criada.');
    }

    /**
     * Atualiza campos da live (título, status ao vivo/offline, visibilidade,
     * prévia grátis, destaque). PATCH /streamer/lives/{live}
     */
    public function update(Request $request, Live $live): RedirectResponse
    {
        $this->authorize('update', $live);

        $data = $request->validate([
            'title' => 'sometimes|string|max:120',
            'description' => 'nullable|string|max:2000',
            'status' => 'sometimes|in:offline,live,ended',
            'visibility' => 'sometimes|in:public,subscribers',
            'freemium_seconds' => 'nullable|integer|min:0|max:86400',
            'is_featured' => 'sometimes|boolean',
        ]);

        // Transições de status mantêm started_at/ended_at coerentes.
        $ending = ($data['status'] ?? null) === 'ended' && $live->status !== 'ended';
        if (($data['status'] ?? null) === 'live' && $live->status !== 'live') {
            $data['started_at'] = now();
            $data['ended_at'] = null;
        } elseif (($data['status'] ?? null) === 'ended') {
            $data['ended_at'] = now();
        }

        $live->update($data);

        // Ao encerrar, materializa um VOD da transmissão (replay/Episódios).
        if ($ending) {
            $this->createVodFrom($live);
        }

        return back()->with('status', 'Live atualizada.');
    }

    /**
     * Rotaciona a stream key (revoga a anterior). POST /streamer/lives/{live}/rotate-key
     */
    public function rotateKey(Request $request, Live $live): RedirectResponse
    {
        $this->authorize('update', $live);

        $live->streamKey()->updateOrCreate([], ['key' => StreamKey::generate(), 'revoked_at' => null]);

        return back()->with('status', 'Chave rotacionada — a anterior foi revogada.');
    }

    private function createVodFrom(Live $live): void
    {
        $duration = ($live->started_at && $live->ended_at)
            ? (int) abs($live->started_at->diffInSeconds($live->ended_at))
            : 0;

        \App\Models\Vod::create([
            'live_id' => $live->id,
            'owner_id' => $live->owner_id,
            'title' => $live->title,
            'slug' => $this->uniqueSlug($live->title.'-vod', 'vods'),
            'category' => null,
            'duration_seconds' => $duration,
            'views' => 0,
            'visibility' => $live->visibility === 'subscribers' ? 'subscribers' : 'public',
            'playback_path' => "/live/{$live->id}/vod/master.m3u8",
            'published_at' => now(),
        ]);
    }

    private function uniqueSlug(string $title, string $table = 'lives'): string
    {
        $base = Str::slug($title) ?: 'live';
        $slug = $base;
        $i = 2;
        while (\Illuminate\Support\Facades\DB::table($table)->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
