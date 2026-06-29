<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'owner_id', 'title', 'slug', 'description', 'category', 'thumbnail_path', 'status',
    'visibility', 'freemium_seconds', 'is_featured', 'started_at', 'ended_at',
])]
class Live extends Model
{
    protected function casts(): array
    {
        return [
            'is_featured' => 'boolean',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    /** URL pública da thumbnail (ou null). */
    public function thumbnailUrl(): ?string
    {
        return $this->thumbnail_path ? asset('storage/'.$this->thumbnail_path) : null;
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function streamKey(): HasOne
    {
        return $this->hasOne(StreamKey::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }
}
