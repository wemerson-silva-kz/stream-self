<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->timestamp('created_at')->nullable();
            $table->softDeletes(); // deleted_at p/ moderação

            $table->index(['live_id', 'id']); // paginação de histórico
        });

        Schema::create('chat_bans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_id')->nullable()->constrained()->cascadeOnDelete(); // NULL = global
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reason')->nullable();
            $table->timestamp('until')->nullable();
            $table->timestamps();

            $table->index(['live_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_bans');
        Schema::dropIfExists('chat_messages');
    }
};
