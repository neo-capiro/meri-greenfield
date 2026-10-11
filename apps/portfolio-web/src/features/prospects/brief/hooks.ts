"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import {
  readBrief,
  writeBrief,
  type BriefScope,
  type CreateInput,
  type SaveInput,
} from "./api";
export const briefKey = (scope: BriefScope) =>
  ["prospect-brief", scope.tenantId, scope.prospectId] as const;
export function useBrief(scope: BriefScope | null) {
  const api = useApi();
  return useQuery({
    queryKey: scope ? briefKey(scope) : ["prospect-brief", "unavailable"],
    enabled: !!scope,
    queryFn: ({ signal }) => {
      if (!scope) throw new Error("Select an authorized account first.");
      return readBrief(api, scope, signal);
    },
  });
}
export function useWriteBrief(scope: BriefScope) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (input: CreateInput | SaveInput) =>
      writeBrief(api, scope, input),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: briefKey(scope) }),
        cache.invalidateQueries({
          queryKey: [
            "prospect-brief-history",
            scope.tenantId,
            scope.prospectId,
          ],
        }),
        cache.invalidateQueries({
          queryKey: ["prospect-history", scope.prospectId],
        }),
      ]);
    },
  });
}
