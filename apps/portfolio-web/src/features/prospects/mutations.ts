"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { prospectBase, prospectKey } from "./queries";
import {
  prospectSchema,
  prospectInputSchema,
  historySchema,
  type Prospect,
  type ProspectInput,
  type StageCatalog,
  isPortfolioStage,
} from "./contracts";
function useRefreshProspect(id?: string) {
  const cache = useQueryClient();
  return async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["prospects"] }),
      ...(id
        ? [
            cache.invalidateQueries({ queryKey: prospectKey(id) }),
            cache.invalidateQueries({ queryKey: ["prospect-history", id] }),
          ]
        : []),
    ]);
  };
}
export function useSaveProspect(
  id: string | undefined,
  onSaved: (record: Prospect) => void,
  catalog?: StageCatalog | null,
) {
  const api = useApi();
  const refresh = useRefreshProspect(id);
  return useMutation({
    mutationFn: (input: ProspectInput) => {
      if (!id && !catalog)
        throw new Error(
          "Prospect creation is unavailable until the new stages are enabled.",
        );
      return api.request(
        "core",
        id ? `${prospectBase}/${id}` : prospectBase,
        prospectSchema,
        {
          method: id ? "PATCH" : "POST",
          body: {
            ...prospectInputSchema.parse(input),
            ...(!id && catalog ? { stage: catalog.createStage } : {}),
          },
        },
      );
    },
    onSuccess: async (record) => {
      await refresh();
      onSaved(record);
    },
  });
}
export function useProspectStage(
  record: Prospect,
  catalog: StageCatalog | null | undefined,
  onSaved: () => void,
) {
  const api = useApi();
  const refresh = useRefreshProspect(record.id);
  return useMutation({
    mutationFn: (stage: string) => {
      if (
        !catalog ||
        !catalog.stages.some((item) => item.value === stage) ||
        (!isPortfolioStage(record.stage) && !catalog.allowLegacyTransitions)
      )
        throw new Error("Stage updates are unavailable for this prospect.");
      return api.request(
        "core",
        `${prospectBase}/${record.id}`,
        prospectSchema,
        { method: "PATCH", body: { stage } },
      );
    },
    onSuccess: async () => {
      await refresh();
      onSaved();
    },
  });
}
export function useProspectNextStep(id: string, onSaved: () => void) {
  const api = useApi();
  const refresh = useRefreshProspect(id);
  return useMutation({
    mutationFn: (body: {
      nextAction: string | null;
      nextActionDueAt: string | null;
      ownerUserId: string | null;
    }) =>
      api.request("core", `${prospectBase}/${id}`, prospectSchema, {
        method: "PATCH",
        body,
      }),
    onSuccess: async () => {
      await refresh();
      onSaved();
    },
  });
}
export function useProspectNote(id: string, onSaved: () => void) {
  const api = useApi();
  const refresh = useRefreshProspect(id);
  return useMutation({
    mutationFn: (body: string) =>
      api.request("core", `${prospectBase}/${id}/notes`, historySchema, {
        method: "POST",
        body: { body },
      }),
    onSuccess: async () => {
      await refresh();
      onSaved();
    },
  });
}
export function useProspectVisibility(id: string, onSaved: () => void) {
  const api = useApi();
  const refresh = useRefreshProspect(id);
  return useMutation({
    mutationFn: (action: "dismiss" | "restore") =>
      api.request("core", `${prospectBase}/${id}/${action}`, prospectSchema, {
        method: "POST",
        body: {},
      }),
    onSuccess: async () => {
      await refresh();
      onSaved();
    },
  });
}
