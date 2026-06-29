<?php

namespace App\Console\Commands;

use App\Models\Live;
use Illuminate\Console\Command;

class SetFsec extends Command
{
    protected $signature = 'stream:fsec {seconds}';

    protected $description = 'Ajusta freemium_seconds da primeira live (para testes de paywall)';

    public function handle(): int
    {
        $live = Live::first();
        $live->update(['freemium_seconds' => (int) $this->argument('seconds')]);
        $this->info("live #{$live->id} freemium_seconds = {$live->freemium_seconds}");

        return self::SUCCESS;
    }
}
