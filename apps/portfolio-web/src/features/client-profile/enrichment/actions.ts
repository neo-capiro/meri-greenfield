import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { identitySchema, canAdminister } from "@/shared/auth/identity";
import { canSelectFinding, runSchema, type FillRun } from "./contracts";
import { enrichmentPath, loadRun } from "./queries";
export type ReviewActor = { userId: string; tenantId: string };
export type ReviewAction =
  | { kind: "apply"; findingIds: string[] }
  | { kind: "cancel" }
  | { kind: "reject"; findingId: string; reason: string }
  | { kind: "restore"; findingId: string }
  | {
      kind: "assign";
      findingId: string;
      target: { matterId: string } | { newMatter: { title: string } };
    };
export function assertReviewAccess(
  cache: QueryClient,
  actor: ReviewActor,
  admin: boolean,
) {
  const state = cache.getQueryState(["identity"]);
  const parsed = identitySchema.safeParse(cache.getQueryData(["identity"]));
  if (
    state?.status !== "success" ||
    Boolean(state.error) ||
    state.isInvalidated ||
    state.fetchStatus !== "idle" ||
    !parsed.success ||
    !parsed.data.user.id.trim() ||
    !parsed.data.tenant?.id.trim() ||
    parsed.data.user.id !== actor.userId ||
    parsed.data.tenant.id !== actor.tenantId ||
    !(
      canAdminister(parsed.data.role) ||
      (!admin && parsed.data.role === "standard_user")
    )
  )
    throw new ApiError(
      403,
      "Your current session cannot perform this review action.",
    );
}
function selectedUnchanged(before: FillRun, after: FillRun, ids: string[]) {
  return ids.every((id) => {
    const a = before.findings.find((f) => f.id === id);
    const b = after.findings.find((f) => f.id === id);
    return a && b && JSON.stringify(a) === JSON.stringify(b);
  });
}
export async function executeReviewAction(
  api: ApiClient,
  clientId: string,
  review: FillRun,
  action: ReviewAction,
  guard: () => void,
  signal: AbortSignal,
  onDispatched: () => void,
) {
  guard();
  const fresh = await loadRun(api, clientId, review.id, signal);
  guard();
  signal.throwIfAborted();
  const ids =
    action.kind === "apply"
      ? action.findingIds
      : "findingId" in action
        ? [action.findingId]
        : [];
  if (
    ids.length &&
    (!selectedUnchanged(review, fresh, ids) || new Set(ids).size !== ids.length)
  )
    throw new ApiError(
      409,
      "Findings changed. Refresh and review them again; your selection has been preserved.",
    );
  if (
    action.kind === "apply" &&
    (!ids.length ||
      ids.length > 200 ||
      ids.some(
        (id) => !fresh.findings.some((f) => f.id === id && canSelectFinding(f)),
      ))
  )
    throw new ApiError(400, "Select up to 200 pending, supported findings.");
  const finding =
    "findingId" in action
      ? fresh.findings.find((f) => f.id === action.findingId)
      : undefined;
  if (
    action.kind === "reject" &&
    (finding?.status !== "pending" || action.reason.trim().length > 1000)
  )
    throw new ApiError(
      400,
      "Only pending findings can be ignored; reasons must be at most 1000 characters.",
    );
  if (action.kind === "restore" && finding?.status !== "rejected")
    throw new ApiError(409, "Only ignored findings can be restored.");
  if (action.kind === "cancel" && fresh.status !== "running")
    throw new ApiError(409, "This run is no longer running.");
  if (
    action.kind === "assign" &&
    (finding?.kind !== "advocacy_record" ||
      finding.status !== "pending" ||
      ("newMatter" in action.target &&
        (!action.target.newMatter.title.trim() ||
          action.target.newMatter.title.length > 300)))
  )
    throw new ApiError(
      400,
      "Review a pending advocacy finding and choose a matter or a new title.",
    );
  guard();
  signal.throwIfAborted();
  onDispatched();
  const path = enrichmentPath(clientId);
  const runPath = `${path}/runs/${review.id}`;
  if (action.kind === "apply" || action.kind === "cancel") {
    const result = await api.request(
      "core",
      `${runPath}/${action.kind}`,
      runSchema.refine((r) => r.id === review.id && r.clientId === clientId),
      {
        method: "POST",
        body: action.kind === "apply" ? { findingIds: ids } : {},
        signal,
      },
    );
    if (action.kind === "cancel" && result.status !== "cancelled")
      throw new ApiError(
        502,
        "Cancellation was not confirmed by the saved run.",
      );
    return result;
  }
  if (action.kind === "assign")
    await api.request(
      "core",
      `${runPath}/findings/${action.findingId}/assign-matter`,
      z
        .object({
          findingId: z.literal(action.findingId),
          matterId: z.string().uuid().nullable(),
          alreadyApplied: z.boolean(),
        })
        .refine((r) =>
          "matterId" in action.target
            ? r.matterId === action.target.matterId
            : r.matterId !== null,
        ),
      { method: "POST", body: action.target, signal },
    );
  else
    await api.request(
      "core",
      `${path}/findings/${action.findingId}/${action.kind}`,
      z.object({ ok: z.literal(true) }),
      {
        method: "POST",
        body: action.kind === "reject" ? { reason: action.reason.trim() } : {},
        signal,
      },
    );
  guard();
  signal.throwIfAborted();
  const result = await loadRun(api, clientId, review.id, signal);
  const expected =
    action.kind === "reject"
      ? "rejected"
      : action.kind === "restore"
        ? "pending"
        : "accepted";
  if (
    result.findings.find((f) => f.id === action.findingId)?.status !== expected
  )
    throw new ApiError(
      502,
      "The saved finding did not confirm the requested review state.",
    );
  return result;
}
