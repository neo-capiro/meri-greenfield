"use client";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/http";
import {
  canAdminister,
  identitySchema,
  useIdentity,
} from "@/shared/auth/identity";
export function assertAdvocacyCorrectionAccess(
  cache: QueryClient,
  reviewActor: { userId: string | undefined; tenantId: string | undefined },
) {
  const state = cache.getQueryState(["identity"]);
  const identity = identitySchema.safeParse(cache.getQueryData(["identity"]));
  if (
    state?.status !== "success" ||
    state.isInvalidated ||
    state.fetchStatus !== "idle" ||
    !identity.success ||
    !identity.data.user.id.trim() ||
    !identity.data.tenant?.id.trim() ||
    !canAdminister(identity.data.role) ||
    identity.data.user.id !== reviewActor.userId ||
    identity.data.tenant.id !== reviewActor.tenantId
  )
    throw new ApiError(
      403,
      "Your current role cannot correct advocacy history.",
    );
}
export function useAdvocacyAccess() {
  const identity = useIdentity();
  const ready =
    !identity.isPending &&
    !identity.isFetching &&
    !identity.isPaused &&
    !identity.error &&
    Boolean(identity.data?.tenant?.id.trim()) &&
    Boolean(identity.data?.user.id.trim());
  return {
    identity,
    canRead:
      ready &&
      (identity.data?.role === "standard_user" ||
        canAdminister(identity.data?.role)),
    canEdit: ready && canAdminister(identity.data?.role),
  };
}
