"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import type { TrackerBackend } from "@/shared/config/config";
import { trackerBase } from "./api";
import { boardKey } from "./queries";
import {
  intelWatchlistSchema,
  coreWatchlistSchema,
  fromCoreWatchlist,
  toCoreWatchlist,
  toIntelWatchlist,
  taxonomySchema,
  type Watchlist,
  type WatchlistDraft,
} from "./watchlist-contracts";
const path = (clientId: string, backend: TrackerBackend) =>
  backend === "core"
    ? `${trackerBase(clientId, backend)}/watchlist`
    : `tracker/watchlists/${encodeURIComponent(clientId)}`;
const key = (clientId: string, backend: TrackerBackend) => [
  "bill-watchlist",
  backend,
  clientId,
];
export function useWatchlist(clientId: string, backend: TrackerBackend) {
  const api = useApi();
  return useQuery({
    queryKey: key(clientId, backend),
    queryFn: async ({ signal }): Promise<Watchlist> =>
      backend === "core"
        ? fromCoreWatchlist(
            await api.request(
              backend,
              path(clientId, backend),
              coreWatchlistSchema,
              { signal },
            ),
          )
        : api.request(
            backend,
            path(clientId, backend),
            intelWatchlistSchema.refine(
              (record) => record.clientId === clientId,
              "Watchlist association mismatch",
            ),
            { signal },
          ),
  });
}
export function useIssueAreas(backend: TrackerBackend) {
  const api = useApi();
  return useQuery({
    queryKey: ["tracker-issue-areas", backend],
    queryFn: ({ signal }) =>
      api.request(
        backend,
        backend === "core" ? "intelligence/issue-areas" : "tracker/issue-areas",
        taxonomySchema,
        { signal },
      ),
  });
}
export function useSaveWatchlist(
  clientId: string,
  backend: TrackerBackend,
  onSaved: (record: Watchlist) => void,
  onBusy: (busy: boolean) => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    onMutate: () => onBusy(true),
    onSettled: () => onBusy(false),
    mutationFn: async ({
      draft,
      version,
    }: {
      draft: WatchlistDraft;
      version?: number;
    }): Promise<Watchlist> => {
      if (backend === "core")
        return fromCoreWatchlist(
          await api.request(
            backend,
            path(clientId, backend),
            coreWatchlistSchema,
            { method: "PUT", body: toCoreWatchlist(draft) },
          ),
        );
      if (version === undefined)
        throw new Error("Reload this watchlist before saving.");
      return api.request(
        backend,
        path(clientId, backend),
        intelWatchlistSchema.refine(
          (record) => record.clientId === clientId,
          "Watchlist association mismatch",
        ),
        { method: "PUT", body: toIntelWatchlist(draft, version) },
      );
    },
    onSuccess: async (record) => {
      cache.setQueryData(key(clientId, backend), record);
      await cache.invalidateQueries({ queryKey: boardKey(clientId, backend) });
      onSaved(record);
    },
  });
}
