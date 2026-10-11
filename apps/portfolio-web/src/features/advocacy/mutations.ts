"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { acknowledged } from "@/shared/api/http";
export function useSaveMatter(
  clientId: string,
  matterId: string | undefined,
  onSaved: () => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      api.request(
        "core",
        `clients/${clientId}/advocacy-matters${matterId ? `/${encodeURIComponent(matterId)}` : ""}`,
        acknowledged,
        { method: matterId ? "PATCH" : "POST", body },
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["advocacy", clientId] });
      onSaved();
    },
  });
}
export function useAddAdvocacyRecord(clientId: string, onSaved: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      api.request(
        "core",
        `clients/${clientId}/advocacy-matters/records`,
        acknowledged,
        { method: "POST", body },
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["advocacy", clientId] });
      onSaved();
    },
  });
}
