<?php

namespace App\Console\Commands;

use App\Models\Live;
use Illuminate\Console\Command;

class SetLiveInfo extends Command
{
    protected $signature = 'stream:set-info {live} {--title=} {--category=}';

    protected $description = 'Define título/categoria de uma live (debug)';

    public function handle(): int
    {
        $live = Live::find((int) $this->argument('live'));
        if (! $live) {
            $this->error('Live não encontrada.');

            return self::FAILURE;
        }
        $data = [];
        if ($this->option('title') !== null) {
            $data['title'] = $this->option('title');
        }
        if ($this->option('category') !== null) {
            $data['category'] = $this->option('category');
        }
        $live->update($data);
        $this->info("live #{$live->id}: title={$live->title} | category={$live->category}");

        return self::SUCCESS;
    }
}
