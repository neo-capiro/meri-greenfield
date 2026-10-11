"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import {
  billingStateKey,
  verifyProfileCapacity,
} from "@/features/billing/public";
import {
  clientsKey,
  clientKey,
  type Client,
} from "@/features/portfolio/public";
import type { IntakeForm } from "./form";
import {
  archiveClient,
  ClientProfileAttemptError,
  saveClientProfile,
} from "./profile-api";
import { uploadClientLogo, type LogoAttempt } from "./logo";
import type { IntakeWriteScope } from "./authority";

export function useSaveIntake(
  capture: () => IntakeWriteScope,
  client?: Client,
) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async ({
      values,
      initial,
    }: {
      values: IntakeForm;
      initial?: IntakeForm;
    }) => {
      const scope = capture();
      if (!client)
        await verifyProfileCapacity(api, 1, scope.assert, scope.signal);
      const saved = await saveClientProfile(
        api,
        values,
        initial,
        client,
        scope.assert,
      );
      try {
        scope.assert();
      } catch {
        throw new ClientProfileAttemptError(
          "Your profile session changed after saving. Review the client list before continuing.",
          true,
        );
      }
      return saved;
    },
    onSuccess: (saved) => {
      cache.setQueryData(clientKey(saved.id), saved);
    },
    // A committed write can lose its receipt. Refresh read models without replay.
    onSettled: async (_saved, error) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: billingStateKey }),
        cache.invalidateQueries({ queryKey: clientsKey }),
        ...(client &&
        error instanceof ClientProfileAttemptError &&
        error.uncertain
          ? [cache.invalidateQueries({ queryKey: clientKey(client.id) })]
          : []),
      ]);
    },
  });
}
export function useUploadLogo(capture: () => IntakeWriteScope) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({
      clientId,
      attempt,
    }: {
      clientId: string;
      attempt: LogoAttempt;
    }) => {
      const scope = capture();
      return uploadClientLogo(
        api,
        clientId,
        attempt,
        fetch,
        scope.assert,
        scope.signal,
      );
    },
    onSuccess: (saved) => {
      cache.setQueryData(clientKey(saved.id), saved);
    },
    onSettled: async (_saved, _error, variables) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: clientsKey }),
        cache.invalidateQueries({ queryKey: clientKey(variables.clientId) }),
      ]);
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
        cache.invalidateQueries({ queryKey: billingStateKey }),
      ]);
      onArchived();
    },
  });
}
