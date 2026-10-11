"use client";
import { useRef, useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { TextareaField } from "@/shared/ui/TextareaField";
import { activityEditSchema, type Activity } from "./contracts";
import type { ActivityMutationState } from "./activity-mutations";
import styles from "./activity-actions.module.css";

type Props = {
  item: Activity;
  state: ActivityMutationState;
  onClose: () => void;
  onReturnFocus: () => void;
};
export function EditActivity({ item, state, onClose, onReturnFocus }: Props) {
  const [title, setTitle] = useState(item.title);
  const titleInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState(item.body ?? "");
  const [validation, setValidation] = useState("");
  const { mutation } = state;
  return (
    <Dialog
      open
      title="Edit activity"
      description="Update the title and details of this recorded activity."
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        titleInput.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (mutation.isPending || state.reviewing || !state.canWrite) return;
          const parsed = activityEditSchema.safeParse({ title, body });
          if (!parsed.success) {
            setValidation(
              parsed.error.issues[0]?.message ?? "Check the activity details.",
            );
            return;
          }
          setValidation("");
          mutation.mutate({ action: "edit", fields: parsed.data });
        }}
      >
        <label>
          Title
          <input
            ref={titleInput}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={300}
            disabled={mutation.isPending}
          />
        </label>
        <TextareaField
          label="Details"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={5000}
          disabled={mutation.isPending}
        />
        {validation && <p role="alert">{validation}</p>}
        <ActivityMutationStatus state={state} />
        <div className="formActions">
          <button
            type="button"
            className="button"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={mutation.isPending || state.reviewing || !state.canWrite}
          >
            {mutation.isPending ? "Saving…" : "Save activity"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function RemoveActivity({ item, state, onClose, onReturnFocus }: Props) {
  const { mutation } = state;
  return (
    <Dialog
      open
      title="Remove activity?"
      description={`Permanently remove “${item.title}” from this client’s timeline?`}
      className={styles.removeDialog}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <div className={styles.removeBody}>
        <p className="muted">
          This removes the recorded activity from this client’s timeline.
        </p>
        <ActivityMutationStatus state={state} />
      </div>
      <footer className={styles.removeFooter}>
        <button
          className="button"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="button primary"
          disabled={mutation.isPending || state.reviewing || !state.canWrite}
          onClick={() => mutation.mutate({ action: "remove" })}
        >
          {mutation.isPending ? "Removing…" : "Remove activity"}
        </button>
      </footer>
    </Dialog>
  );
}

export function ActivityMutationStatus({
  state,
  retry,
}: {
  state: ActivityMutationState;
  retry?: () => void;
}) {
  return (
    <div className={styles.error}>
      <QueryState
        error={state.reviewError ?? state.mutation.error}
        retry={state.canWrite ? retry : undefined}
      />
      {state.needsReview && (
        <div className={styles.review} role="status">
          <p>
            {state.uncertain
              ? "The result is not confirmed."
              : "This entry changed."}{" "}
            Load and review the latest activity before trying again.
          </p>
          <button
            type="button"
            className="button"
            disabled={state.reviewing || !state.canOpen}
            onClick={() => void state.reviewLatest()}
          >
            {state.reviewing
              ? "Loading latest activity…"
              : "Review latest activity"}
          </button>
        </div>
      )}
      {state.reviewed && (
        <details className={styles.review} open>
          <summary>Latest saved activity</summary>
          {state.reviewed.item ? (
            <>
              <p>{state.reviewed.item.title}</p>
              <p>{state.reviewed.item.body || "No details"}</p>
              <p>
                {state.reviewed.item.pinned ? "Pinned" : "Not pinned"}
                {state.reviewed.item.dueAt
                  ? state.reviewed.item.settledAt
                    ? " · Settled"
                    : " · Open"
                  : ""}
              </p>
            </>
          ) : (
            <p>
              This entry is no longer in the current activity list. Close this
              dialog and review the timeline.
            </p>
          )}
        </details>
      )}
    </div>
  );
}
