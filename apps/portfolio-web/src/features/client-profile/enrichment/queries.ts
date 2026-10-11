"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { runSchema, setupSchema } from "./contracts";
export const enrichmentKey = (clientId: string) =>
  ["client-enrichment", clientId] as const;
export const latestReviewKey = (
  clientId: string,
  actor: { tenantId: string | undefined; userId: string | undefined },
) =>
  [...enrichmentKey(clientId), "latest", actor.tenantId, actor.userId] as const;
export const setupKey = (
  clientId: string,
  actor: { tenantId: string | undefined; userId: string | undefined },
) =>
  [...enrichmentKey(clientId), "setup", actor.tenantId, actor.userId] as const;
export const enrichmentPath = (clientId: string) =>
  `clients/${encodeURIComponent(clientId)}/fill-with-meri`;
export async function loadRun(
  api: ApiClient,
  clientId: string,
  runId: string,
  signal?: AbortSignal,
) {
  const run = await api.request(
    "core",
    `${enrichmentPath(clientId)}/runs/${encodeURIComponent(runId)}`,
    runSchema,
    { signal },
  );
  if (run.clientId !== clientId || run.id !== runId)
    throw new ApiError(502, "The review returned a different client or run.");
  return run;
}
export function useEnrichmentAccess() {
  const identity = useIdentity();
  const ready =
    !identity.isPending &&
    !identity.isFetching &&
    !identity.isPaused &&
    !identity.error &&
    Boolean(identity.data?.user.id.trim()) &&
    Boolean(identity.data?.tenant?.id.trim());
  return {
    identity,
    canRead:
      ready &&
      (identity.data?.role === "standard_user" ||
        canAdminister(identity.data?.role)),
    canEdit: ready && canAdminister(identity.data?.role),
  };
}
export function useLatestReview(clientId: string, enabled: boolean) {
  const api = useApi();
  const { identity, canRead } = useEnrichmentAccess();
  return useQuery({
    queryKey: latestReviewKey(clientId, {
      tenantId: identity.data?.tenant?.id,
      userId: identity.data?.user.id,
    }),
    enabled: enabled && canRead,
    retry: false,
    queryFn: async ({ signal }) => {
      const run = await api.request(
        "core",
        `${enrichmentPath(clientId)}/latest`,
        runSchema.nullable(),
        { signal },
      );
      if (run && run.clientId !== clientId)
        throw new ApiError(502, "The review returned a different client.");
      return run;
    },
    refetchInterval: (q) =>
      !q.state.error && q.state.data?.status === "running" ? 2000 : false,
  });
}
export function useEnrichmentSetup(clientId: string, enabled: boolean) {
  const api = useApi();
  const { identity, canRead } = useEnrichmentAccess();
  return useQuery({
    queryKey: setupKey(clientId, {
      tenantId: identity.data?.tenant?.id,
      userId: identity.data?.user.id,
    }),
    enabled: enabled && canRead,
    retry: false,
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `${enrichmentPath(clientId)}/setup`,
        setupSchema.refine((s) => s.clientId === clientId),
        { signal },
      ),
  });
}
