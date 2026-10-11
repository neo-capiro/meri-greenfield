"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import {
  prospectSchema,
  prospectListSchema,
  historySchema,
  prospectQuery,
  type ProspectFilter,
  stageCatalogSchema,
} from "./contracts";
export const prospectBase = "business-development/prospects";
export const prospectKey = (id: string) => ["prospect", id] as const;
export function useStageCatalog() {
  const api = useApi();
  return useQuery({
    queryKey: ["prospect-stage-catalog"],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(
          "core",
          "business-development/prospect-stages",
          stageCatalogSchema,
          { signal },
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}
export function useProspects(filter: ProspectFilter) {
  const api = useApi();
  const query = prospectQuery(filter);
  return useQuery({
    queryKey: ["prospects", query],
    queryFn: ({ signal }) =>
      api.request("core", `${prospectBase}?${query}`, prospectListSchema, {
        signal,
      }),
  });
}
export function useProspect(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: prospectKey(id),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `${prospectBase}/${encodeURIComponent(id)}`,
        prospectSchema,
        { signal },
      ),
  });
}
export function useProspectHistory(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["prospect-history", id],
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `${prospectBase}/${encodeURIComponent(id)}/history`,
        historySchema,
        { signal },
      ),
  });
}
