"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { clientSchema, type Client } from "./contracts";
import { clientsKey } from "./queries";
export function useCreateProfile(onCreated: (client: Client) => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.request("core", "clients", clientSchema, { method: "POST", body }),
    onSuccess: async (client) => {
      await cache.invalidateQueries({ queryKey: clientsKey });
      onCreated(client);
    },
  });
}
