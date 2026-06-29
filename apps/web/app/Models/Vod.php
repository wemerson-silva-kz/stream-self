<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'live_id', 'owner_id', 'title', 'slug', 'category',
    'duration_seconds', 'views', 'visibility', 'playback_path', 'published_at',
])]
class Vod extends Model
{
    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function live(): BelongsTo
    {
        return $this->belongsTo(Live::class);
    }

    /** Duração legível: "1h 42min" / "44min". */
    public function durationLabel(): string
    {
        $h = intdiv($this->duration_seconds, 3600);
        $m = intdiv($this->duration_seconds % 3600, 60);

        return $h > 0 ? "{$h}h {$m}min" : "{$m}min";
    }

    /** Views legível: 1.2k / 48k. */
    public function viewsLabel(): string
    {
        if ($this->views >= 1000) {
            return rtrim(rtrim(number_format($this->views / 1000, 1), '0'), '.').'k';
        }

        return (string) $this->views;
    }
}
