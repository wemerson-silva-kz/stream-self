<?php

namespace App\Http\Controllers;

use App\Models\Live;
use Inertia\Inertia;
use Inertia\Response;

class ShowController extends Controller
{
    public function index(): Response
    {
        $live = Live::query()
            ->where('is_featured', true)
            ->orWhere('status', 'live')
            ->orderByDesc('is_featured')
            ->first()
            ?? Live::first();

        return Inertia::render('show', [
            'live' => $live ? [
                'id' => $live->id,
                'slug' => $live->slug,
                'title' => $live->title,
                'status' => $live->status,
            ] : null,
            // Endpoints que o front usa para buscar token e ligar nos serviços Go.
            'endpoints' => [
                'token' => $live ? route('live.token', $live->id) : null,
            ],
        ]);
    }
}
