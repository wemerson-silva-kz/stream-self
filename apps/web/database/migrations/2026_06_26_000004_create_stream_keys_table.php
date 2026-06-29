<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stream_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('key')->unique();              // segredo do OBS; rotacionável
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stream_keys');
    }
};
