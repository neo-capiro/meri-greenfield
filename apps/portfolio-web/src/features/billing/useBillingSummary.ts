"use client";
import { useSyncExternalStore } from "react";
import { notifyManager, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity } from "@/shared/auth/identity";
import { billingSummaryKey, readBillingSummary } from "./summary-api";
import { currentBillingReader } from "./summary-authority";

export function useBillingSummary(enabled: boolean, expanded: boolean) {
  const api = useApi();
  const cache = useQueryClient();
  useIdentity();
  const actor = currentBillingReader(cache);
  const key = billingSummaryKey(actor);
  // Permission invalidation must hide data even before a replacement /me resolves.
  useSyncExternalStore(
    (notify) => {
      const batched = notifyManager.batchCalls(notify);
      return cache.getQueryCache().subscribe((event) => {
        if (
          event.type === "updated" &&
          (event.query.queryKey[0] === "identity" ||
            event.query.queryKey[0] === "billing")
        )
          batched();
      });
    },
    () =>
      `${cache.getQueryState(["identity"])?.isInvalidated}:${cache.getQueryState(["identity"])?.fetchStatus}:${cache.getQueryState(key)?.isInvalidated}`,
    () => "true:fetching",
  );
  const query = useQuery({
    queryKey: key,
    enabled: enabled && expanded && Boolean(actor),
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) => {
      if (!actor) throw new Error("Billing permission is unavailable.");
      return readBillingSummary(api, cache, actor, signal);
    },
  });
  const visible = enabled && Boolean(actor);
  const ready =
    visible &&
    expanded &&
    query.isSuccess &&
    !query.isFetching &&
    !query.error &&
    !cache.getQueryState(key)?.isInvalidated;
  return { query, visible, ready };
}
