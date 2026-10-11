"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/shared/api/provider";
import { facilitySchema } from "./contracts";
import { profileKey } from "./queries";

export type FacilityAction =
  | { kind: "resolve-district" | "geocode"; facilityId: string }
  | {
      kind: "geocode-candidate";
      facilityId: string;
      candidateIndex: number;
      expectedRevision: string;
    }
  | { kind: "remove"; facilityId: string };
export function useFacilityAction(clientId: string) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (action: FacilityAction) => {
      const path = `clients/${clientId}/facilities/${encodeURIComponent(action.facilityId)}`;
      if (action.kind === "remove") {
        await api.request(
          "core",
          path,
          z.object({ deleted: z.literal(true) }),
          { method: "DELETE" },
        );
        return null;
      }
      return api.request(
        "core",
        `${path}/${action.kind === "geocode-candidate" ? "geocode-candidate/reviewed" : action.kind}`,
        facilitySchema.refine(
          (facility) =>
            facility.clientId === clientId && facility.id === action.facilityId,
        ),
        {
          method: "POST",
          body:
            action.kind === "geocode-candidate"
              ? {
                  candidateIndex: action.candidateIndex,
                  expectedRevision: action.expectedRevision,
                }
              : undefined,
        },
      );
    },
    onSuccess: async () => {
      await Promise.all(
        ["facilities", "representation", "district-nexus"].map((section) =>
          cache.invalidateQueries({ queryKey: profileKey(clientId, section) }),
        ),
      );
    },
    onError: async (_error, action) => {
      if (action.kind === "geocode-candidate") {
        await cache.invalidateQueries({
          queryKey: profileKey(clientId, "facilities"),
        });
      }
    },
  });
}
