<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('category')->nullable();
            $table->integer('duration_seconds')->default(0);
            $table->unsignedBigInteger('views')->default(0);
            $table->string('visibility')->default('public'); // public | subscribers
            $table->string('playback_path')->nullable();      // master.m3u8 do VOD gravado
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['visibility', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vods');
    }
};
