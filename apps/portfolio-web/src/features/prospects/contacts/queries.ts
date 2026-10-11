"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { readContacts, removeContact, saveContact } from "./api";
import type { ContactInput, ProspectContact } from "./contracts";
export const contactsKey = (id: string) => ["prospect-contacts", id] as const;
export function useContacts(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: contactsKey(id),
    queryFn: async ({ signal }) => {
      try {
        return await readContacts(api, id, signal);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}
export function useContactMutation(id: string, onSaved: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | {
            kind: "save";
            values: ContactInput;
            requestId: string;
            contact?: ProspectContact;
          }
        | { kind: "remove"; contact: ProspectContact },
    ) => {
      if (input.kind === "remove") await removeContact(api, id, input.contact);
      else
        await saveContact(
          api,
          id,
          input.values,
          input.requestId,
          input.contact,
        );
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: contactsKey(id) });
      onSaved();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409)
        void cache.invalidateQueries({ queryKey: contactsKey(id) });
    },
  });
}
export function useLatestContact(prospectId: string) {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: string) => {
      const current = await readContacts(api, prospectId);
      const next = current.contacts.find((row) => row.id === id);
      if (!next)
        throw new Error(
          "This contact was removed. Your unsaved draft is still shown.",
        );
      return next;
    },
  });
}
