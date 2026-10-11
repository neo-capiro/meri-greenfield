"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { useAdvocacyAccess } from "./access";
import { canAdminister, identitySchema } from "@/shared/auth/identity";
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
  const [submitted, setSubmitted] = useState(false);
  const inFlight = useRef(false);
  function assertCurrentAccess() {
    const state = cache.getQueryState(["identity"]);
    const identity = identitySchema.safeParse(cache.getQueryData(["identity"]));
    if (
      state?.status !== "success" ||
      state.fetchStatus === "fetching" ||
      !identity.success ||
      !canAdminister(identity.data.role) ||
      identity.data.user.id !== reviewActor.userId ||
      identity.data.tenant?.id !== reviewActor.tenantId
    )
      throw new ApiError(
        403,
        "Your current role cannot correct advocacy history.",
      );
  }
  async function verify(correction: Correction) {
    if (!(await checkCorrection(api, clientId, correction)))
      throw new ApiError(
        409,
        "The submitted correction is not confirmed by current records. Check the result before attempting another correction.",
      );
    await cache.invalidateQueries({ queryKey: ["advocacy", clientId] });
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
        await prepareCorrection(api, clientId, correction);
        assertCurrentAccess();
        attempted.current = correction;
        setSubmitted(true);
        await submitCorrection(api, clientId, correction);
        await verify(correction);
      } finally {
        inFlight.current = false;
      }
    },
    onSettled: () =>
      cache.invalidateQueries({ queryKey: ["advocacy", clientId] }),
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
      await verify(attempted.current);
    },
  });
  return {
    mutation,
    reconcile,
    submitted,
    canEdit,
  };
}
