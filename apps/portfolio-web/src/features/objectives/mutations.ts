"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { acknowledged } from "@/shared/api/http";
import { objectivesKey } from "./queries";
import {
  saveObjective,
  type SaveObjective,
  type ObjectiveAction,
} from "./writer";
import type { Objective } from "./contracts";
export function useSaveObjective(
  clientId: string,
  input: SaveObjective,
  onPersisted: (record: Objective) => void,
  onSaved: () => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  const invalidate = () =>
    cache.invalidateQueries({ queryKey: objectivesKey(clientId) });
  return useMutation({
    mutationFn: (action: ObjectiveAction) =>
      saveObjective(api, clientId, input, action, onPersisted),
    onSuccess: async () => {
      await invalidate();
      onSaved();
    },
    onError: invalidate,
  });
}
export function useDeleteObjective(clientId: string, onRemoved: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (objective: Objective) =>
      api.request(
        "core",
        `clients/${clientId}/objectives?objectiveId=${encodeURIComponent(objective.id)}`,
        acknowledged,
        { method: "DELETE", body: { expectedVersion: objective.version } },
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: objectivesKey(clientId) });
      onRemoved();
    },
  });
}
