"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { useIdentity } from "@/shared/auth/identity";
import {
  canManageContacts,
  writePerson,
  type PersonChange,
} from "./contact-api";
import { peopleKey } from "./queries";
export type { PersonChange } from "./contact-api";
export const peopleWriteKey = (clientId: string) =>
  ["client-people-write", clientId] as const;
export function usePersonMutation(clientId: string, onSaved?: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const mutation = useMutation({
    mutationKey: peopleWriteKey(clientId),
    retry: false,
    mutationFn: async (change: PersonChange) => {
      if (
        !identity.isSuccess ||
        identity.isFetching ||
        identity.error ||
        !canManageContacts(identity.data?.role)
      )
        throw new ApiError(
          403,
          "Your role cannot change organization contacts.",
        );
      // The currently executing mutation is already counted. Refuse a second
      // synchronous submission, including another drawer/hierarchy control.
      if (cache.isMutating({ mutationKey: peopleWriteKey(clientId) }) > 1)
        throw new ApiError(
          409,
          "Wait for the current contact change to finish.",
        );
      return writePerson(api, clientId, change);
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: peopleKey(clientId) });
      onSaved?.();
    },
    onError: async () => {
      // An uncertain receipt can follow a committed write. Read back the roster;
      // never turn a failed/foreign receipt into a successful-looking close.
      await cache.invalidateQueries({ queryKey: peopleKey(clientId) });
    },
  });
  return {
    ...mutation,
    mutate: (...args: Parameters<typeof mutation.mutate>) => {
      if (cache.isMutating({ mutationKey: peopleWriteKey(clientId) }) === 0)
        mutation.mutate(...args);
    },
  };
}
