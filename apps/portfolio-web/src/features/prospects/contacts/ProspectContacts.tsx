"use client";
import { useRef, useState } from "react";
import { useIdentity } from "@/shared/auth/identity";
import { QueryState } from "@/shared/ui/QueryState";
import { initials } from "@/features/portfolio/public";
import { useContacts } from "./queries";
import type { ProspectContact } from "./contracts";
import { ContactEditor } from "./ContactEditor";
import styles from "./contacts.module.css";
export function ProspectContacts({ prospectId }: { prospectId: string }) {
  const query = useContacts(prospectId);
  const identity = useIdentity();
  const [editor, setEditor] = useState<{ contact?: ProspectContact } | null>(
    null,
  );
  const trigger = useRef<HTMLButtonElement | null>(null);
  const section = useRef<HTMLElement>(null);
  const roleAllowed = ["standard_user", "user_admin", "capiro_admin"].includes(
    identity.data?.role ?? "",
  );
  const editable =
    roleAllowed &&
    query.data !== null &&
    Boolean(query.data) &&
    !query.data?.readOnly;
  function open(button: HTMLButtonElement, contact?: ProspectContact) {
    trigger.current = button;
    setEditor({ contact });
  }
  return (
    <section
      ref={section}
      className={styles.card}
      aria-label="Prospect contacts"
      tabIndex={-1}
    >
      <header className={styles.header}>
        <h2>Contacts</h2>
        <button
          className={`button ${styles.add}`}
          disabled={!editable}
          onClick={(event) => open(event.currentTarget)}
        >
          + Add
        </button>
      </header>
      <div className={styles.states}>
        <QueryState
          pending={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.data === null && (
          <p role="status" className="muted">
            Prospect contacts are unavailable for this account or service. No
            contact changes can be saved.
          </p>
        )}
        {query.data && !query.data.contacts.length && (
          <p className="muted">No contacts yet.</p>
        )}
        {query.data?.readOnly && (
          <p className="muted">
            Archived or converted prospect · contacts are read-only.
          </p>
        )}
        <QueryState error={identity.error} />
      </div>
      {query.data?.contacts.map((contact) => (
        <button
          key={contact.id}
          className={styles.contact}
          onClick={(event) => open(event.currentTarget, contact)}
        >
          <span className={styles.avatar}>{initials(contact.name)}</span>
          <span className={styles.summary}>
            <strong>{contact.name}</strong>
            <small>{contact.title ?? "No title"}</small>
          </span>
        </button>
      ))}
      {editor && (
        <ContactEditor
          key={`${prospectId}:${editor.contact?.id ?? "new"}`}
          prospectId={prospectId}
          contact={editor.contact}
          readOnly={!editable}
          onClose={() => setEditor(null)}
          returnFocus={() => {
            const button = trigger.current;
            if (button?.isConnected) button.focus();
            else section.current?.focus();
          }}
        />
      )}
    </section>
  );
}
