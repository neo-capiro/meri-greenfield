"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { ApiError } from "@/shared/api/http";
import { filesKey } from "@/features/files/public";
import {
  useDispatchGuard,
  usePreparationCapabilities,
} from "../../access/public";
import type { Meeting } from "../../contracts";
import {
  prepareVoiceSource,
  voiceAttemptFrozen,
  type VoiceAttempt,
} from "./source";

export function useVoiceSource(meeting: Meeting, open: boolean) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const capabilities = usePreparationCapabilities();
  const guard = useDispatchGuard(
    identity.data?.user.id,
    identity.data?.tenant?.id,
    true,
  );
  const attempt = useRef<VoiceAttempt>({ upload: {} });
  const busy = useRef(false);
  const lifetime = useRef<AbortController | undefined>(undefined);
  const [stage, setStage] = useState("");
  const [attemptState, setAttemptState] = useState({
    frozen: false,
    extractionUnknown: false,
  });
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    if (!open) controller.abort();
    return () => controller.abort();
  }, [
    open,
    meeting.id,
    meeting.client?.id,
    identity.data?.user.id,
    identity.data?.tenant?.id,
  ]);
  const allowed = Boolean(
    open &&
    identity.data?.user.id &&
    identity.data.tenant?.id &&
    !identity.isPending &&
    !identity.isFetching &&
    !identity.error &&
    (identity.data.role === "standard_user" ||
      canAdminister(identity.data.role)) &&
    !capabilities.isPending &&
    !capabilities.isFetching &&
    !capabilities.error &&
    capabilities.data?.runtime?.externalActionsEnabled === true,
  );
  function assertCurrent(scope = lifetime.current) {
    if (
      !allowed ||
      !scope ||
      scope !== lifetime.current ||
      scope.signal.aborted
    )
      throw new ApiError(
        409,
        "This meeting source session is no longer active.",
      );
    guard();
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (file: File) => {
      const scope = lifetime.current;
      assertCurrent(scope);
      if (!scope)
        throw new ApiError(
          409,
          "This meeting source session is no longer active.",
        );
      try {
        return await prepareVoiceSource(
          api,
          { meetingId: meeting.id, clientId: meeting.client?.id ?? null },
          file,
          attempt.current,
          (value) => {
            if (!scope.signal.aborted) setStage(value);
          },
          () => assertCurrent(scope),
          scope.signal,
        );
      } finally {
        let current = false;
        try {
          assertCurrent(scope);
          current = true;
        } catch {
          /* Do not refetch another actor's scope. */
        }
        if (attempt.current.attachmentId && current) {
          void cache.invalidateQueries({ queryKey: ["meeting", meeting.id] });
          if (meeting.client)
            void cache.invalidateQueries({
              queryKey: filesKey(meeting.client.id),
            });
        }
      }
    },
    onSuccess: () => {
      try {
        assertCurrent();
      } catch {
        return;
      }
      setStage("Transcript ready for review.");
    },
    onSettled: () => {
      busy.current = false;
      setAttemptState({
        frozen: voiceAttemptFrozen(attempt.current),
        extractionUnknown: attempt.current.extractionUnknown === true,
      });
    },
  });
  function prepare(file: File) {
    if (busy.current || !allowed || attempt.current.extractionUnknown) return;
    try {
      assertCurrent();
    } catch {
      return;
    }
    busy.current = true;
    mutation.mutate(file);
  }
  return {
    allowed,
    identity,
    capabilities,
    ...attemptState,
    stage,
    mutation,
    prepare,
    assertCurrent,
    reset() {
      if (busy.current) return;
      attempt.current = { upload: {} };
      setAttemptState({ frozen: false, extractionUnknown: false });
      setStage("");
      mutation.reset();
    },
  };
}
