"use client";
import { useLayoutEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/http";
import { canAdminister, identitySchema } from "@/shared/auth/identity";
import {
  assertClientWriter,
  currentClientWriter,
} from "@/features/client-profile/quick-log/public";

export interface IntakeWriteScope {
  assert: () => void;
  signal: AbortSignal;
}
/** One mounted intake session owns all profile and logo continuations. */
export function useIntakeAuthority(administrator: boolean) {
  const cache = useQueryClient();
  const lifetime = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  return (): IntakeWriteScope => {
    const controller = lifetime.current;
    const actor = currentClientWriter(cache);
    if (!actor || !controller || controller.signal.aborted)
      throw new ApiError(403, "A current client-writer session is required.");
    const assert = () => {
      if (controller.signal.aborted)
        throw new ApiError(409, "This profile session is no longer active.");
      assertClientWriter(cache, actor);
      const identity = identitySchema.safeParse(
        cache.getQueryData(["identity"]),
      );
      if (
        administrator &&
        (!identity.success || !canAdminister(identity.data.role))
      )
        throw new ApiError(403, "Client edits require an administrator.");
    };
    assert();
    return { assert, signal: controller.signal };
  };
}
