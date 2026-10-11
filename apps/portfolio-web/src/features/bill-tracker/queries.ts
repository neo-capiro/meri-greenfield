"use client";
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import type { TrackerBackend } from "@/shared/config/config";
import { fetchBoard, searchBills, setTracked, fetchJurisdictions } from "./api";
import { fetchBillHearings } from "./hearings";
export function useBillHearings(
  clientId: string,
  billId: string,
  backend: TrackerBackend,
) {
  const api = useApi();
  return useQuery({
    queryKey: ["bill-hearings", backend, clientId, billId],
    queryFn: ({ signal }) =>
      fetchBillHearings(api, clientId, billId, backend, signal),
    enabled: backend === "intelligence",
  });
}
export const boardKey = (clientId: string, backend: TrackerBackend) =>
  ["bill-tracker", backend, clientId] as const;
export function useBillBoard(clientId: string, backend: TrackerBackend) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: boardKey(clientId, backend),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchBoard(api, clientId, backend, pageParam, signal),
    getNextPageParam: (last, _pages, _lastParam, params) =>
      last.nextCursor && !params.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
  });
}
export function useBillSearch(
  clientId: string,
  backend: TrackerBackend,
  q: string,
  jurisdictions: string[],
) {
  const api = useApi();
  return useQuery({
    queryKey: ["bill-search", backend, clientId, q, jurisdictions],
    queryFn: ({ signal }) =>
      searchBills(api, clientId, backend, q, jurisdictions, signal),
    enabled: q.trim().length >= 2,
  });
}
export function useBillJurisdictions(backend: TrackerBackend) {
  const api = useApi();
  return useQuery({
    queryKey: ["bill-corpus-jurisdictions"],
    queryFn: ({ signal }) => fetchJurisdictions(api, signal),
    enabled: backend === "intelligence",
  });
}
export function useTrackBill(
  clientId: string,
  backend: TrackerBackend,
  onSaved: () => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ billId, track }: { billId: string; track: boolean }) =>
      setTracked(api, clientId, backend, billId, track),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: boardKey(clientId, backend) });
      onSaved();
    },
  });
}
