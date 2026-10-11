import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/http";
import { identitySchema } from "@/shared/auth/identity";
export type ClientWriter = { userId: string; tenantId: string };
export function ambiguousClientWrite(error: unknown) {
  return !(
    error instanceof ApiError &&
    [400, 401, 403, 404, 409, 422].includes(error.status)
  );
}
export function currentClientWriter(
  cache: QueryClient,
): ClientWriter | undefined {
  const state = cache.getQueryState(["identity"]);
  const identity = identitySchema.safeParse(cache.getQueryData(["identity"]));
  if (
    state?.status !== "success" ||
    state.error ||
    state.isInvalidated ||
    state.fetchStatus !== "idle" ||
    !identity.success ||
    !identity.data.user.id.trim() ||
    !identity.data.tenant?.id.trim() ||
    !["standard_user", "user_admin", "capiro_admin"].includes(
      identity.data.role ?? "",
    )
  )
    return;
  return { userId: identity.data.user.id, tenantId: identity.data.tenant.id };
}
export function assertClientWriter(cache: QueryClient, actor: ClientWriter) {
  const current = currentClientWriter(cache);
  if (
    !current ||
    current.userId !== actor.userId ||
    current.tenantId !== actor.tenantId
  )
    throw new ApiError(
      403,
      "Your current session cannot change this client record.",
    );
}
