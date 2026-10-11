"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity } from "@/shared/auth/identity";
import { ApiError } from "@/shared/api/http";
import type { Activity } from "./contracts";
import { profileKey } from "./queries";
import {
  assertClientWriter,
  currentClientWriter,
  ambiguousClientWrite,
} from "./quick-log/public";
import {
  changeActivity,
  readActivityForChange,
  type ActivityChange,
} from "./activity-change";
export function useChangeActivity(
  clientId: string,
  item: Activity,
  onSaved?: () => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const actor = currentClientWriter(cache);
  const lifetime = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<Error | null>(null);
  const [reviewed, setReviewed] = useState<{ item: Activity | undefined }>();
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, [
    clientId,
    item.id,
    cache,
    identity.data?.user.id,
    identity.data?.tenant?.id,
  ]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (change: ActivityChange) => {
      const controller = lifetime.current;
      if (
        !actor ||
        !controller ||
        saving.current ||
        uncertain ||
        (reviewed && !reviewed.item)
      )
        throw new ApiError(
          403,
          "Review this activity with a current session before changing it.",
        );
      let authorityChanged = false;
      const guard = () => {
        controller.signal.throwIfAborted();
        try {
          assertClientWriter(cache, actor);
        } catch (error) {
          authorityChanged = true;
          throw error;
        }
      };
      let sent = false;
      saving.current = true;
      setReviewError(null);
      try {
        await changeActivity(
          api,
          clientId,
          actor,
          item,
          change,
          guard,
          controller.signal,
          () => {
            sent = true;
            setReviewed(undefined);
          },
        );
        guard();
      } catch (error) {
        if (sent && (authorityChanged || ambiguousClientWrite(error)))
          setUncertain(true);
        throw error;
      } finally {
        if (sent)
          await cache.invalidateQueries({
            queryKey: profileKey(clientId, "activity"),
          });
        saving.current = false;
      }
      return { controller, actor };
    },
    onSuccess: ({ controller, actor: savedActor }) => {
      if (controller.signal.aborted) return;
      try {
        assertClientWriter(cache, savedActor);
      } catch {
        return;
      }
      onSaved?.();
    },
  });
  const reviewLatest = async () => {
    const controller = lifetime.current;
    if (!actor || !controller || saving.current) return;
    const guard = () => {
      controller.signal.throwIfAborted();
      assertClientWriter(cache, actor);
    };
    saving.current = true;
    setReviewing(true);
    setReviewError(null);
    try {
      const rows = await readActivityForChange(
        api,
        clientId,
        guard,
        controller.signal,
      );
      cache.setQueryData(profileKey(clientId, "activity"), rows);
      setReviewed({
        item: rows.find(
          (row) => row.id === item.id && row.origin === "recorded",
        ),
      });
      setUncertain(false);
      mutation.reset();
    } catch (error) {
      if (!controller.signal.aborted)
        setReviewError(
          error instanceof Error
            ? error
            : new Error("The latest activity could not be loaded."),
        );
    } finally {
      saving.current = false;
      if (!controller.signal.aborted) setReviewing(false);
    }
  };
  const canOpen =
    Boolean(actor) &&
    !identity.isPending &&
    !identity.isFetching &&
    !identity.isError;
  const needsReview =
    uncertain ||
    (mutation.error instanceof ApiError && mutation.error.status === 409);
  return {
    mutation,
    uncertain,
    needsReview,
    reviewing,
    reviewError,
    reviewed,
    reviewLatest,
    canOpen,
    canWrite: canOpen && !needsReview && !(reviewed && !reviewed.item),
  };
}
export type ActivityMutationState = ReturnType<typeof useChangeActivity>;
