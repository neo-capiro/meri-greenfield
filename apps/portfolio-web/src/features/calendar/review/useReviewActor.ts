"use client";
import { useState } from "react";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { useDispatchGuard } from "../access/public";
import type { ReviewActor } from "./contracts";

/** Bind this open review to its initiating actor; restored roles retain uncertainty. */
export function useReviewActor(runtime = false) {
  const identity = useIdentity();
  const [actor, setActor] = useState<ReviewActor>();
  if (
    !actor &&
    identity.isSuccess &&
    !identity.isFetching &&
    !identity.error &&
    identity.data.user.id.trim() &&
    identity.data.tenant?.id.trim()
  )
    setActor({
      userId: identity.data.user.id,
      tenantId: identity.data.tenant.id,
    });
  const guard = useDispatchGuard(actor?.userId, actor?.tenantId, runtime);
  const allowed = Boolean(
    actor &&
    identity.isSuccess &&
    !identity.isFetching &&
    !identity.error &&
    actor.userId === identity.data.user.id &&
    actor.tenantId === identity.data.tenant?.id &&
    (identity.data.role === "standard_user" ||
      canAdminister(identity.data.role)),
  );
  return { actor, identity, allowed, guard };
}
