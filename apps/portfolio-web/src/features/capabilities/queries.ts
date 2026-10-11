"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/shared/api/provider";
import { acknowledged } from "@/shared/api/http";
import {
  capabilitySchema,
  capabilityInputSchema,
  fitSchema,
  type CapabilityInput,
} from "./contracts";
export const capabilitiesKey = (id: string) => ["capabilities", id] as const;
export const fitKey = (id: string) => ["capability-fit", id] as const;
export function useCapabilities(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: capabilitiesKey(id),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${id}/capabilities`,
        z.array(capabilitySchema),
        { signal },
      ),
  });
}
export function useCapabilityFit(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: fitKey(id),
    queryFn: ({ signal }) =>
      api.request("core", `clients/${id}/capability-fit`, fitSchema, {
        signal,
      }),
  });
}
export function useSaveCapability(clientId: string, onSaved: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CapabilityInput }) =>
      api.request(
        "core",
        `clients/${clientId}/capabilities${id ? `/${id}` : ""}`,
        capabilitySchema,
        {
          method: id ? "PATCH" : "POST",
          body: capabilityInputSchema.parse(body),
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: capabilitiesKey(clientId) }),
        cache.invalidateQueries({ queryKey: fitKey(clientId) }),
      ]);
      onSaved();
    },
  });
}
export function useDeleteCapability(clientId: string, onDeleted: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.request(
        "core",
        `clients/${clientId}/capabilities/${id}`,
        acknowledged,
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: capabilitiesKey(clientId) }),
        cache.invalidateQueries({ queryKey: fitKey(clientId) }),
      ]);
      onDeleted();
    },
  });
}
export function useRefreshFit(clientId: string) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.request(
        "core",
        `clients/${clientId}/capability-fit/refresh`,
        fitSchema,
        { method: "POST" },
      ),
    onSuccess: (data) => cache.setQueryData(fitKey(clientId), data),
  });
}
