"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { clientKey, clientsKey } from "@/features/portfolio/public";
import { filesKey } from "@/features/files/public";
import {
  assertReviewAccess,
  executeReviewAction,
  type ReviewAction,
  type ReviewActor,
} from "./actions";
import { latestReviewKey } from "./queries";
import type { FillRun } from "./contracts";
export function useReviewAction(
  clientId: string,
  open: boolean,
  actor: ReviewActor,
) {
  const api = useApi();
  const cache = useQueryClient();
  const lifetime = useRef<AbortController | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [receipt, setReceipt] = useState<string>();
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => {
      controller.abort();
    };
  }, [clientId, cache, open, actor.userId, actor.tenantId]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async ({
      review,
      action,
    }: {
      review: FillRun;
      action: ReviewAction;
    }) => {
      const controller = lifetime.current;
      if (!open || !controller || controller.signal.aborted)
        throw new Error("Reopen the review before continuing.");
      const guard = () => {
        controller.signal.throwIfAborted();
        assertReviewAccess(cache, actor, action.kind !== "cancel");
      };
      let dispatched = false;
      try {
        const result = await executeReviewAction(
          api,
          clientId,
          review,
          action,
          guard,
          controller.signal,
          () => {
            dispatched = true;
            setUncertain(true);
            setReceipt(undefined);
          },
        );
        guard();
        cache.setQueryData(latestReviewKey(clientId, actor), result);
        setUncertain(false);
        setReceipt(
          action.kind === "apply"
            ? `${action.findingIds.filter((id) => result.findings.some((f) => f.id === id && f.status === "accepted")).length} of ${action.findingIds.length} selected findings are now accepted. Review any remaining pending findings.`
            : action.kind === "cancel"
              ? `Run is ${result.status}. Previously accepted changes remain saved.`
              : action.kind === "assign"
                ? "Finding applied and matter assignment acknowledged. Review the saved history for the current association."
                : action.kind === "reject"
                  ? "Ignore acknowledged. The saved review has been refreshed."
                  : "Restore acknowledged. The saved review has been refreshed.",
        );
        return result;
      } catch (error) {
        if (dispatched) setUncertain(true);
        throw error;
      } finally {
        // Apply can commit some findings before failing. Refresh every affected
        // surface even on error; no count receipt or all-or-nothing promise.
        if (dispatched) {
          const keys: readonly (readonly string[])[] = [
            clientKey(clientId),
            clientsKey,
            filesKey(clientId),
            ["client-profile", clientId],
            ["advocacy", clientId],
          ];
          await Promise.all(
            keys.map((queryKey) => cache.invalidateQueries({ queryKey })),
          );
          if (action.kind === "apply") {
            const kinds = review.findings
              .filter((f) => action.findingIds.includes(f.id))
              .map((f) => f.kind);
            if (kinds.includes("capability"))
              await Promise.all([
                cache.invalidateQueries({
                  queryKey: ["capabilities", clientId],
                }),
                cache.invalidateQueries({
                  queryKey: ["capability-fit", clientId],
                }),
              ]);
            if (kinds.includes("person"))
              await cache.invalidateQueries({
                queryKey: ["client-people", clientId],
              });
          }
        }
      }
    },
  });
  function createUploadGuard() {
    const controller = lifetime.current;
    return () => {
      if (
        !open ||
        !controller ||
        controller.signal.aborted ||
        lifetime.current !== controller
      )
        throw new Error(
          "The client review closed or its session changed. Reopen before uploading.",
        );
      assertReviewAccess(cache, actor, true);
    };
  }
  return { mutation, uncertain, receipt, createUploadGuard };
}
