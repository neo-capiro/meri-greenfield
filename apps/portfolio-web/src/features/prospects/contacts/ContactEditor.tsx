"use client";
import { useId, useRef, useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { TextareaField } from "@/shared/ui/TextareaField";
import { QueryState } from "@/shared/ui/QueryState";
import { ApiError } from "@/shared/api/http";
import { contactInput, contactValues, type ProspectContact } from "./contracts";
import { useContactMutation, useLatestContact } from "./queries";
import styles from "./contacts.module.css";

export function ContactEditor({
  prospectId,
  contact,
  readOnly,
  onClose,
  returnFocus,
}: {
  prospectId: string;
  contact?: ProspectContact;
  readOnly: boolean;
  onClose: () => void;
  returnFocus: () => void;
}) {
  const [initial, setInitial] = useState(contact);
  const [values, setValues] = useState(() => contactValues(contact));
  const [validation, setValidation] = useState("");
  const [invalidField, setInvalidField] = useState<string>();
  const validationId = useId();
  const [removing, setRemoving] = useState(false);
  const [latest, setLatest] = useState<ProspectContact>();
  const [requestId] = useState(() => crypto.randomUUID());
  const formRef = useRef<HTMLFormElement>(null);
  const review = useLatestContact(prospectId);
  const mutation = useContactMutation(prospectId, onClose);
  const conflict =
    mutation.error instanceof ApiError && mutation.error.status === 409;
  const pending = mutation.isPending || review.isPending;
  return (
    <Dialog
      open
      title={contact?.name ?? "Add prospect contact"}
      drawer
      className={styles.drawer}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocus();
      }}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <form
        ref={formRef}
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (readOnly || pending || (conflict && initial)) return;
          const result = contactInput.safeParse(values);
          if (!result.success) {
            setValidation(
              result.error.issues[0]?.message ?? "Check the contact details.",
            );
            const field = String(result.error.issues[0]?.path[0] ?? "name");
            setInvalidField(field);
            formRef.current
              ?.querySelector<
                HTMLInputElement | HTMLTextAreaElement
              >(`[name="${field}"]`)
              ?.focus();
            return;
          }
          setValidation("");
          setInvalidField(undefined);
          mutation.mutate({
            kind: "save",
            values: result.data,
            requestId,
            contact: initial,
          });
        }}
      >
        <div className={styles.fields}>
          <label>
            Name *
            <input
              name="name"
              aria-invalid={invalidField === "name"}
              aria-describedby={
                invalidField === "name" ? validationId : undefined
              }
              value={values.name}
              required
              aria-required
              maxLength={300}
              disabled={readOnly || pending}
              onChange={(event) =>
                setValues({ ...values, name: event.target.value })
              }
            />
          </label>
          <p className="muted">
            Saved titles may describe current or historical roles. Verify
            changes against a dated source; keep former roles and the source in
            Notes.
          </p>
          <label>
            Title
            <input
              name="title"
              aria-invalid={invalidField === "title"}
              aria-describedby={
                invalidField === "title" ? validationId : undefined
              }
              value={values.title}
              maxLength={300}
              disabled={readOnly || pending}
              onChange={(event) =>
                setValues({ ...values, title: event.target.value })
              }
            />
          </label>
          <div className={styles.pair}>
            <label>
              Email
              <input
                name="email"
                aria-invalid={invalidField === "email"}
                aria-describedby={
                  invalidField === "email" ? validationId : undefined
                }
                type="email"
                value={values.email}
                maxLength={320}
                disabled={readOnly || pending}
                onChange={(event) =>
                  setValues({ ...values, email: event.target.value })
                }
              />
            </label>
            <label>
              Phone
              <input
                name="phone"
                aria-invalid={invalidField === "phone"}
                aria-describedby={
                  invalidField === "phone" ? validationId : undefined
                }
                value={values.phone}
                maxLength={120}
                disabled={readOnly || pending}
                onChange={(event) =>
                  setValues({ ...values, phone: event.target.value })
                }
              />
            </label>
          </div>
          <TextareaField
            name="notes"
            aria-invalid={invalidField === "notes"}
            aria-describedby={
              invalidField === "notes" ? validationId : undefined
            }
            label="Notes"
            value={values.notes}
            maxLength={4000}
            rows={5}
            disabled={readOnly || pending}
            onChange={(event) =>
              setValues({ ...values, notes: event.target.value })
            }
          />
          {readOnly && (
            <p role="status">Contacts are read-only for this prospect.</p>
          )}
          {validation && (
            <p id={validationId} className="error" role="alert">
              {validation}
            </p>
          )}
          <QueryState error={mutation.error} />
          {conflict && initial && (
            <section className="status stack">
              <p>
                Your unsaved changes are preserved. Review the latest contact
                before saving again.
              </p>
              <button
                type="button"
                className="button"
                disabled={pending}
                onClick={() => {
                  if (initial)
                    review.mutate(initial.id, { onSuccess: setLatest });
                }}
              >
                Review latest contact
              </button>
              <QueryState error={review.error} />
              {latest && (
                <>
                  <p>
                    Latest saved version {latest.version}: {latest.name} ·{" "}
                    {latest.title ?? "No title"}
                  </p>
                  <dl>
                    {(["email", "phone", "notes"] as const).map((key) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{latest[key] ?? "None"}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setInitial(latest);
                      setValues(contactValues(latest));
                      setLatest(undefined);
                      setRemoving(false);
                      mutation.reset();
                    }}
                  >
                    Replace my draft with latest values
                  </button>
                </>
              )}
            </section>
          )}
          {removing && (
            <section className="status stack" role="alert">
              <p>
                Remove {initial?.name} from this prospect? The contact record
                will be archived.
              </p>
              <div className="row">
                <button
                  type="button"
                  className="button"
                  disabled={pending}
                  onClick={() => setRemoving(false)}
                >
                  Keep contact
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={pending || readOnly || conflict}
                  onClick={() => {
                    if (initial)
                      mutation.mutate({ kind: "remove", contact: initial });
                  }}
                >
                  Confirm removal
                </button>
              </div>
            </section>
          )}
        </div>
        <footer className={styles.footer}>
          {initial && !readOnly && (
            <button
              type="button"
              className="button ghost"
              disabled={pending}
              onClick={() => setRemoving(true)}
            >
              Remove
            </button>
          )}
          <span className={styles.spacer} />
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={onClose}
          >
            {readOnly ? "Close contact" : "Cancel"}
          </button>
          {!readOnly && (
            <button
              className="button primary"
              disabled={pending || (conflict && Boolean(initial))}
            >
              {pending ? "Saving…" : "Save contact"}
            </button>
          )}
        </footer>
      </form>
    </Dialog>
  );
}
