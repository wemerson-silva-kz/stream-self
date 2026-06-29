<?php

namespace App\Http\Controllers;

use App\Models\Live;
use App\Support\StreamRedis;
use Illuminate\Http\JsonResponse;

class LiveMetricsController extends Controller
{
    /**
     * Métricas em tempo real lidas do Redis (escritas pelo chat Go).
     * GET /api/live/{live}/metrics
     */
    public function show(Live $live): JsonResponse
    {
        $viewers = max(0, (int) StreamRedis::get("viewers:{$live->id}"));

        // soma a janela do minuto atual + a anterior (suaviza a virada de minuto).
        $minute = intdiv(time(), 60);
        $msgs = (int) StreamRedis::get("msgs:{$live->id}:{$minute}")
            + (int) StreamRedis::get('msgs:'.$live->id.':'.($minute - 1));

        return response()->json([
            'viewers' => $viewers,
            'msgs_per_min' => $msgs,
            'status' => $live->status,
            // true quando há sinal real do plano Go; o front usa para decidir
            // entre números reais e o preview de demonstração.
            'live_data' => $viewers > 0 || $msgs > 0,
        ]);
    }
}
