"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { clientsKey } from "@/features/portfolio/public";
import { prospectKey } from "../queries";
import { linkProspectClient, searchLinkClients } from "./api";

export function useLinkClients(search: string) {
  const api = useApi();
  const term = search.trim().slice(0, 200);
  return useQuery({
    queryKey: ["prospect-link-clients", term],
    enabled: Boolean(term),
    queryFn: ({ signal }) => searchLinkClients(api, term, signal),
  });
}

export function useLinkProspect(prospectId: string) {
  const api = useApi();
  const cache = useQueryClient();
  const refresh = () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: prospectKey(prospectId) }),
      cache.invalidateQueries({ queryKey: ["prospects"] }),
      cache.invalidateQueries({ queryKey: ["prospect-history", prospectId] }),
      cache.invalidateQueries({ queryKey: clientsKey }),
    ]);
  return useMutation({
    mutationFn: (clientId: string) =>
      linkProspectClient(api, prospectId, clientId),
    // Read back even after a lost or malformed reply: the locked server action
    // may already have committed. Mutations never retry automatically.
    onSuccess: refresh,
    onError: refresh,
  });
}
