import { useId, type ChangeEvent, type InputHTMLAttributes } from "react";
import type { IntakeForm, IntakeField } from "./form";
import { Popover } from "radix-ui";
import styles from "./intake.module.css";
export interface StepProps {
  values: IntakeForm;
  set: <K extends IntakeField>(key: K, value: IntakeForm[K]) => void;
  errors: Partial<Record<IntakeField, string>>;
}
export function TextField({
  label,
  error,
  multiline,
  onChange,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  error?: string;
  multiline?: boolean;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
}) {
  const id = useId();
  const common = {
    id,
    "aria-required": label.endsWith("*"),
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : undefined,
    value: input.value,
    name: input.name,
    maxLength: input.maxLength,
  };
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...common} onChange={onChange} />
      ) : (
        <input {...input} {...common} onChange={onChange} />
      )}
      {error && (
        <small id={`${id}-error`} className="danger">
          {error}
        </small>
      )}
    </div>
  );
}
export function ChoiceList({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const known = new Set(options.map(([key]) => key));
  const all = [
    ...options,
    ...value
      .filter((key) => !known.has(key))
      .map((key) => [key, `${key} · existing value`] as const),
  ];
  return (
    <fieldset className={styles.choices}>
      <legend>{label}</legend>
      <div>
        {all.map(([key, name]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={value.includes(key)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, key]
                    : value.filter((v) => v !== key),
                )
              }
            />
            {name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function ChoiceSelect({
  label,
  options,
  value,
  onChange,
}: Parameters<typeof ChoiceList>[0]) {
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <Popover.Root>
        <Popover.Trigger
          className={`button ${styles.choiceTrigger}`}
          aria-label={label}
        >
          <span>
            {value.length
              ? value
                  .map(
                    (key) =>
                      options.find(([value]) => value === key)?.[1] ?? key,
                  )
                  .join(", ")
              : `Select ${label.toLowerCase()}`}
          </span>
          <span aria-hidden="true">⌄</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.choicePopup}
            align="start"
            sideOffset={6}
          >
            <ChoiceList
              label={label}
              options={options}
              value={value}
              onChange={onChange}
            />
            <Popover.Close className="button">Done</Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
