"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import {
  clientsKey,
  clientKey,
  type Client,
} from "@/features/portfolio/public";
import type { IntakeForm } from "./form";
import { archiveClient, saveClientProfile } from "./profile-api";
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
      return saveClientProfile(api, values, initial, client);
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
    mutationFn: (id: string) => archiveClient(api, id),
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
