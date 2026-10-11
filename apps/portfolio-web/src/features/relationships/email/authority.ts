"use client";
import { useLayoutEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { useIdentity, type identitySchema } from "@/shared/auth/identity";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { canManageContacts } from "../contact-api";

export function useMailAuthority(scopeKey?: string) {
  const identity = useIdentity();
  const cache = useQueryClient();
  const lifetime = useRef({ active: false });
  const originalActor = useRef<string | null>(null);
  const ready =
    identity.isSuccess &&
    !identity.isFetching &&
    !identity.error &&
    Boolean(identity.data.user.id.trim() && identity.data.tenant?.id.trim()) &&
    canManageContacts(identity.data.role);
  useLayoutEffect(() => {
    const scope = { active: true };
    lifetime.current = scope;
    return () => {
      scope.active = false;
    };
  }, [scopeKey]);
  useLayoutEffect(() => {
    if (ready && originalActor.current === null)
      originalActor.current = `${identity.data.tenant?.id}:${identity.data.user.id}`;
  }, [ready, identity.data]);
  function capture() {
    const scope = lifetime.current;
    const actor = originalActor.current;
    const assert = () => {
      const state = cache.getQueryState<z.infer<typeof identitySchema>>([
        "identity",
      ]);
      if (
        !scope.active ||
        !actor ||
        state?.status !== "success" ||
        state.fetchStatus !== "idle" ||
        state.isInvalidated ||
        state.error ||
        !state.data?.user.id.trim() ||
        !state.data.tenant?.id.trim() ||
        !canManageContacts(state.data.role) ||
        `${state.data.tenant.id}:${state.data.user.id}` !== actor
      )
        throw new ApiError(
          409,
          "Your mailbox session changed or is unverified. Refresh and review this draft.",
        );
    };
    assert();
    return assert;
  }
  return { ready, error: identity.error, capture };
}
/** Guards the canonical transport at each step, including resumed upload confirmation. */
export function guardedMailApi(api: ApiClient, assert: () => void): ApiClient {
  return {
    async request(service, path, schema, options) {
      assert();
      const result = await api.request(service, path, schema, options);
      assert();
      return result;
    },
  };
}
