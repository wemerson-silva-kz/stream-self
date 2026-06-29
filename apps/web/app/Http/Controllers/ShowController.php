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
        // Prioriza a live que está ao vivo agora; senão a última (mais recente).
        $live = Live::query()->with('owner')
            ->where('status', 'live')
            ->latest('started_at')
            ->first()
            ?? Live::query()->with('owner')->latest('id')->first();

        $isLive = $live && $live->status === 'live';

        return Inertia::render('show', [
            'live' => $live ? [
                'id' => $live->id,
                'slug' => $live->slug,
                'title' => $live->title,
                'category' => $live->category, // subtítulo livre (ex.: "Episódio #4")
                'status' => $live->status,
                'is_live' => $isLive,
                'started_at' => $live->started_at?->toIso8601String(),
                'thumbnail_url' => $live->thumbnailUrl(),
                // frame ao vivo (gerado pelo ingest) — só existe enquanto transmite.
                'preview_url' => $isLive ? rtrim((string) config('streaming.origin_url'), '/')."/live/{$live->id}/preview.jpg" : null,
                'channel' => $live->owner?->name ?? 'brunoaiubshow',
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
            // Billing: driver ativo (stub confirma na hora; reais geram PIX/redirect).
            'billing' => ['driver' => (string) config('billing.driver', 'stub')],
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

        $origin = rtrim((string) config('streaming.origin_url'), '/');

        return $vods->map(fn (\App\Models\Vod $v) => [
            'id' => $v->id,
            'title' => $v->title,
            'date' => $v->published_at?->translatedFormat('d M'),
            'dur' => $v->durationLabel(),
            'views' => $v->viewsLabel(),
            'cat' => $v->category ?? 'Replay',
            'subscribers_only' => $v->visibility === 'subscribers',
            // playback do replay gravado (vod/master.m3u8) + token da live de origem.
            'live_id' => $v->live_id,
            'playback_url' => $v->live_id && $v->playback_path ? $origin.$v->playback_path : null,
            'token_url' => $v->live_id ? route('live.token', $v->live_id) : null,
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
            'category' => $live->category,
            'slug' => $live->slug,
            'status' => $live->status,
            'visibility' => $live->visibility,
            'freemium_seconds' => $live->freemium_seconds,
            'is_featured' => $live->is_featured,
            'thumbnail_url' => $live->thumbnailUrl(),
            'stream_key' => $live->streamKey?->key,
            'rtmp_url' => config('streaming.rtmp_url'),
            'srt_url' => config('streaming.srt_url'),
        ];
    }
}
