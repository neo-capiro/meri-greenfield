"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { Dialog } from "@/shared/ui/Dialog";
import { TextareaField } from "@/shared/ui/TextareaField";
import { QueryState } from "@/shared/ui/QueryState";
import type { Preparation } from "./schema";
import { savePreparation, type EditPreparation } from "./api";
import { editedBody, editValues, prepFields, type PrepField } from "./editing";
import styles from "./preparation.module.css";

export function PreparationEditor({
  meetingId,
  prep,
  onClose,
}: {
  meetingId: string;
  prep: Preparation;
  onClose: () => void;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const [values, setValues] = useState(() => editValues(prep));
  const [validation, setValidation] = useState<string>();
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(editValues(prep));
  const save = useMutation({
    retry: false,
    mutationFn: (body: EditPreparation) =>
      savePreparation(api, meetingId, prep.id, body),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["meeting", meetingId] }),
        cache.invalidateQueries({ queryKey: ["calendar", "meetings"] }),
      ]);
      onClose();
    },
  });
  function close() {
    if (save.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Edit prep"
      description="Update the working content for this meeting."
      className={styles.dialog}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          setValidation(undefined);
          try {
            const body = editedBody(prep, values);
            if (Object.keys(body).length) save.mutate(body);
          } catch (error) {
            setValidation(
              error instanceof Error
                ? error.message
                : "Check the preparation fields.",
            );
          }
        }}
      >
        {(Object.keys(prepFields) as PrepField[]).map((field) => (
          <TextareaField
            key={field}
            label={prepFields[field]}
            value={values[field]}
            rows={field === "summary" ? 2 : 3}
            disabled={save.isPending}
            onChange={(event) => {
              setValues((prior) => ({ ...prior, [field]: event.target.value }));
              setValidation(undefined);
              save.reset();
            }}
          />
        ))}
        <small>
          Use one item per line. Editing a section saves its text; unchanged
          sections retain their original evidence references.
        </small>
        {validation && <p role="alert">{validation}</p>}
        <QueryState error={save.error} />
        {discard && (
          <div className="status" role="alert">
            <p>Discard your unsaved preparation changes?</p>
            <div className="row">
              <button
                className="button"
                type="button"
                onClick={() => setDiscard(false)}
              >
                Keep editing
              </button>
              <button className="button" type="button" onClick={onClose}>
                Discard changes
              </button>
            </div>
          </div>
        )}
        <footer className="row">
          <button
            className="button"
            type="button"
            disabled={save.isPending}
            onClick={close}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={!dirty || save.isPending}
          >
            {save.isPending
              ? "Saving…"
              : save.isError
                ? "Retry save prep"
                : "Save prep"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
