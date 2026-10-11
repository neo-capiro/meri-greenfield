"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity } from "@/shared/auth/identity";
import { profileKey } from "../queries";
import {
  assertClientWriter,
  currentClientWriter,
  ambiguousClientWrite,
} from "./authority";
import { createQuickLog } from "./actions";
import type { QuickLogInput, QuickLogReceipt } from "./contracts";
export function useQuickLog(
  clientId: string,
  open: boolean,
  onSaved: () => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const [receipt, setReceipt] = useState<QuickLogReceipt>();
  const [uncertain, setUncertain] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const actor = currentClientWriter(cache);
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, [
    clientId,
    open,
    cache,
    identity.data?.user.id,
    identity.data?.tenant?.id,
  ]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (input: QuickLogInput) => {
      const controller = lifetime.current;
      if (!open || !actor || !controller || uncertain || saving.current)
        throw new Error(
          "Reopen Quick log with a current session before saving.",
        );
      const guard = () => {
        controller.signal.throwIfAborted();
        assertClientWriter(cache, actor);
      };
      let sent = false;
      saving.current = true;
      try {
        const value = await createQuickLog(
          api,
          clientId,
          actor,
          input,
          guard,
          controller.signal,
          () => {
            sent = true;
            setReceipt(undefined);
          },
        );
        setReceipt(value);
        setUncertain(false);
        onSaved();
        return value;
      } catch (error) {
        if (sent && ambiguousClientWrite(error)) setUncertain(true);
        throw error;
      } finally {
        saving.current = false;
        if (sent)
          await cache.invalidateQueries({
            queryKey: profileKey(clientId, "activity"),
          });
      }
    },
  });
  const visibleReceipt =
    actor &&
    receipt?.clientId === clientId &&
    receipt.tenantId === actor.tenantId &&
    receipt.createdByUserId === actor.userId
      ? receipt
      : undefined;
  return {
    mutation,
    receipt: visibleReceipt,
    clearReceipt: () => setReceipt(undefined),
    canCreate: Boolean(actor) && !uncertain,
    uncertain,
  };
}
