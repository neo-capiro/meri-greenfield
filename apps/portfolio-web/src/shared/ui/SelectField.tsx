"use client";
import { useId, type ComponentProps, type ReactNode } from "react";
import styles from "./field.module.css";
/** An explicit label keeps option text out of label-based form lookup. */
export function SelectField({
  label,
  id,
  ...props
}: ComponentProps<"select"> & { label: ReactNode }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={styles.field}>
      <label htmlFor={fieldId}>{label}</label>
      <select {...props} id={fieldId} />
    </div>
  );
}
