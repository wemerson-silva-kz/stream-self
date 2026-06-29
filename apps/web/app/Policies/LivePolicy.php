<?php

namespace App\Policies;

use App\Models\Live;
use App\Models\User;

class LivePolicy
{
    public function update(User $user, Live $live): bool
    {
        return $live->owner_id === $user->id;
    }

    public function delete(User $user, Live $live): bool
    {
        return $live->owner_id === $user->id;
    }
}
