"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { assertAdvocacyCorrectionAccess, useAdvocacyAccess } from "./access";
import {
  checkCorrection,
  prepareCorrection,
  submitCorrection,
  type Correction,
} from "./correction";

export function useCorrection(clientId: string, onSaved: () => void) {
  const api = useApi();
  const cache = useQueryClient();
  const { identity: actor, canEdit } = useAdvocacyAccess();
  const [reviewActor] = useState(() => ({
    userId: actor.data?.user.id,
    tenantId: actor.data?.tenant?.id,
  }));
  const attempted = useRef<Correction | null>(null);
  const acknowledged = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => {
      controller.abort();
      if (lifetime.current === controller) lifetime.current = null;
    };
  }, [cache, clientId]);
  const [submitted, setSubmitted] = useState(false);
  const inFlight = useRef(false);
  function assertCurrentAccess() {
    assertAdvocacyCorrectionAccess(cache, reviewActor);
  }
  function activeSignal() {
    const controller = lifetime.current;
    if (!controller)
      throw new DOMException("Review is no longer open.", "AbortError");
    controller.signal.throwIfAborted();
    return controller.signal;
  }
  async function verify(correction: Correction, signal: AbortSignal) {
    const reflected = await checkCorrection(api, clientId, correction, {
      signal,
      acknowledged: acknowledged.current,
    });
    signal.throwIfAborted();
    assertCurrentAccess();
    if (correction.kind === "not-advocacy" && !acknowledged.current)
      throw new ApiError(
        409,
        "The server did not acknowledge this correction. Absence from the latest 500 entries cannot confirm it; an authoritative rejected-record or audit receipt is required.",
      );
    if (!reflected)
      throw new ApiError(
        409,
        "The submitted correction is not confirmed by current records. Check the result before attempting another correction.",
      );
    await cache.invalidateQueries({ queryKey: ["advocacy", clientId] });
    signal.throwIfAborted();
    assertCurrentAccess();
    onSaved();
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (correction: Correction) => {
      if (!canEdit)
        throw new ApiError(
          403,
          "Your current role cannot correct advocacy history.",
        );
      if (inFlight.current || attempted.current)
        throw new ApiError(
          409,
          "Check the submitted result before another correction.",
        );
      inFlight.current = true;
      try {
        const signal = activeSignal();
        assertCurrentAccess();
        await prepareCorrection(api, clientId, correction, signal);
        signal.throwIfAborted();
        assertCurrentAccess();
        attempted.current = correction;
        setSubmitted(true);
        await submitCorrection(api, clientId, correction, signal);
        signal.throwIfAborted();
        acknowledged.current = true;
        await verify(correction, signal);
      } finally {
        inFlight.current = false;
      }
    },
    onSettled: async () => {
      if (!lifetime.current || lifetime.current.signal.aborted) return;
      try {
        assertCurrentAccess();
      } catch {
        return;
      }
      await cache.invalidateQueries({ queryKey: ["advocacy", clientId] });
    },
  });
  const reconcile = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!canEdit || !attempted.current)
        throw new ApiError(
          403,
          "A permitted submitted correction is required.",
        );
      assertCurrentAccess();
      await verify(attempted.current, activeSignal());
    },
  });
  return {
    mutation,
    reconcile,
    submitted,
    canEdit,
  };
}
