<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'plan_id', 'status', 'provider', 'provider_ref', 'current_period_end'])]
class Subscription extends Model
{
    protected function casts(): array
    {
        return [
            'current_period_end' => 'datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === 'active'
            && (is_null($this->current_period_end) || $this->current_period_end->isFuture());
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }
}
