"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "@/shared/auth/identity";
import { useApi } from "@/shared/api/provider";
import { Dialog } from "@/shared/ui/Dialog";
import {
  assertClientWriter,
  currentClientWriter,
  ambiguousClientWrite,
} from "../quick-log/public";
import { submissionKey } from "./queries";
import { removeSubmission } from "./actions";
import type { SavedSubmission } from "./contracts";
import styles from "./past-performance.module.css";
export function RemoveSubmission({
  item,
  clientName,
  onClose,
  onRemoved,
}: {
  item: SavedSubmission | null;
  clientName: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const lifetime = useRef<AbortController | null>(null);
  const deleting = useRef(false);
  const [uncertain, setUncertain] = useState<string[]>([]);
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, [item?.id, cache, identity.data?.user.id, identity.data?.tenant?.id]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const controller = lifetime.current;
      const actor = currentClientWriter(cache);
      if (
        !item ||
        !actor ||
        !controller ||
        item.tenantId !== actor.tenantId ||
        uncertain.includes(item.id) ||
        deleting.current
      )
        throw new Error(
          "This submission cannot be removed by the current session.",
        );
      let sent = false;
      deleting.current = true;
      const guard = () => {
        controller.signal.throwIfAborted();
        assertClientWriter(cache, actor);
      };
      try {
        await removeSubmission(api, item, guard, controller.signal, () => {
          sent = true;
        });
        onRemoved();
      } catch (error) {
        if (sent && ambiguousClientWrite(error))
          setUncertain((ids) => [...ids, item.id]);
        throw error;
      } finally {
        deleting.current = false;
        if (sent)
          await cache.invalidateQueries({
            queryKey: submissionKey(item.clientId).slice(0, 2),
          });
      }
    },
  });
  const frozen = Boolean(item && uncertain.includes(item.id));
  if (!currentClientWriter(cache)) return null;
  return (
    <Dialog
      open={Boolean(item)}
      title="Remove submission?"
      className={styles.dialog}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className={styles.body}>
        <p>
          Permanently remove “{item?.title}” ({item?.fiscalYear}) from{" "}
          {clientName}’s past performance? The capability and its documents will
          remain. This cannot be undone.
        </p>
        {mutation.error && (
          <p className={styles.error} role="alert">
            {mutation.error.message}
          </p>
        )}
        {frozen && (
          <p role="alert">
            The removal result is uncertain. Refresh the history to inspect it;
            this removal will not be resent.
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        <button
          className="button primary"
          disabled={mutation.isPending || frozen}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Removing…" : "Remove submission"}
        </button>
        <button className="button" onClick={onClose}>
          Cancel
        </button>
      </footer>
    </Dialog>
  );
}
