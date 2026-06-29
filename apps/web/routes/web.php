<?php

use App\Http\Controllers\BillingController;
use App\Http\Controllers\Internal\StreamKeyController;
use App\Http\Controllers\LiveMetricsController;
use App\Http\Controllers\LiveTokenController;
use App\Http\Controllers\ModerationController;
use App\Http\Controllers\ShowController;
use App\Http\Controllers\StreamerController;
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
    Route::get('live/{live}/metrics', [LiveMetricsController::class, 'show'])
        ->name('live.metrics');
});

// Billing / assinaturas.
Route::middleware('auth')->group(function () {
    Route::post('billing/subscribe', [BillingController::class, 'subscribe'])->name('billing.subscribe');

    // Painel do streamer: gestão da própria live.
    Route::post('streamer/lives', [StreamerController::class, 'store'])->name('streamer.lives.store');
    Route::patch('streamer/lives/{live}', [StreamerController::class, 'update'])->name('streamer.lives.update');
    Route::post('streamer/lives/{live}/rotate-key', [StreamerController::class, 'rotateKey'])->name('streamer.lives.rotate');

    // Moderação (só o dono): publica eventos no Redis pros nós de chat.
    Route::post('streamer/lives/{live}/moderation/delete', [ModerationController::class, 'deleteMessage'])->name('mod.delete');
    Route::post('streamer/lives/{live}/moderation/ban', [ModerationController::class, 'ban'])->name('mod.ban');
    Route::post('streamer/lives/{live}/moderation/unban', [ModerationController::class, 'unban'])->name('mod.unban');
    Route::post('streamer/lives/{live}/moderation/mode', [ModerationController::class, 'mode'])->name('mod.mode');
    Route::post('streamer/lives/{live}/moderation/clear', [ModerationController::class, 'clear'])->name('mod.clear');
});
// Webhooks dos providers (sem auth/CSRF — validados pela assinatura do provider).
Route::post('webhooks/{provider}', [BillingController::class, 'webhook'])->name('billing.webhook');

// Rotas internas: somente serviços Go (ingest). Protegidas por segredo compartilhado.
Route::prefix('internal')->middleware(VerifyInternalSecret::class)->group(function () {
    Route::get('stream-keys/resolve', [StreamKeyController::class, 'resolve'])
        ->name('internal.stream-keys.resolve');
});

require __DIR__.'/settings.php';
