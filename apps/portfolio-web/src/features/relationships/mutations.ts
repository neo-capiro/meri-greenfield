"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { acknowledged } from "@/shared/api/http";
import { personSchema, type Person } from "./contracts";
import { peopleKey } from "./queries";
type HierarchyInput = {
  hierarchyLevel?: Person["hierarchyLevel"];
  reportsToPersonId?: string | null;
  resetToAutomatic?: boolean;
  reviewRequired?: boolean;
};
type ContactInput = {
  name: string;
  title: string;
  email: string | null;
  phone: string;
  role: string;
  notes: string;
};
export type PersonChange =
  | { kind: "save"; id?: string; body: ContactInput }
  | { kind: "hierarchy"; id: string; body: HierarchyInput }
  | { kind: "delete"; id: string };
export function usePersonMutation(clientId: string, onSaved?: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (change: PersonChange) => {
      const root = `clients/${clientId}/people`;
      if (change.kind === "delete")
        return api.request("core", `${root}/${change.id}`, acknowledged, {
          method: "DELETE",
        });
      if (change.kind === "hierarchy")
        return api.request(
          "core",
          `${root}/${change.id}/hierarchy`,
          personSchema,
          { method: "PATCH", body: change.body },
        );
      return api.request(
        "core",
        `${root}${change.id ? `/${change.id}` : ""}`,
        personSchema,
        { method: change.id ? "PATCH" : "POST", body: change.body },
      );
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: peopleKey(clientId) });
      onSaved?.();
    },
  });
}
