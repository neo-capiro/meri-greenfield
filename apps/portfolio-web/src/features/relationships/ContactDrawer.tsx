"use client";
import { useId, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { TextareaField } from "@/shared/ui/TextareaField";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { ApiError } from "@/shared/api/http";
import { useIdentity } from "@/shared/auth/identity";
import type { Person } from "./contracts";
import { canManageContacts } from "./contact-api";
import { peopleWriteKey, usePersonMutation } from "./mutations";
import { ContactForm } from "./ContactForm";
import { HierarchyEditor } from "./HierarchyEditor";
import { ContactMail } from "./ContactMail";
import { QuickLog } from "@/features/client-profile/public";
import styles from "./contact-drawer.module.css";

export function ContactDrawer({
  clientId,
  person,
  people,
  open,
  onClose,
}: {
  clientId: string;
  person?: Person;
  people: Person[];
  open: boolean;
  onClose: () => void;
}) {
  const formId = useId();
  const [opener] = useState(() =>
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const identity = useIdentity();
  const permitted =
    identity.isSuccess &&
    !identity.isFetching &&
    !identity.error &&
    canManageContacts(identity.data?.role);
  const [remove, setRemove] = useState(false);
  const [note, setNote] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const mutation = usePersonMutation(clientId, onClose);
  const busy = useIsMutating({ mutationKey: peopleWriteKey(clientId) }) > 0;
  const uncertainCreate =
    !person &&
    Boolean(mutation.error) &&
    (!(mutation.error instanceof ApiError) || mutation.error.status >= 500);
  function close() {
    if (!busy) {
      if (dirty) setDiscard(true);
      else onClose();
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
      title={person?.name ?? "Add contact"}
      description={person?.title ?? undefined}
      drawer
      className={styles.drawer}
      onCloseAutoFocus={(event) => {
        if (opener?.isConnected) {
          event.preventDefault();
          opener.focus();
        }
      }}
    >
      <div className={`${styles.viewport} stack`} aria-busy={busy}>
        <QueryState
          error={identity.error}
          retry={() => void identity.refetch()}
        />
        {identity.isSuccess &&
          !identity.isFetching &&
          !identity.error &&
          !permitted && (
            <p role="status">Your role cannot change organization contacts.</p>
          )}
        <ContactForm
          id={formId}
          person={person}
          disabled={!permitted || busy || uncertainCreate}
          onDirty={() => setDirty(true)}
          onSave={(input) =>
            mutation.mutate({
              kind: "save",
              id: person?.id,
              body: { ...input, email: input.email || null },
            })
          }
        />
        {person && (
          <>
            <button
              className="button"
              disabled={!permitted || busy}
              onClick={() => setNote(true)}
            >
              Log note
            </button>
            <ContactMail
              clientId={clientId}
              person={{ ...person, personId: person.id }}
            />
            <fieldset
              disabled={!permitted || busy}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <HierarchyEditor
                key={`${person.id}:${person.placementSource}:${person.hierarchyLevel}:${person.reportsToPersonId}`}
                clientId={clientId}
                person={person}
                people={people}
              />
            </fieldset>
            <QuickLog
              clientId={clientId}
              clientName={person.name}
              personId={person.id}
              open={note}
              onOpenChange={setNote}
            />
          </>
        )}
        <TextareaField
          label="Notes"
          name="notes"
          form={formId}
          maxLength={20000}
          defaultValue={person?.notes ?? ""}
          disabled={!permitted || busy || uncertainCreate}
          onChange={() => setDirty(true)}
        />
        <QueryState error={mutation.error} />
        {uncertainCreate && (
          <p role="alert">
            This request may have saved. Your draft is preserved. Close and
            check the refreshed roster before creating another contact.
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        {person && (
          <button
            type="button"
            className="button ghost"
            disabled={!permitted || busy}
            onClick={() => {
              mutation.reset();
              setRemove(true);
            }}
          >
            Remove
          </button>
        )}
        <span className={styles.spacer} />
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={close}
        >
          Cancel
        </button>
        <button
          type="submit"
          form={formId}
          className="button primary"
          disabled={!permitted || busy || uncertainCreate}
        >
          {mutation.isPending ? "Saving…" : "Save contact"}
        </button>
      </footer>
      <Dialog
        open={discard}
        onOpenChange={setDiscard}
        title="Discard contact changes?"
        description="Your unsaved contact details will be discarded."
      >
        <div className="formActions">
          <button className="button" onClick={() => setDiscard(false)}>
            Keep editing
          </button>
          <button className="button primary" onClick={onClose}>
            Discard changes
          </button>
        </div>
      </Dialog>
      {person && (
        <Dialog
          open={remove}
          onOpenChange={(value) => {
            if (!busy) setRemove(value);
          }}
          title="Remove contact"
          description={`Remove ${person.name} from this client's roster? Saved direct reports will retain their contacts and lose this manager link.`}
        >
          <QueryState error={mutation.error} />
          <div className="formActions">
            <button
              className="button"
              disabled={busy}
              onClick={() => setRemove(false)}
            >
              Keep contact
            </button>
            <button
              className="button primary"
              disabled={!permitted || busy}
              onClick={() => mutation.mutate({ kind: "delete", id: person.id })}
            >
              {busy ? "Removing…" : "Confirm remove"}
            </button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
