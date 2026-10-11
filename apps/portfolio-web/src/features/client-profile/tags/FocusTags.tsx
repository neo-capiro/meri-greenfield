"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { useClient, clientKey, clientsKey } from "@/features/portfolio/public";
import { currentClientWriter, ambiguousClientWrite } from "../quick-log/public";
import {
  addFocusTag,
  assertTagWriter,
  focusTags,
  focusTagSchema,
} from "./actions";
import styles from "./tags.module.css";
export function FocusTags({ clientId }: { clientId: string }) {
  const identity = useIdentity();
  // Identity data selects state ownership only. Fresh permissions are checked
  // inside the session and again at each API boundary. Keep this key stable
  // during same-actor refetches so an unknown-write freeze is not discarded.
  const scope = `${clientId}:${identity.data?.tenant?.id ?? "unverified"}:${identity.data?.user.id ?? "unverified"}`;
  return <FocusTagSession key={scope} clientId={clientId} />;
}
function FocusTagSession({ clientId }: { clientId: string }) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const client = useClient(clientId);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const actor = currentClientWriter(cache);
  const allowed = Boolean(
    actor &&
    !identity.error &&
    !identity.isFetching &&
    canAdminister(identity.data?.role),
  );
  useLayoutEffect(() => {
    const current = new AbortController();
    controller.current = open ? current : null;
    return () => {
      current.abort();
      if (controller.current === current) controller.current = null;
    };
  }, [open, clientId, actor?.userId, actor?.tenantId]);
  async function save() {
    const current = controller.current;
    const initiating = currentClientWriter(cache);
    if (!current || !initiating || !allowed || lock.current || uncertain)
      return;
    lock.current = true;
    setPending(true);
    setError("");
    let sent = false;
    const guard = () => {
      current.signal.throwIfAborted();
      if (controller.current !== current)
        throw new Error("The tag editor closed.");
      try {
        assertTagWriter(cache, initiating);
      } catch (failure) {
        if (sent)
          throw new Error(
            "Your session changed after the tag write was dispatched. Inspect the current profile before another change.",
          );
        throw failure;
      }
    };
    try {
      await addFocusTag(
        api,
        clientId,
        initiating,
        value,
        guard,
        current.signal,
        () => {
          sent = true;
        },
      );
      await Promise.all([
        cache.invalidateQueries({ queryKey: clientKey(clientId) }),
        cache.invalidateQueries({ queryKey: clientsKey }),
        cache.invalidateQueries({ queryKey: ["client-profile", clientId] }),
      ]);
      setValue("");
      setOpen(false);
    } catch (failure) {
      if (sent && ambiguousClientWrite(failure)) setUncertain(true);
      setError(
        failure instanceof Error
          ? failure.message
          : "The focus tag could not be saved.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <div className={styles.tags} aria-label="Client focus tags">
        <span className="eyebrow">Focus</span>
        {focusTags(client.data?.intakeData).map((tag) => (
          <span className={styles.tag} key={tag}>
            {tag}
          </span>
        ))}
        <button
          className={styles.add}
          disabled={!allowed || Boolean(client.error) || client.isPending}
          onClick={() => setOpen(true)}
        >
          + Add<span className="srOnly"> focus tag</span>
        </button>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add focus tag"
        description="Add a focus area to this client profile."
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="field">
            Focus tag
            <input
              autoComplete="off"
              maxLength={100}
              value={value}
              disabled={!allowed || pending || uncertain}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          {uncertain && (
            <p className="status">
              The save outcome is unknown. Inspect the current profile before
              making another change. This editor will not resend it.
            </p>
          )}
          {!allowed && (
            <p className="status">
              A current administrator session is required.
            </p>
          )}
          <div className="row">
            <button
              type="button"
              className="button"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            <button
              className="button primary"
              disabled={
                !allowed ||
                pending ||
                uncertain ||
                !focusTagSchema.safeParse(value).success
              }
            >
              {pending ? "Saving…" : "Add tag"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
