"use client";
import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import {
  currentClientWriter,
  assertClientWriter,
  type ClientWriter,
} from "../quick-log/public";
import {
  downloadProfileExport,
  prepareProfileExport,
  type ProfileExport,
} from "./actions";
export interface ClientProfileExportProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
}
export function ClientProfileExport(props: ClientProfileExportProps) {
  const cache = useQueryClient();
  const identity = useIdentity();
  const actor = currentClientWriter(cache);
  if (!props.open) return null;
  return actor && !identity.error && !identity.isFetching ? (
    <ExportSession
      {...props}
      actor={actor}
      key={`${props.clientId}:${actor.tenantId}:${actor.userId}`}
    />
  ) : (
    <Dialog
      open
      onOpenChange={props.onOpenChange}
      onCloseAutoFocus={props.onCloseAutoFocus}
      title="Export client profile"
    >
      <p className="status">A current authorized client session is required.</p>
    </Dialog>
  );
}
function ExportSession({
  clientId,
  open,
  onOpenChange,
  onCloseAutoFocus,
  actor,
}: ClientProfileExportProps & { actor: ClientWriter }) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const [payload, setPayload] = useState<ProfileExport>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const currentActor = currentClientWriter(cache);
  const allowed = Boolean(
    actor &&
    currentActor &&
    actor.userId === currentActor.userId &&
    actor.tenantId === currentActor.tenantId &&
    !identity.error &&
    !identity.isFetching,
  );
  useLayoutEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => {
      current.abort();
      if (controller.current === current) controller.current = null;
    };
  }, [clientId]);
  function guard() {
    if (!actor || !controller.current)
      throw new Error("The export session closed.");
    controller.current.signal.throwIfAborted();
    assertClientWriter(cache, actor);
  }
  async function prepare() {
    if (!allowed || lock.current || !actor || !controller.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setPayload(undefined);
    try {
      const result = await prepareProfileExport(
        api,
        clientId,
        actor,
        guard,
        controller.current.signal,
      );
      guard();
      setPayload(result);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The profile could not be prepared.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title="Export client profile"
      description="Download a JSON snapshot of the saved profile and its intelligence sources."
    >
      <div className="stack">
        <p className="muted">
          The snapshot includes sensitive client information available to your
          account. Source values and attribution are preserved in the JSON.
        </p>
        {!allowed && (
          <p className="status">
            A current authorized client session is required.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {payload && allowed && (
          <section className="status" aria-live="polite">
            <strong>
              {payload.complete
                ? "Profile ready to download"
                : "Partial profile ready to download"}
            </strong>
            <p>{payload.client.name}</p>
            <p>
              {payload.complete
                ? "Client profile and intelligence are included."
                : "Intelligence was unavailable and is omitted. The JSON records this omission and the source error."}
            </p>
            <small>
              Prepared{" "}
              <time dateTime={payload.exportedAt}>
                {new Date(payload.exportedAt).toLocaleString()}
              </time>
            </small>
          </section>
        )}
        <div className="row">
          <button className="button" onClick={() => onOpenChange(false)}>
            Close
          </button>
          {payload && allowed ? (
            <button
              className="button primary"
              onClick={() => {
                try {
                  downloadProfileExport(payload, guard);
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Download failed.",
                  );
                }
              }}
            >
              Download {payload.complete ? "JSON" : "partial JSON"}
            </button>
          ) : (
            <button
              className="button primary"
              disabled={!allowed || pending}
              onClick={() => void prepare()}
            >
              {pending
                ? "Preparing…"
                : error
                  ? "Retry preparation"
                  : "Prepare JSON"}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
