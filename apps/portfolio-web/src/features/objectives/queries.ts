"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { scopedObjectivesSchema } from "./contracts";
export const objectivesKey = (clientId: string) =>
  ["objectives", clientId] as const;
export function useObjectives(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: objectivesKey(clientId),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${clientId}/objectives`,
        scopedObjectivesSchema(clientId),
        { signal },
      ),
  });
}
