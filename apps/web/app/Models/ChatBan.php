<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['live_id', 'user_id', 'reason', 'until'])]
class ChatBan extends Model
{
    protected function casts(): array
    {
        return [
            'until' => 'datetime',
        ];
    }

    public function live(): BelongsTo
    {
        return $this->belongsTo(Live::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
