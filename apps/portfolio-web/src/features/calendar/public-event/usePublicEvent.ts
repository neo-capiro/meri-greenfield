"use client";
import { useLayoutEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { useDispatchGuard } from "../access/public";
import { readPublicEvent } from "./api";

export function publicEventKey(
  eventId: string | null,
  clientId: string | undefined,
  actor: { userId?: string; tenantId?: string },
) {
  return [
    "public-event-detail",
    actor.tenantId ?? null,
    actor.userId ?? null,
    eventId,
    clientId ?? null,
  ] as const;
}
export function usePublicEvent(
  eventId: string | null,
  clientId: string | undefined,
  open: boolean,
) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const invalidated =
    identity.isStale && cache.getQueryState(["identity"])?.isInvalidated;
  const userId = identity.data?.user.id,
    tenantId = identity.data?.tenant?.id;
  const guard = useDispatchGuard(userId, tenantId);
  const lifetime = useRef<AbortController | undefined>(undefined);
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    if (!open) controller.abort();
    return () => controller.abort();
  }, [open, eventId, clientId, userId, tenantId]);
  const allowed = Boolean(
    open &&
    eventId &&
    userId &&
    tenantId &&
    !identity.isPending &&
    !identity.isFetching &&
    !identity.error &&
    !invalidated &&
    (identity.data?.role === "standard_user" ||
      canAdminister(identity.data?.role)),
  );
  const query = useQuery({
    queryKey: publicEventKey(eventId, clientId, { userId, tenantId }),
    enabled: allowed,
    retry: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const scope = lifetime.current;
      function assertCurrent() {
        guard();
        if (
          !eventId ||
          !scope ||
          scope !== lifetime.current ||
          scope.signal.aborted
        )
          throw new ApiError(
            409,
            "This public proceeding view is no longer active.",
          );
      }
      assertCurrent();
      if (!scope || !eventId)
        throw new ApiError(409, "Select a public proceeding.");
      const result = await readPublicEvent(
        api,
        eventId,
        clientId,
        AbortSignal.any([signal, scope.signal]),
      );
      assertCurrent();
      return result;
    },
  });
  return { query, identity, allowed };
}
