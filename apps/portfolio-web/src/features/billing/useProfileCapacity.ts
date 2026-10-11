"use client";
import { useSyncExternalStore } from "react";
import { notifyManager, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity } from "@/shared/auth/identity";
import { currentClientWriter } from "@/features/client-profile/quick-log/public";
import { billingStateKey, readBillingState } from "./api";
import { capacityIssue } from "./capacity";

export function useProfileCapacity(enabled: boolean, quantity = 1) {
  const api = useApi();
  const cache = useQueryClient();
  useIdentity();
  const actor = currentClientWriter(cache);
  const key = [...billingStateKey, actor?.tenantId, actor?.userId] as const;
  // Invalidation can change authority without changing the identity object.
  useSyncExternalStore(
    (notify) => {
      const batchedNotify = notifyManager.batchCalls(notify);
      return cache.getQueryCache().subscribe((event) => {
        if (
          event.type === "updated" &&
          (event.query.queryKey[0] === "identity" ||
            event.query.queryKey[0] === "billing")
        )
          batchedNotify();
      });
    },
    () =>
      `${cache.getQueryState(["identity"])?.isInvalidated}:${cache.getQueryState(["identity"])?.fetchStatus}:${cache.getQueryState(key)?.isInvalidated}`,
    () => "true:fetching",
  );
  const query = useQuery({
    queryKey: key,
    enabled: enabled && Boolean(actor),
    staleTime: 0,
    retry: false,
    queryFn: ({ signal }) => readBillingState(api, signal),
  });
  const ready =
    enabled &&
    Boolean(actor) &&
    query.isSuccess &&
    !query.isFetching &&
    !query.error &&
    !cache.getQueryState(key)?.isInvalidated;
  const issue = ready ? capacityIssue(query.data!, quantity) : null;
  return { query, ready, issue, allowed: ready && !issue };
}
