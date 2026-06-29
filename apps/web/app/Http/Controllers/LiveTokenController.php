<?php

namespace App\Http\Controllers;

use App\Models\Live;
use App\Services\ViewerTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LiveTokenController extends Controller
{
    public function __construct(private readonly ViewerTokenService $tokens)
    {
    }

    /**
     * Emite (ou renova) o JWT de viewer para uma live.
     * GET /api/live/{live}/token
     */
    public function issue(Request $request, Live $live): JsonResponse
    {
        // Lives "subscribers" exigem usuário autenticado.
        if ($live->visibility === 'subscribers' && ! $request->user()) {
            return response()->json(['message' => 'Autenticação necessária.'], 401);
        }

        $result = $this->tokens->issue($live, $request->user());

        return response()->json([
            'token' => $result['token'],
            'expires_at' => $result['expires_at'],
            'tier' => $result['tier'],
            'freemium_seconds' => $result['fsec'],
            'origin_url' => config('streaming.origin_url'),
            'chat_ws_url' => config('streaming.chat_ws_url'),
            'playback_url' => rtrim(config('streaming.origin_url'), '/')."/live/{$live->id}/master.m3u8",
        ]);
    }
}
