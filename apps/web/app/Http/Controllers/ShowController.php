<?php

namespace App\Http\Controllers;

use App\Models\Live;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ShowController extends Controller
{
    public function index(Request $request): Response
    {
        $live = Live::query()
            ->where('is_featured', true)
            ->orWhere('status', 'live')
            ->orderByDesc('is_featured')
            ->first()
            ?? Live::first();

        return Inertia::render('show', [
            'live' => $live ? [
                'id' => $live->id,
                'slug' => $live->slug,
                'title' => $live->title,
                'status' => $live->status,
            ] : null,
            // Endpoints que o front usa para buscar token e ligar nos serviços Go.
            'endpoints' => [
                'token' => $live ? route('live.token', $live->id) : null,
                'metrics' => $live ? route('live.metrics', $live->id) : null,
            ],
            // Live do streamer logado (com a stream key — só p/ o dono).
            'myLive' => $this->ownerLive($request),
            // Episódios reais (VODs). null = front usa o preview de demonstração.
            'episodes' => $this->episodes(),
        ]);
    }

    /**
     * Lista de VODs públicos publicados (Episódios). Retorna null quando vazio,
     * para o front cair no preview de demonstração.
     *
     * @return array<int, array<string, mixed>>|null
     */
    private function episodes(): ?array
    {
        $vods = \App\Models\Vod::query()
            ->whereNotNull('published_at')
            ->orderByDesc('published_at')
            ->limit(12)
            ->get();

        if ($vods->isEmpty()) {
            return null;
        }

        return $vods->map(fn (\App\Models\Vod $v) => [
            'id' => $v->id,
            'title' => $v->title,
            'date' => $v->published_at?->translatedFormat('d M'),
            'dur' => $v->durationLabel(),
            'views' => $v->viewsLabel(),
            'cat' => $v->category ?? 'Live',
            'subscribers_only' => $v->visibility === 'subscribers',
        ])->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function ownerLive(Request $request): ?array
    {
        $user = $request->user();
        if (! $user) {
            return null;
        }

        $live = $user->lives()->with('streamKey')->latest('id')->first();
        if (! $live) {
            return null;
        }

        return [
            'id' => $live->id,
            'title' => $live->title,
            'slug' => $live->slug,
            'status' => $live->status,
            'visibility' => $live->visibility,
            'freemium_seconds' => $live->freemium_seconds,
            'is_featured' => $live->is_featured,
            'stream_key' => $live->streamKey?->key,
            'rtmp_url' => config('streaming.rtmp_url'),
            'srt_url' => config('streaming.srt_url'),
        ];
    }
}
