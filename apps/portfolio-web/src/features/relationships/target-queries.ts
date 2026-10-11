"use client";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import {
  targetSchema,
  recommendationsSchema,
  type GovernmentTarget,
} from "./target-contracts";
export const targetsKey = (clientId: string) => ["client-targets", clientId];
const base = (clientId: string) =>
  `clients/${encodeURIComponent(clientId)}/targets`;
export function useGovernmentTargets(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: targetsKey(clientId),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        base(clientId),
        z
          .array(targetSchema)
          .refine(
            (rows) => rows.every((row) => row.clientId === clientId),
            "Target client mismatch",
          ),
        { signal },
      ),
  });
}
type TargetWrite =
  | {
      kind: "add";
      memberId: string;
      sourceDirectory: GovernmentTarget["sourceDirectory"];
      source: "manual" | "meri";
    }
  | { kind: "tier"; memberId: string; tier: number | null }
  | { kind: "remove"; memberId: string };
export function useTargetMutation(clientId: string, onSaved?: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationKey: ["client-target-write", clientId],
    mutationFn: async (write: TargetWrite) => {
      if (write.kind === "remove") {
        await api.request(
          "core",
          `${base(clientId)}?${new URLSearchParams({ memberId: write.memberId })}`,
          z.object({ deleted: z.literal(true) }),
          { method: "DELETE" },
        );
        return;
      }
      const schema = targetSchema.refine(
        (row) =>
          row.clientId === clientId &&
          row.memberId === write.memberId &&
          (write.kind !== "add" ||
            row.sourceDirectory === write.sourceDirectory),
        "Target association mismatch",
      );
      if (write.kind === "tier")
        await api.request("core", `${base(clientId)}/tier`, schema, {
          method: "PATCH",
          body: { memberId: write.memberId, tier: write.tier },
        });
      else
        await api.request("core", base(clientId), schema, {
          method: "POST",
          body: {
            memberId: write.memberId,
            sourceDirectory: write.sourceDirectory,
            source: write.source,
          },
        });
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: targetsKey(clientId) });
      onSaved?.();
    },
  });
}
export function useTargetRecommendations(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["target-recommendations", clientId],
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${clientId}/target-recommendations`,
        recommendationsSchema,
        { signal },
      ),
  });
}
export function useRefreshTargetRecommendations(clientId: string) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.request(
        "core",
        `clients/${clientId}/target-recommendations/refresh`,
        recommendationsSchema,
        { method: "POST", body: {} },
      ),
    onSuccess: (result) => {
      cache.setQueryData(["target-recommendations", clientId], result);
    },
  });
}
