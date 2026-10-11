"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { SelectField } from "@/shared/ui/SelectField";
import { TextareaField } from "@/shared/ui/TextareaField";
import type { Matter, MatterDetail } from "./contracts";
import type { Correction } from "./correction";
import { useMatter } from "./queries";
import { useCorrection } from "./useCorrection";
import styles from "./advocacy.module.css";

export type CorrectionContext =
  | { kind: "merge"; matter: MatterDetail }
  | {
      kind: "reassign" | "detach" | "not-advocacy";
      matter: MatterDetail | null;
      record: { id: string; title: string };
    };
const titles = {
  merge: "Merge another matter into this one",
  reassign: "Reassign record",
  detach: "Detach record",
  "not-advocacy": "Mark not advocacy",
};
const actions = {
  merge: "Merge source into destination",
  reassign: "Reassign",
  detach: "Detach",
  "not-advocacy": "Mark not advocacy",
};

export function CorrectionDialog({
  clientId,
  context,
  matters,
  onClose,
  onSaved,
}: {
  clientId: string;
  context: CorrectionContext;
  matters: readonly Matter[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [choiceId, setChoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [reviewedMatter, setReviewedMatter] = useState(context.matter);
  const current = useMatter(clientId, context.matter?.id ?? null);
  const choice = useMatter(clientId, choiceId || null);
  const [refreshing, setRefreshing] = useState(false);
  const { mutation, reconcile, submitted, canEdit } = useCorrection(
    clientId,
    onSaved,
  );
  const pending = mutation.isPending || reconcile.isPending || refreshing;
  const choices = matters.filter((matter) => matter.id !== context.matter?.id);
  const chosen =
    !choice.error && choices.some((matter) => matter.id === choiceId)
      ? choice.data
      : undefined;
  let operation: Correction | undefined;
  if (context.kind === "merge" && reviewedMatter && chosen)
    operation = { kind: "merge", source: chosen, target: reviewedMatter };
  else if (context.kind === "reassign" && chosen)
    operation = {
      kind: "reassign",
      recordId: context.record.id,
      source: reviewedMatter,
      target: chosen,
    };
  else if (context.kind === "detach" || context.kind === "not-advocacy")
    operation = {
      kind: context.kind,
      source: reviewedMatter,
      recordId: context.record.id,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    };
  async function reload() {
    setRefreshing(true);
    try {
      if (context.matter) {
        const result = await current.refetch();
        if (result.error || !result.data) return;
        setReviewedMatter(result.data);
      }
      if (choiceId) await choice.refetch();
      mutation.reset();
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      title={titles[context.kind]}
      className={`${styles.correction} ${context.kind === "merge" ? styles.merge : context.kind === "detach" ? styles.detach : ""}`}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (operation && canEdit && !pending && !submitted)
            mutation.mutate(operation);
        }}
      >
        <div className={styles.body}>
          {context.kind !== "merge" && <strong>{context.record.title}</strong>}
          {context.kind === "merge" && (
            <p>
              Choose a source matter to merge into “{reviewedMatter?.title}”.
              The destination matter is kept.
            </p>
          )}
          {context.kind === "reassign" && (
            <p>
              Move this record to a different matter. It will be locked so later
              automatic re-clustering does not move it back.
            </p>
          )}
          {context.kind === "detach" && (
            <p>
              This record will be removed from its matter and left unassigned.
              It is retained for later manual reassignment and will not be
              auto-clustered again.
            </p>
          )}
          {context.kind === "not-advocacy" && (
            <p>
              This marks the record as not advocacy activity. It is hidden from
              Matters and the Timeline, retained for audit, and locked against
              automatic re-clustering.
            </p>
          )}
          {(context.kind === "merge" || context.kind === "reassign") && (
            <>
              <SelectField
                label={context.kind === "merge" ? "Source matter" : "Matter"}
                value={choiceId}
                required
                disabled={pending || submitted || !canEdit}
                onChange={(event) => setChoiceId(event.target.value)}
              >
                <option value="">Choose a different matter</option>
                {choices.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.title}
                  </option>
                ))}
              </SelectField>
              {choices.length === 0 && (
                <p>No other matters are available for this client.</p>
              )}
              {choiceId && (
                <QueryState
                  pending={choice.isPending}
                  error={choice.error}
                  retry={() => void choice.refetch()}
                />
              )}
            </>
          )}
          {context.kind === "merge" && chosen && (
            <p className={styles.warning}>
              Merge “{chosen.title}” into “{reviewedMatter?.title}”. All records
              and links move to the destination; the source matter is
              permanently removed. This cannot be undone.
            </p>
          )}
          {context.kind === "not-advocacy" && (
            <TextareaField
              label="Reason (optional)"
              maxLength={1000}
              value={reason}
              disabled={pending || submitted || !canEdit}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
          {!canEdit && (
            <p className="status">
              Your current role cannot make this correction.
            </p>
          )}
          <QueryState
            error={reconcile.error ?? mutation.error ?? current.error}
          />
          {submitted && mutation.error && (
            <p role="status">
              A request was submitted, but its result is unconfirmed. Check
              current records before making another correction; this form will
              not repeat the request.
            </p>
          )}
          {!submitted && mutation.error && (
            <button
              className="button"
              type="button"
              disabled={pending || !canEdit}
              onClick={() => void reload()}
            >
              Reload current records
            </button>
          )}
        </div>
        <footer className={styles.footer}>
          {submitted ? (
            <button
              type="button"
              className="button primary"
              disabled={pending || !canEdit}
              onClick={() => reconcile.mutate()}
            >
              {mutation.isPending
                ? "Saving…"
                : pending
                  ? "Checking…"
                  : "Check current result"}
            </button>
          ) : (
            <button
              className="button primary"
              disabled={
                pending || !canEdit || !operation || Boolean(mutation.error)
              }
            >
              {pending ? "Saving…" : actions[context.kind]}
            </button>
          )}
          <button
            className="button"
            type="button"
            disabled={pending}
            onClick={onClose}
          >
            {submitted ? "Close" : "Cancel"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
