"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { acknowledged } from "@/shared/api/http";
import { clientKey } from "@/features/portfolio/public";
import { facilitySchema } from "./contracts";
import { profileKey } from "./queries";
export function useSaveFacility(
  clientId: string,
  facilityId: string | undefined,
  onSaved: () => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.request(
        "core",
        `clients/${clientId}/facilities${facilityId ? `/${encodeURIComponent(facilityId)}` : ""}`,
        facilitySchema.refine(
          (facility) =>
            facility.clientId === clientId &&
            (!facilityId || facility.id === facilityId),
        ),
        { method: facilityId ? "PATCH" : "POST", body },
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({
        queryKey: profileKey(clientId, "facilities"),
      });
      await cache.invalidateQueries({
        queryKey: profileKey(clientId, "representation"),
      });
      await cache.invalidateQueries({
        queryKey: profileKey(clientId, "district-nexus"),
      });
      onSaved();
    },
  });
}
export function useSaveProfileNotes(clientId: string, onSaved: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (notes: string) =>
      api.request("core", `clients/${clientId}/profile-notes`, acknowledged, {
        method: "PUT",
        body: { notes },
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: clientKey(clientId) });
      onSaved();
    },
  });
}
export type TeamChange =
  | { kind: "add"; userId: string; role: string }
  | { kind: "remove"; userId: string }
  | { kind: "owner"; userId: string | null };
export function useChangeTeam(clientId: string) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (change: TeamChange) => {
      if (change.kind === "owner")
        return api.request(
          "core",
          `client-account-owners/${clientId}`,
          acknowledged,
          { method: "PUT", body: { accountOwnerUserId: change.userId } },
        );
      if (change.kind === "remove")
        return api.request(
          "core",
          `clients/${clientId}/team?userId=${encodeURIComponent(change.userId)}`,
          acknowledged,
          { method: "DELETE" },
        );
      return api.request("core", `clients/${clientId}/team`, acknowledged, {
        method: "POST",
        body: { userId: change.userId, role: change.role },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: profileKey(clientId, "team") }),
        cache.invalidateQueries({ queryKey: ["account-owners"] }),
      ]);
    },
  });
}
