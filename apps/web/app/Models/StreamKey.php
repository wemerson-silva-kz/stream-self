<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['live_id', 'key', 'revoked_at'])]
class StreamKey extends Model
{
    protected function casts(): array
    {
        return [
            'revoked_at' => 'datetime',
        ];
    }

    public static function generate(): string
    {
        return 'sk_live_'.Str::random(40);
    }

    public function isValid(): bool
    {
        return is_null($this->revoked_at);
    }

    public function live(): BelongsTo
    {
        return $this->belongsTo(Live::class);
    }
}
