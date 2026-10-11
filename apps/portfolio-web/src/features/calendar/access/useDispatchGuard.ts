"use client";
import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "@/shared/api/http";
import { canAdminister, identitySchema } from "@/shared/auth/identity";
import type { CalendarCapabilities } from "./contracts";

/** Recheck the initiating actor and live gates at each asynchronous dispatch boundary. */
export function useDispatchGuard(
  userId: string | undefined,
  tenantId: string | undefined,
  requiresRuntime = false,
) {
  const cache = useQueryClient();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(() => {
    const identity = cache.getQueryState<z.infer<typeof identitySchema>>([
      "identity",
    ]);
    const capabilities = cache.getQueryState<CalendarCapabilities>([
      "meeting-preparation",
      "capabilities",
    ]);
    if (
      !mounted.current ||
      !userId ||
      !tenantId ||
      identity?.status !== "success" ||
      identity.fetchStatus !== "idle" ||
      identity.isInvalidated ||
      identity.error ||
      identity.data?.user.id !== userId ||
      identity.data.tenant?.id !== tenantId ||
      (identity.data.role !== "standard_user" &&
        !canAdminister(identity.data.role)) ||
      (requiresRuntime &&
        (capabilities?.status !== "success" ||
          capabilities.fetchStatus !== "idle" ||
          capabilities.isInvalidated ||
          capabilities.error ||
          capabilities.data?.runtime?.externalActionsEnabled !== true))
    )
      throw new ApiError(
        409,
        "The session or permissions changed. Review this action again before continuing.",
      );
  }, [cache, userId, tenantId, requiresRuntime]);
}
