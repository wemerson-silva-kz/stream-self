<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyInternalSecret
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) env('INTERNAL_SECRET', '');

        if ($expected === '' || ! hash_equals($expected, (string) $request->header('X-Internal-Secret'))) {
            abort(403, 'forbidden');
        }

        return $next($request);
    }
}
