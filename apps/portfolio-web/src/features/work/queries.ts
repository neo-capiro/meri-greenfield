"use client";
import { useQuery, useQueries } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/shared/api/provider";
import {
  strategySummarySchema,
  strategyDetailSchema,
  workspaceDraftSchema,
} from "./contracts";
export function useStrategies(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["strategies", clientId],
    queryFn: async ({ signal }) => {
      const all = await api.request(
        "strategy",
        "strategies",
        z.array(strategySummarySchema),
        { signal },
      );
      return all.filter((strategy) => strategy.clientId === clientId);
    },
  });
}
export function useStrategyDetails(ids: string[]) {
  const api = useApi();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ["strategy-detail", id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.request("strategy", `strategies/${id}`, strategyDetailSchema, {
          signal,
        }),
    })),
  });
}
export function useWorkspaceDrafts() {
  const api = useApi();
  return useQuery({
    queryKey: ["workspace-drafts"],
    queryFn: ({ signal }) =>
      api.request(
        "workspace",
        "drafts?scope=all",
        z.object({ drafts: z.array(workspaceDraftSchema) }),
        { signal },
      ),
  });
}
