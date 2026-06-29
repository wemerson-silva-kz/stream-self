<?php

namespace Database\Seeders;

use App\Models\Live;
use App\Models\Plan;
use App\Models\StreamKey;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $owner = User::factory()->create([
            'name' => 'Streamer Demo',
            'email' => 'test@example.com',
        ]);

        Plan::create([
            'slug' => 'free', 'name' => 'Grátis', 'price_cents' => 0,
            'currency' => 'BRL', 'features' => ['hd' => false],
            'freemium_seconds' => 1800,
        ]);

        Plan::create([
            'slug' => 'premium', 'name' => 'Premium', 'price_cents' => 1990,
            'currency' => 'BRL', 'features' => ['hd' => true, 'multi_live' => true],
            'freemium_seconds' => null, // pagantes não têm limite
        ]);

        $live = Live::create([
            'owner_id' => $owner->id,
            'title' => 'Live de Demonstração',
            'slug' => 'demo',
            'description' => 'Primeira live da plataforma.',
            'status' => 'offline',
            'visibility' => 'public',
            'freemium_seconds' => 1200, // override por live: 20 min grátis
            'is_featured' => true,
        ]);

        StreamKey::create([
            'live_id' => $live->id,
            'key' => StreamKey::generate(),
        ]);
    }
}
