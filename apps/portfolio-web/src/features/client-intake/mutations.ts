"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef } from "react";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import {
  currentClientWriter,
  assertClientWriter,
} from "@/features/client-profile/quick-log/public";
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

export function useSaveIntake(client?: Client) {
  const api = useApi();
  const cache = useQueryClient();
  const lifetime = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  return useMutation({
    retry: false,
    mutationFn: async ({
      values,
      initial,
    }: {
      values: IntakeForm;
      initial?: IntakeForm;
    }) => {
      const scope = lifetime.current;
      const actor = currentClientWriter(cache);
      if (!actor || !scope || scope.signal.aborted)
        throw new ApiError(403, "A current client-writer session is required.");
      const guard = () => {
        if (scope.signal.aborted)
          throw new ApiError(409, "This profile session is no longer active.");
        assertClientWriter(cache, actor);
      };
      if (!client) await verifyProfileCapacity(api, 1, guard, scope.signal);
      const saved = await saveClientProfile(
        api,
        values,
        initial,
        client,
        guard,
      );
      try {
        guard();
      } catch {
        throw new ClientProfileAttemptError(
          "Your profile session changed after saving. Review the client list before continuing.",
          true,
        );
      }
      return saved;
    },
    onSuccess: async (saved) => {
      cache.setQueryData(clientKey(saved.id), saved);
      await cache.invalidateQueries({ queryKey: clientsKey });
    },
    onSettled: () => cache.invalidateQueries({ queryKey: billingStateKey }),
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
        cache.invalidateQueries({ queryKey: billingStateKey }),
      ]);
      onArchived();
    },
  });
}
