<?php

namespace App\Console\Commands;

use App\Models\Live;
use App\Models\Vod;
use Illuminate\Console\Command;

class MakeTestVod extends Command
{
    protected $signature = 'stream:make-vod {live}';

    protected $description = 'Cria/atualiza um VOD de teste apontando para a gravação da live';

    public function handle(): int
    {
        $live = Live::find((int) $this->argument('live'));
        if (! $live) {
            $this->error('Live não encontrada.');

            return self::FAILURE;
        }

        $vod = Vod::updateOrCreate(
            ['live_id' => $live->id],
            [
                'owner_id' => $live->owner_id,
                'title' => $live->title.' (replay)',
                'slug' => 'replay-live-'.$live->id,
                'category' => $live->category ?? 'Replay',
                'duration_seconds' => 600,
                'views' => 0,
                'visibility' => 'public',
                'playback_path' => "/live/{$live->id}/vod/master.m3u8",
                'published_at' => now(),
            ],
        );

        $this->info("VOD #{$vod->id} pronto para a live #{$live->id} ({$vod->playback_path})");

        return self::SUCCESS;
    }
}
