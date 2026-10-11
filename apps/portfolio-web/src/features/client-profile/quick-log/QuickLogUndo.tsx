"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "@/shared/auth/identity";
import { useApi } from "@/shared/api/provider";
import { profileKey } from "../queries";
import {
  assertClientWriter,
  currentClientWriter,
  ambiguousClientWrite,
} from "./authority";
import { undoQuickLog } from "./actions";
import type { QuickLogReceipt } from "./contracts";
import styles from "./quick-log.module.css";
export function QuickLogUndo({
  receipt,
  clientName,
  onDismiss,
}: {
  receipt: QuickLogReceipt;
  clientName: string;
  onDismiss: () => void;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const [uncertain, setUncertain] = useState(false);
  const [removed, setRemoved] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const deleting = useRef(false);
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, [receipt.id, cache, identity.data?.user.id, identity.data?.tenant?.id]);
  const actor = currentClientWriter(cache);
  const allowed =
    actor?.tenantId === receipt.tenantId &&
    actor?.userId === receipt.createdByUserId;
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const controller = lifetime.current;
      if (
        !allowed ||
        !actor ||
        !controller ||
        uncertain ||
        removed ||
        deleting.current
      )
        throw new Error(
          "This Quick log cannot be undone by the current session.",
        );
      let sent = false;
      deleting.current = true;
      const guard = () => {
        controller.signal.throwIfAborted();
        assertClientWriter(cache, actor);
      };
      try {
        await undoQuickLog(
          api,
          receipt,
          actor,
          guard,
          controller.signal,
          () => {
            sent = true;
          },
        );
        setRemoved(true);
      } catch (error) {
        if (sent && ambiguousClientWrite(error)) setUncertain(true);
        throw error;
      } finally {
        deleting.current = false;
        if (sent)
          await cache.invalidateQueries({
            queryKey: profileKey(receipt.clientId, "activity"),
          });
      }
    },
  });
  if (!allowed) return null;
  return (
    <aside className={styles.toast} aria-label="Quick log result">
      <span aria-hidden="true">✓</span>
      <div>
        <p role="status">
          {removed ? "Quick log removed" : `Logged to ${clientName}`}
        </p>
        <small>
          {removed
            ? "Only this recorded activity was removed."
            : "Recorded activity on the timeline"}
        </small>
        {mutation.error && <p role="alert">{mutation.error.message}</p>}
        {uncertain && (
          <p>
            The removal result is uncertain. Inspect the timeline; Undo will not
            be resent.
          </p>
        )}
      </div>
      <a href={`/portfolio/${receipt.clientId}#activity-timeline`}>View</a>
      {!removed && (
        <button
          disabled={mutation.isPending || uncertain}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Undoing…" : "Undo"}
        </button>
      )}
      <button aria-label="Dismiss Quick log result" onClick={onDismiss}>
        ×
      </button>
    </aside>
  );
}
