<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Models\StreamKey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Rota interna consumida pelo serviço Go de ingest. Protegida por um segredo
 * compartilhado (X-Internal-Secret), nunca exposta à internet pública.
 */
class StreamKeyController extends Controller
{
    public function resolve(Request $request): JsonResponse
    {
        $key = (string) $request->query('key');

        $streamKey = StreamKey::where('key', $key)->first();

        if (! $streamKey || ! $streamKey->isValid()) {
            return response()->json(['valid' => false], 200);
        }

        // Marca a live como ao vivo ao receber ingest válido.
        $streamKey->live()->update([
            'status' => 'live',
            'started_at' => now(),
        ]);

        return response()->json([
            'valid' => true,
            'live_id' => $streamKey->live_id,
        ]);
    }
}
