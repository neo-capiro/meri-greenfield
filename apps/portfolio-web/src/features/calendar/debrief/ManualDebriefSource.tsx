"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { TextareaField } from "@/shared/ui/TextareaField";
import styles from "./manual-source.module.css";

export function ManualDebriefSource({
  open,
  onOpenChange,
  allowed,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowed: boolean;
  onGenerate: (text: string) => boolean;
}) {
  const [text, setText] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Type Notes Manually"
      description="Use written context for the generated debrief."
      className={styles.dialog}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (allowed && text.trim() && onGenerate(text)) onOpenChange(false);
        }}
      >
        <TextareaField
          label="Meeting context"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={50000}
          required
          autoFocus
          disabled={!allowed}
        />
        {!allowed && (
          <p role="status">
            A current authorized session and enabled generation service are
            required. Your written context is retained.
          </p>
        )}
        <footer className={styles.actions}>
          <button
            type="button"
            className="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={!allowed || !text.trim()}
          >
            Generate Debrief
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
