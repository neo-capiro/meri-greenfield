"use client";
import { useId, type ComponentProps, type ReactNode } from "react";
import styles from "./field.module.css";
/** A separate label keeps prefilled/controlled textarea content out of its label text. */
export function TextareaField({
  label,
  hint,
  id,
  ...props
}: ComponentProps<"textarea"> & { label: ReactNode; hint?: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  return (
    <div className={styles.field}>
      <label htmlFor={fieldId}>{label}</label>
      {hint && <small id={hintId}>{hint}</small>}
      <textarea
        {...props}
        id={fieldId}
        aria-describedby={
          props["aria-describedby"] ?? (hint ? hintId : undefined)
        }
      />
    </div>
  );
}
