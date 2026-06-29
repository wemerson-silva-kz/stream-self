<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lives', function (Blueprint $table) {
            // subtítulo/categoria livre (ex.: "Episódio #4") — não é um "game".
            $table->string('category')->nullable()->after('description');
            $table->string('thumbnail_path')->nullable()->after('category');
        });
    }

    public function down(): void
    {
        Schema::table('lives', function (Blueprint $table) {
            $table->dropColumn(['category', 'thumbnail_path']);
        });
    }
};
