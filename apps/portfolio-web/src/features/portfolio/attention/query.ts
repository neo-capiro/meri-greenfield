"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import type { ApiClient } from "@/shared/api/http";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { portfolioAlertsSchema, type AttentionClient } from "./contracts";

export function loadPortfolioAlerts(api: ApiClient, signal?: AbortSignal) {
  return api.request(
    "core",
    "intelligence/portfolio-alerts?limit=50",
    portfolioAlertsSchema,
    { signal },
  );
}

export function usePortfolioAttention(clients: readonly AttentionClient[]) {
  const api = useApi();
  const identity = useIdentity();
  const permitted =
    !identity.isPending &&
    !identity.error &&
    Boolean(identity.data?.tenant?.id) &&
    (identity.data?.role === "standard_user" ||
      canAdminister(identity.data?.role));
  const alerts = useQuery({
    queryKey: [
      "portfolio-attention",
      identity.data?.tenant?.id,
      identity.data?.user.id,
      clients.map((client) => client.id).sort(),
    ],
    enabled: permitted && clients.length > 0,
    queryFn: ({ signal }) => loadPortfolioAlerts(api, signal),
    staleTime: 120_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  return { identity, permitted, alerts };
}
