"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import {
  clientSchema,
  clientKey,
  clientsKey,
} from "@/features/portfolio/public";
export type RegistrationInput = {
  uei: string;
  cageCode: string;
  naicsCodes: string[];
  pscCodes: string[];
  setAsideCertifications: string[];
};
export function useSaveRegistrations(clientId: string, onSaved: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: RegistrationInput) =>
      api.request("core", `clients/${clientId}`, clientSchema, {
        method: "PUT",
        body,
      }),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: clientKey(clientId) }),
        cache.invalidateQueries({ queryKey: clientsKey }),
        cache.invalidateQueries({ queryKey: ["capability-fit", clientId] }),
      ]);
      onSaved();
    },
  });
}
