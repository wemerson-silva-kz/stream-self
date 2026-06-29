<?php

namespace App\Console\Commands;

use App\Models\Live;
use App\Models\User;
use App\Services\ViewerTokenService;
use Illuminate\Console\Command;

class ProbeToken extends Command
{
    protected $signature = 'stream:probe';

    protected $description = 'Emite tokens de viewer de exemplo para validar o fluxo';

    public function handle(ViewerTokenService $svc): int
    {
        $live = Live::first();
        if (! $live) {
            $this->error('Nenhuma live encontrada. Rode db:seed.');

            return self::FAILURE;
        }

        $anon = $svc->issue($live, null);
        $user = $svc->issue($live, User::first());

        $this->info("LIVE: {$live->title} (fsec_override={$live->freemium_seconds})");
        $this->line("ANON  tier={$anon['tier']} fsec={$anon['fsec']}");
        $this->line("USER  tier={$user['tier']} fsec={$user['fsec']}");
        $this->line('JWT(anon)='.substr($anon['token'], 0, 50).'...');

        return self::SUCCESS;
    }
}
