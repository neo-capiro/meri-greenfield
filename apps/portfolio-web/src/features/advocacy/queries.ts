"use client";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { matterSchema, matterDetailSchema } from "./contracts";
export const mattersKey = (clientId: string) =>
  ["advocacy", clientId, "matters"] as const;
export function useMatters(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: mattersKey(clientId),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${clientId}/advocacy-matters`,
        z.array(matterSchema),
        { signal },
      ),
  });
}
export function useMatter(clientId: string, id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["advocacy", clientId, "matter", id],
    enabled: Boolean(id),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${clientId}/advocacy-matters/${id}`,
        matterDetailSchema,
        { signal },
      ),
  });
}
