"use client";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { useIdentity } from "@/shared/auth/identity";
import {
  currentClientWriter,
  assertClientWriter,
  ambiguousClientWrite,
} from "@/features/client-profile/quick-log/public";
import type { LayoutSave } from "./contracts";
import {
  readPortfolioLayout,
  resolvesLayoutSave,
  savePortfolioLayout,
} from "./api";
import { orderedClientIds } from "./ordering";

export function usePortfolioLayout(clientIds: readonly string[]) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  // Query result fields can remain unchanged on invalidation; keep controls in
  // sync with the same live cache authority used at the dispatch boundary.
  const identityInvalidated = useSyncExternalStore(
    (notify) =>
      cache.getQueryCache().subscribe((event) => {
        if (event.query.queryKey[0] === "identity") notify();
      }),
    () => Boolean(cache.getQueryState(["identity"])?.isInvalidated),
    () => true,
  );
  const actor = currentClientWriter(cache);
  const scope = JSON.stringify([
    identity.data?.tenant?.id,
    identity.data?.user.id,
    clientIds,
  ]);
  const liveScope = useRef(scope);
  const lifetime = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<Error | null>(null);
  const [uncertain, setUncertain] = useState<LayoutSave | null>(null);
  const [conflict, setConflict] = useState(false);
  const [latestAvailable, setLatestAvailable] = useState(false);
  const [stateScope, setStateScope] = useState(scope);
  if (stateScope !== scope) {
    setStateScope(scope);
    setSaving(false);
    setIssue(null);
    setUncertain(null);
    setConflict(false);
    setLatestAvailable(false);
  }
  useLayoutEffect(() => {
    const controller = new AbortController();
    liveScope.current = scope;
    lifetime.current = controller;
    busy.current = false;
    return () => controller.abort();
  }, [scope]);
  const key = [
    "portfolio-layout",
    identity.data?.tenant?.id,
    identity.data?.user.id,
    clientIds,
  ] as const;
  const guard = () => {
    if (
      !actor ||
      liveScope.current !== scope ||
      !lifetime.current ||
      lifetime.current.signal.aborted
    )
      throw new ApiError(
        403,
        "The session or profile catalog changed. Review the layout again.",
      );
    assertClientWriter(cache, actor);
  };
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(actor),
    retry: false,
    queryFn: async ({ signal }) => {
      guard();
      const receipt = await readPortfolioLayout(api, actor!, clientIds, signal);
      guard();
      return receipt;
    },
  });
  const refresh = async () => {
    guard();
    const receipt = await readPortfolioLayout(
      api,
      actor!,
      clientIds,
      lifetime.current!.signal,
    );
    guard();
    cache.setQueryData(key, receipt);
    return receipt;
  };
  const save = async (ids: readonly string[]) => {
    if (
      busy.current ||
      uncertain ||
      conflict ||
      !query.data ||
      query.error ||
      query.isFetching
    )
      return false;
    try {
      guard();
    } catch (error) {
      setIssue(
        error instanceof Error
          ? error
          : new Error("Review your session again."),
      );
      return false;
    }
    if (
      ids.length !== clientIds.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !clientIds.includes(id))
    ) {
      setIssue(
        new ApiError(400, "Review the current profile catalog before saving."),
      );
      return false;
    }
    const input: LayoutSave = {
      contractVersion: 1,
      expectedVersion: query.data.version,
      order: ids.map((id) => `client:${id}`),
    };
    const controller = lifetime.current!;
    busy.current = true;
    setSaving(true);
    setIssue(null);
    let sent = false;
    let received = false;
    try {
      guard();
      sent = true;
      const receipt = await savePortfolioLayout(
        api,
        actor!,
        input,
        clientIds,
        controller.signal,
      );
      received = true;
      guard();
      cache.setQueryData(key, receipt);
      return true;
    } catch (error) {
      if (controller.signal.aborted || liveScope.current !== scope)
        return false;
      setIssue(
        error instanceof Error
          ? error
          : new Error("The layout could not be saved."),
      );
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
        setLatestAvailable(false);
        try {
          await refresh();
          setLatestAvailable(true);
        } catch (readError) {
          if (!controller.signal.aborted && liveScope.current === scope)
            setIssue(
              readError instanceof Error
                ? readError
                : new Error("The latest layout is unavailable."),
            );
        }
      } else if (sent && (received || ambiguousClientWrite(error)))
        setUncertain(input);
      return false;
    } finally {
      if (!controller.signal.aborted && liveScope.current === scope) {
        busy.current = false;
        setSaving(false);
      }
    }
  };
  const reconcile = async () => {
    if (busy.current) return false;
    const controller = lifetime.current;
    busy.current = true;
    setSaving(true);
    try {
      const latest = await refresh();
      if (uncertain && resolvesLayoutSave(latest, uncertain, clientIds)) {
        setUncertain(null);
        setIssue(null);
        return true;
      }
      setUncertain(null);
      setConflict(true);
      setLatestAvailable(true);
      setIssue(null);
      return false;
    } catch (error) {
      if (!controller?.signal.aborted && liveScope.current === scope)
        setIssue(
          error instanceof Error
            ? error
            : new Error("The latest layout is unavailable."),
        );
      return false;
    } finally {
      if (!controller?.signal.aborted && liveScope.current === scope) {
        busy.current = false;
        setSaving(false);
      }
    }
  };
  return {
    orderedIds: orderedClientIds(
      actor && !query.error ? (query.data?.order ?? []) : [],
      clientIds,
    ),
    receipt: actor && !query.error ? query.data : undefined,
    pending: identity.isPending || (Boolean(actor) && query.isPending),
    error: issue ?? identity.error ?? query.error,
    permissionDenied:
      Boolean(identity.data) &&
      !identity.error &&
      !["standard_user", "user_admin", "capiro_admin"].includes(
        identity.data?.role ?? "",
      ),
    unavailable:
      query.error instanceof ApiError &&
      [404, 503].includes(query.error.status),
    allowed:
      Boolean(actor) &&
      !identityInvalidated &&
      !identity.isPending &&
      !identity.isFetching &&
      !identity.error &&
      !query.error &&
      !query.isFetching &&
      Boolean(query.data),
    saving,
    uncertain: Boolean(uncertain),
    conflict,
    latestAvailable,
    save,
    reconcile,
    retry: () => (identity.error ? identity.refetch() : query.refetch()),
    acceptLatest: () => {
      setConflict(false);
      setIssue(null);
    },
    scope,
  };
}
export type PortfolioLayoutState = ReturnType<typeof usePortfolioLayout>;
