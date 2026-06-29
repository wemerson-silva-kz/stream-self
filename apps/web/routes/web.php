<?php

use App\Http\Controllers\Internal\StreamKeyController;
use App\Http\Controllers\LiveTokenController;
use App\Http\Controllers\ShowController;
use App\Http\Middleware\VerifyInternalSecret;
use Illuminate\Support\Facades\Route;

Route::get('/', [ShowController::class, 'index'])->name('home');
Route::get('/show', [ShowController::class, 'index'])->name('show');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

// API do plano de dados (consumida pelo player React e validada pelos serviços Go).
// 'auth' opcional: a rota funciona p/ anônimo, mas pega o user se houver sessão.
Route::middleware(['web'])->prefix('api')->group(function () {
    Route::get('live/{live}/token', [LiveTokenController::class, 'issue'])
        ->name('live.token');
});

// Rotas internas: somente serviços Go (ingest). Protegidas por segredo compartilhado.
Route::prefix('internal')->middleware(VerifyInternalSecret::class)->group(function () {
    Route::get('stream-keys/resolve', [StreamKeyController::class, 'resolve'])
        ->name('internal.stream-keys.resolve');
});

require __DIR__.'/settings.php';
