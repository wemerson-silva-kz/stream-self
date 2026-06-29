<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();          // free | basic | premium
            $table->string('name');
            $table->integer('price_cents')->default(0);
            $table->string('currency', 3)->default('BRL');
            $table->json('features')->nullable();        // {"hd": true, "multi_live": true}
            $table->integer('freemium_seconds')->nullable(); // override do paywall por plano
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
