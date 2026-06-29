<?php

namespace App\Services;

use App\Models\Live;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Support\Str;

/**
 * Emite o "passaporte" assinado que o player envia ao edge Go (vídeo) e ao
 * serviço de chat. O Go valida a assinatura e confia em tier/fsec/scope.
 *
 * Resolução de freemium: live > plano > global.
 */
class ViewerTokenService
{
    /**
     * @return array{token: string, expires_at: int, tier: string, fsec: int}
     */
    public function issue(Live $live, ?User $user, array $scopes = ['watch', 'chat']): array
    {
        [$tier, $fsec] = $this->resolveTierAndFreemium($live, $user);

        $now = time();
        $exp = $now + (int) config('streaming.viewer_token_ttl');

        $sub = $user
            ? 'user:'.$user->id
            : 'anon:'.Str::uuid()->toString();

        $payload = [
            'sub' => $sub,
            'live' => 'live:'.$live->id,
            'tier' => $tier,            // free | paid
            'fsec' => $fsec,            // freemium_seconds resolvido
            'scope' => implode(' ', $scopes),
            'name' => $user?->name ?? 'Convidado',
            'iat' => $now,
            'exp' => $exp,
        ];

        $alg = (string) config('streaming.jwt_alg');
        $key = str_starts_with($alg, 'RS')
            ? (string) file_get_contents((string) config('streaming.jwt_private_key'))
            : (string) config('streaming.jwt_secret');

        $token = JWT::encode($payload, $key, $alg);

        return [
            'token' => $token,
            'expires_at' => $exp,
            'tier' => $tier,
            'fsec' => $fsec,
        ];
    }

    /**
     * @return array{0: string, 1: int}  [tier, freemium_seconds]
     */
    public function resolveTierAndFreemium(Live $live, ?User $user): array
    {
        $sub = $user?->activeSubscription();
        $tier = $sub ? 'paid' : 'free';

        $fsec = $live->freemium_seconds
            ?? $sub?->plan?->freemium_seconds
            ?? (int) config('streaming.global_freemium_seconds');

        return [$tier, (int) $fsec];
    }
}
