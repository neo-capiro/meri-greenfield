import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/http";
import { identitySchema } from "@/shared/auth/identity";

export interface BillingReader {
  tenantId: string;
  userId: string;
}

export function currentBillingReader(cache: QueryClient): BillingReader | null {
  const state = cache.getQueryState(["identity"]);
  if (
    state?.status !== "success" ||
    state.fetchStatus !== "idle" ||
    state.isInvalidated ||
    state.error
  )
    return null;
  const identity = identitySchema.safeParse(state.data);
  if (!identity.success) return null;
  const { role, billingAdmin, user, tenant } = identity.data;
  if (
    !user.id.trim() ||
    !tenant?.id.trim() ||
    !(
      role === "capiro_admin" ||
      (role === "user_admin" && billingAdmin === true)
    )
  )
    return null;
  return { tenantId: tenant.id, userId: user.id };
}

export function assertBillingReader(cache: QueryClient, actor: BillingReader) {
  const current = currentBillingReader(cache);
  if (
    !current ||
    current.tenantId !== actor.tenantId ||
    current.userId !== actor.userId
  )
    throw new ApiError(
      403,
      "Billing permission is unavailable. Refresh your session.",
    );
}
