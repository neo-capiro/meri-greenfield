"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import {
  clientSchema,
  clientsKey,
  clientKey,
  type Client,
} from "@/features/portfolio/public";
import { intakePayload, type IntakeForm } from "./form";
import { uploadClientLogo, type LogoAttempt } from "./logo";

export function useSaveIntake(client?: Client) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({
      values,
      initial,
    }: {
      values: IntakeForm;
      initial?: IntakeForm;
    }) => {
      const path = client
        ? `clients/${encodeURIComponent(client.id)}`
        : "clients";
      const latest = client
        ? await api.request("core", path, clientSchema)
        : undefined;
      const body = intakePayload(values, initial, latest);
      if (latest && !Object.keys(body).length) return latest;
      return api.request("core", path, clientSchema, {
        method: client ? "PUT" : "POST",
        body,
      });
    },
    onSuccess: async (saved) => {
      cache.setQueryData(clientKey(saved.id), saved);
      await cache.invalidateQueries({ queryKey: clientsKey });
    },
  });
}
export function useUploadLogo() {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({
      clientId,
      attempt,
    }: {
      clientId: string;
      attempt: LogoAttempt;
    }) => uploadClientLogo(api, clientId, attempt),
    onSuccess: async (saved) => {
      cache.setQueryData(clientKey(saved.id), saved);
      await cache.invalidateQueries({ queryKey: clientsKey });
    },
  });
}
export function useArchiveClient(onArchived: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.request("core", `clients/${encodeURIComponent(id)}`, clientSchema, {
        method: "DELETE",
      }),
    onSuccess: async (saved) => {
      cache.removeQueries({ queryKey: clientKey(saved.id) });
      await Promise.all([
        cache.invalidateQueries({ queryKey: clientsKey }),
        cache.invalidateQueries({ queryKey: ["account-owners"] }),
        cache.invalidateQueries({ queryKey: ["calendar", "meetings"] }),
      ]);
      onArchived();
    },
  });
}
