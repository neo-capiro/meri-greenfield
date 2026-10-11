"use client";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { useCalendarCapabilities, useDispatchGuard } from "../access/public";
import { CalendarSyncError, runCalendarSync } from "./api";
import {
  syncAttemptKey,
  type CalendarSyncAttempt,
  type CalendarSyncIntent,
} from "./contracts";
import { calendarConnectionsKey } from "./queries";

export function useCalendarSync(open: boolean) {
  const api = useApi(),
    cache = useQueryClient();
  const identity = useIdentity(),
    capabilities = useCalendarCapabilities();
  const subscribe = useCallback(
    (notify: () => void) => cache.getQueryCache().subscribe(notify),
    [cache],
  );
  // refetchType:none changes isInvalidated without starting a fetch. Observe it directly.
  const gatesInvalidated = useSyncExternalStore(
    subscribe,
    () =>
      Boolean(
        cache.getQueryState(["identity"])?.isInvalidated ||
        cache.getQueryState(["meeting-preparation", "capabilities"])
          ?.isInvalidated,
      ),
    () => true,
  );
  const userId = identity.data?.user.id ?? "",
    tenantId = identity.data?.tenant?.id ?? "";
  const guard = useDispatchGuard(userId, tenantId, true);
  const lifetime = useRef<AbortController | undefined>(undefined);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const key = syncAttemptKey(tenantId, userId);
  const attempt = useQuery<CalendarSyncAttempt>({
    queryKey: key,
    queryFn: skipToken,
    enabled: false,
    initialData: { status: "idle" },
    gcTime: Infinity,
  });
  useLayoutEffect(() => {
    const scope = new AbortController();
    lifetime.current = scope;
    if (!open) scope.abort();
    return () => scope.abort();
  }, [open, userId, tenantId]);
  const allowed = Boolean(
    open &&
    userId &&
    tenantId &&
    identity.isSuccess &&
    !identity.isFetching &&
    !identity.error &&
    !gatesInvalidated &&
    (identity.data?.role === "standard_user" ||
      canAdminister(identity.data?.role)) &&
    capabilities.isSuccess &&
    !capabilities.isFetching &&
    !capabilities.error &&
    capabilities.data.runtime?.externalActionsEnabled === true,
  );
  function assertCurrent(scope = lifetime.current) {
    if (!open || !scope || scope !== lifetime.current || scope.signal.aborted)
      throw new ApiError(409, "This calendar review is closed or changed.");
    guard();
  }
  async function sync(intent: CalendarSyncIntent) {
    if (busy.current) return;
    const previous = cache.getQueryData<CalendarSyncAttempt>(key);
    if (previous?.status !== "idle") return;
    const scope = lifetime.current;
    busy.current = true;
    setError("");
    try {
      assertCurrent(scope);
      const receipt = await runCalendarSync(
        api,
        intent,
        userId,
        () => assertCurrent(scope),
        (captured) => {
          if (cache.getQueryData<CalendarSyncAttempt>(key)?.status !== "idle")
            throw new ApiError(
              409,
              "Another calendar sync is already pending or needs review.",
            );
          // Persist the fence before the request; it survives route remount and Cancel.
          cache.setQueryData<CalendarSyncAttempt>(
            key,
            (): CalendarSyncAttempt => ({
              status: "pending",
              intent: captured,
            }),
          );
        },
        scope?.signal,
      );
      cache.setQueryData<CalendarSyncAttempt>(
        key,
        (): CalendarSyncAttempt => ({
          status: "completed",
          intent,
          receipt,
        }),
      );
      void cache.invalidateQueries({ queryKey: ["calendar", "meetings"] });
      void cache.invalidateQueries({
        queryKey: calendarConnectionsKey(tenantId, userId),
      });
    } catch (failure) {
      if (failure instanceof CalendarSyncError && failure.uncertain)
        cache.setQueryData<CalendarSyncAttempt>(
          key,
          (): CalendarSyncAttempt => ({
            status: "unknown",
            intent,
          }),
        );
      if (scope === lifetime.current && !scope?.signal.aborted)
        setError(
          failure instanceof Error ? failure.message : "Sync could not start.",
        );
    } finally {
      busy.current = false;
    }
  }
  return {
    allowed,
    userId,
    tenantId,
    assertCurrent,
    attempt: attempt.data ?? { status: "idle" as const },
    error,
    sync,
    reviewAnother() {
      assertCurrent();
      if (
        cache.getQueryData<CalendarSyncAttempt>(key)?.status === "completed"
      ) {
        cache.setQueryData<CalendarSyncAttempt>(key, { status: "idle" });
        setError("");
      }
    },
  };
}
