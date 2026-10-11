"use client";
import { useLayoutEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { canAdminister } from "@/shared/auth/identity";
import type { identitySchema } from "@/shared/auth/identity";
import type { z } from "zod";
import { clientsKey } from "@/features/portfolio/public";
import {
  billingStateKey,
  verifyProfileCapacity,
} from "@/features/billing/public";
import {
  fetchCandidates,
  fetchRegistrant,
  importClients,
  ImportAttemptError,
  linkRegistrant,
  searchRegistrants,
} from "./api";

export const registrantKey = ["portfolio", "firm-registrant"] as const;
function assertWriteAllowed(cache: ReturnType<typeof useQueryClient>) {
  const state = cache.getQueryState<z.infer<typeof identitySchema>>([
    "identity",
  ]);
  if (
    state?.status !== "success" ||
    state.fetchStatus !== "idle" ||
    state.isInvalidated ||
    state.error ||
    !state.data?.tenant?.id.trim() ||
    !state.data.user.id.trim() ||
    !canAdminister(state.data.role)
  )
    throw new ApiError(
      403,
      "A verified firm administrator session is required.",
    );
  if (cache.isMutating({ mutationKey: [...registrantKey, "write"] }) > 1)
    throw new ApiError(409, "Wait for the current firm change to finish.");
  return { tenantId: state.data.tenant.id, userId: state.data.user.id };
}
export function useRegistrant(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: registrantKey,
    enabled,
    queryFn: ({ signal }) => fetchRegistrant(api, signal),
  });
}
export function useCandidates(registrantId: number | null, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [...registrantKey, "candidates", registrantId],
    enabled: enabled && registrantId !== null,
    queryFn: ({ signal }) => {
      if (registrantId === null) throw new Error("Select a firm first.");
      return fetchCandidates(api, registrantId, signal);
    },
  });
}
export function useRegistrantSearch(q: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [...registrantKey, "search", q],
    enabled: enabled && q.length >= 2,
    queryFn: ({ signal }) => searchRegistrants(api, q, signal),
  });
}
export function useLinkRegistrant() {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationKey: [...registrantKey, "write"],
    retry: false,
    mutationFn: (id: number) => {
      assertWriteAllowed(cache);
      return linkRegistrant(api, id);
    },
    onSuccess: async (result) => {
      cache.setQueryData(registrantKey, result);
      await cache.invalidateQueries({
        queryKey: [...registrantKey, "candidates"],
      });
    },
  });
}
export function useImportClients() {
  const api = useApi();
  const cache = useQueryClient();
  const lifetime = useRef({ active: false });
  useLayoutEffect(() => {
    // An unmounted SessionBoundary can leave this old cache unchanged. Never
    // resume its preflight under a new authenticated browser session. Layout
    // cleanup revokes this scope during unmount, before DOM removal/repaint.
    const scope = { active: true };
    lifetime.current = scope;
    return () => {
      scope.active = false;
    };
  }, []);
  return useMutation({
    mutationKey: [...registrantKey, "write"],
    retry: false,
    mutationFn: async ({
      registrantId,
      ids,
    }: {
      registrantId: number;
      ids: number[];
    }) => {
      const scope = lifetime.current;
      if (!scope.active)
        throw new ApiError(409, "This import session is no longer active.");
      const actor = assertWriteAllowed(cache);
      const guard = () => {
        if (!scope.active)
          throw new ApiError(409, "This import session is no longer active.");
        const current = assertWriteAllowed(cache);
        if (
          current.tenantId !== actor.tenantId ||
          current.userId !== actor.userId
        )
          throw new ApiError(
            409,
            "Your session changed. Refresh and review before importing.",
          );
      };
      const result = await importClients(api, registrantId, ids, async () => {
        await verifyProfileCapacity(api, ids.length, guard);
        guard();
      });
      const assertCurrent = () => {
        try {
          guard();
        } catch {
          throw new ImportAttemptError(
            "Your import session changed after dispatch. Review current client state before continuing.",
            true,
          );
        }
      };
      assertCurrent();
      return { receipt: result, assertCurrent };
    },
    // Even an ambiguous failure may have committed individual rows.
    onSettled: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: clientsKey }),
        cache.invalidateQueries({ queryKey: [...registrantKey, "candidates"] }),
        cache.invalidateQueries({ queryKey: billingStateKey }),
      ]);
    },
  });
}
