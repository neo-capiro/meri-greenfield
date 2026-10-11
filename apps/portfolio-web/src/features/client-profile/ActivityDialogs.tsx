"use client";
import { useRef, useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { TextareaField } from "@/shared/ui/TextareaField";
import { activityEditSchema, type Activity } from "./contracts";
import { useChangeActivity } from "./activity-mutations";
import styles from "./activity-actions.module.css";

type Props = {
  clientId: string;
  item: Activity;
  onClose: () => void;
  onReturnFocus: () => void;
};
export function EditActivity({
  clientId,
  item,
  onClose,
  onReturnFocus,
}: Props) {
  const [title, setTitle] = useState(item.title);
  const titleInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState(item.body ?? "");
  const [validation, setValidation] = useState("");
  const mutation = useChangeActivity(clientId, item, onClose);
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
          if (mutation.isPending) return;
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
        <div className={styles.error}>
          <QueryState error={mutation.error} />
        </div>
        <div className="formActions">
          <button
            type="button"
            className="button"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save activity"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function RemoveActivity({
  clientId,
  item,
  onClose,
  onReturnFocus,
}: Props) {
  const mutation = useChangeActivity(clientId, item, onClose);
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
          Only remove an entry after confirming it is no longer needed, such as
          a test entry your team has verified.
        </p>
        <div className={styles.error}>
          <QueryState error={mutation.error} />
        </div>
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
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ action: "remove" })}
        >
          {mutation.isPending ? "Removing…" : "Remove activity"}
        </button>
      </footer>
    </Dialog>
  );
}
