"use client";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  notifyManager,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity } from "@/shared/auth/identity";
import {
  assertClientWriter,
  currentClientWriter,
  ambiguousClientWrite,
  type ClientWriter,
} from "@/features/client-profile/quick-log/public";
import { createMemberNote } from "./api";
import {
  memberNotesKey,
  type MemberReference,
  type MemberNoteReceipt,
} from "./contracts";

export function useMemberNote(
  member: MemberReference,
  onSaved?: (receipt: MemberNoteReceipt) => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  useSyncExternalStore(
    (notify) => {
      const batched = notifyManager.batchCalls(notify);
      return cache.getQueryCache().subscribe((event) => {
        if (event.type === "updated" && event.query.queryKey[0] === "identity")
          batched();
      });
    },
    () => cache.getQueryState(["identity"]),
    () => undefined,
  );
  const actor = currentClientWriter(cache);
  // Bind draft scope even during a same-scope identity refresh; only the
  // canonical currentClientWriter below can grant execution authority.
  const [session] = useState<ClientWriter | undefined>(() =>
    identity.data?.tenant?.id && identity.data.user.id
      ? { tenantId: identity.data.tenant.id, userId: identity.data.user.id }
      : undefined,
  );
  const sameActor = Boolean(
    actor &&
    actor.tenantId === session?.tenantId &&
    actor.userId === session.userId,
  );
  const lifetime = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [receipt, setReceipt] = useState<MemberNoteReceipt>();
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, [member.id, identity.data?.user.id, identity.data?.tenant?.id]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (text: string) => {
      const controller = lifetime.current;
      const initiatingActor = session;
      if (
        !actor ||
        !sameActor ||
        !initiatingActor ||
        !controller ||
        saving.current ||
        uncertain ||
        receipt
      )
        throw new Error(
          "Review this note with a current session before saving.",
        );
      let sent = false;
      let authorityChanged = false;
      const guard = () => {
        try {
          controller.signal.throwIfAborted();
          assertClientWriter(cache, initiatingActor);
        } catch (error) {
          authorityChanged = true;
          throw error;
        }
      };
      saving.current = true;
      try {
        const value = await createMemberNote(
          api,
          member,
          initiatingActor,
          text,
          guard,
          controller.signal,
          () => {
            sent = true;
          },
        );
        guard();
        setReceipt(value);
        return { value, controller, initiatingActor };
      } catch (error) {
        // A local authority refusal after POST does not prove server refusal.
        if (sent && (authorityChanged || ambiguousClientWrite(error)))
          setUncertain(true);
        throw error;
      } finally {
        saving.current = false;
        if (sent)
          await cache.invalidateQueries({
            queryKey: memberNotesKey(
              initiatingActor.tenantId,
              initiatingActor.userId,
              member.id,
            ),
          });
      }
    },
    onSuccess: ({ value, controller, initiatingActor }) => {
      if (controller.signal.aborted) return;
      try {
        assertClientWriter(cache, initiatingActor);
      } catch {
        return;
      }
      onSaved?.(value);
    },
  });
  return {
    mutation,
    uncertain,
    receipt: sameActor ? receipt : undefined,
    canWrite: Boolean(actor && sameActor && !uncertain && !receipt),
    checkingIdentity: identity.isPending || identity.isFetching,
    identityError: identity.error,
    retryIdentity: () => void identity.refetch(),
  };
}
