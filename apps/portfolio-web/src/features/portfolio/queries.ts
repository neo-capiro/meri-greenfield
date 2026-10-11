"use client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/shared/api/provider";
import { clientSchema, ownersSchema, memberSchema } from "./contracts";
export const clientsKey = ["portfolio", "clients"] as const;
export const clientKey = (id: string) => ["portfolio", "client", id] as const;
export function useClients(options?: {
  enabled?: boolean;
  scope?: { tenantId: string; userId: string };
}) {
  const api = useApi();
  const scope = options?.scope;
  return useQuery({
    queryKey: scope
      ? [...clientsKey, scope.tenantId, scope.userId]
      : clientsKey,
    enabled:
      options?.enabled !== false &&
      (!scope || Boolean(scope.tenantId && scope.userId)),
    queryFn: ({ signal }) =>
      api.request("core", "clients", z.array(clientSchema), { signal }),
  });
}
export function useClient(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: clientKey(id),
    queryFn: ({ signal }) =>
      api.request("core", `clients/${encodeURIComponent(id)}`, clientSchema, {
        signal,
      }),
  });
}
export function useAccountOwners() {
  const api = useApi();
  return useQuery({
    queryKey: ["account-owners"],
    queryFn: ({ signal }) =>
      api.request("core", "client-account-owners", ownersSchema, { signal }),
  });
}
export function useMemberOptions() {
  const api = useApi();
  return useQuery({
    queryKey: ["member-options"],
    queryFn: ({ signal }) =>
      api.request(
        "core",
        "client-account-owners/options",
        z.array(memberSchema),
        { signal },
      ),
  });
}
