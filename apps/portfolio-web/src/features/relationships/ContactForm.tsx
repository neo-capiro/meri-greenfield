"use client";
import { useState } from "react";
import { contactInput, type Person } from "./contracts";
import type { ContactValues } from "./contact-api";

export function ContactForm({
  id,
  person,
  disabled,
  onDirty,
  onSave,
}: {
  id: string;
  person?: Person;
  disabled: boolean;
  onDirty: () => void;
  onSave: (input: ContactValues) => void;
}) {
  const [validation, setValidation] = useState("");
  const [invalidField, setInvalidField] = useState("");
  return (
    <form
      id={id}
      className="stack"
      onChange={onDirty}
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        const values = Object.fromEntries(new FormData(event.currentTarget));
        const result = contactInput.safeParse({
          ...values,
          email: String(values.email ?? "").trim(),
        });
        if (!result.success) {
          const issue = result.error.issues[0];
          const field = String(issue?.path[0] ?? "");
          setValidation(issue?.message ?? "Check the contact details.");
          setInvalidField(field);
          const input = event.currentTarget.elements.namedItem(field);
          if (input instanceof HTMLElement) input.focus();
          return;
        }
        setValidation("");
        setInvalidField("");
        onSave(result.data);
      }}
    >
      <fieldset
        disabled={disabled}
        className="stack"
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <label>
          Name *
          <input
            name="name"
            required
            maxLength={300}
            defaultValue={person?.name ?? ""}
            autoFocus
            aria-invalid={invalidField === "name" || undefined}
          />
        </label>
        <p className="muted">
          Saved titles may describe current or historical roles. Verify changes
          against a dated source; keep former roles and the source in Notes.
        </p>
        <label>
          Title
          <input
            name="title"
            maxLength={300}
            defaultValue={person?.title ?? ""}
            aria-invalid={invalidField === "title" || undefined}
          />
        </label>
        <div className="grid two">
          <label>
            Email
            <input
              type="email"
              name="email"
              maxLength={320}
              defaultValue={person?.email ?? ""}
              aria-invalid={invalidField === "email" || undefined}
            />
          </label>
          <label>
            Phone
            <input
              name="phone"
              maxLength={120}
              defaultValue={person?.phone ?? ""}
              aria-invalid={invalidField === "phone" || undefined}
            />
          </label>
        </div>
        <label>
          Role
          <input
            name="role"
            maxLength={300}
            defaultValue={person?.role ?? ""}
            aria-invalid={invalidField === "role" || undefined}
          />
        </label>
      </fieldset>
      {validation && <p role="alert">{validation}</p>}
    </form>
  );
}
