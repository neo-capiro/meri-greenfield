"use client";
import { useState } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import { usePeople } from "../queries";
import { mailRecipient, type Recipient } from "./recipients";
import styles from "./email.module.css";

export function RecipientFields({
  clientId,
  to,
  onTo,
  cc,
  onCc,
  bcc,
  onBcc,
  disabled,
}: {
  clientId: string;
  to: Recipient[];
  onTo: (items: Recipient[]) => void;
  cc: string;
  onCc: (value: string) => void;
  bcc: string;
  onBcc: (value: string) => void;
  disabled: boolean;
}) {
  const roster = usePeople(clientId);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [showCc, setShowCc] = useState(Boolean(cc));
  const [showBcc, setShowBcc] = useState(false);
  const selected = new Set(to.map((item) => item.email.toLowerCase()));
  const seen = new Set<string>();
  const choices = (roster.data ?? []).flatMap((person) => {
    const parsed = mailRecipient.safeParse({
      email: person.email?.trim(),
      name: person.name,
      personId: person.id,
    });
    if (
      !parsed.success ||
      selected.has(parsed.data.email) ||
      seen.has(parsed.data.email)
    )
      return [];
    seen.add(parsed.data.email);
    return `${person.name} ${person.email}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
      ? [parsed.data]
      : [];
  });
  return (
    <section className="stack" aria-label="Email recipients">
      <div className="row between">
        <strong>To</strong>
        <div className="row">
          <button
            type="button"
            className="button ghost"
            disabled={disabled}
            onClick={() => setShowCc(true)}
          >
            Cc
          </button>
          <button
            type="button"
            className="button ghost"
            disabled={disabled}
            onClick={() => setShowBcc(true)}
          >
            Bcc
          </button>
        </div>
      </div>
      <div className={styles.chips}>
        {to.map((item) => (
          <span key={item.email} className={styles.chip}>
            {item.name ? `${item.name} <${item.email}>` : item.email}
            <button
              type="button"
              className="button ghost iconButton"
              aria-label={`Remove recipient ${item.email}`}
              disabled={disabled}
              onClick={() =>
                onTo(to.filter((other) => other.email !== item.email))
              }
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        className="button ghost"
        aria-expanded={picker}
        disabled={disabled || to.length >= 50}
        onClick={() => setPicker(!picker)}
      >
        + Add recipient
      </button>
      {showCc && (
        <label>
          Cc
          <input
            value={cc}
            disabled={disabled}
            placeholder="name@example.com"
            onChange={(event) => onCc(event.target.value)}
          />
        </label>
      )}
      {showBcc && (
        <label>
          Bcc
          <input
            value={bcc}
            disabled={disabled}
            placeholder="name@example.com"
            onChange={(event) => onBcc(event.target.value)}
          />
        </label>
      )}
      {picker && (
        <section className={styles.picker}>
          <label>
            Search client contacts
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email…"
            />
          </label>
          <QueryState
            pending={roster.isPending}
            error={roster.error}
            retry={() => void roster.refetch()}
          />
          {roster.isSuccess &&
            !roster.isFetching &&
            !roster.error &&
            choices.map((item) => (
              <button
                key={item.email}
                type="button"
                className="button ghost"
                disabled={disabled}
                onClick={() => onTo([...to, item])}
              >
                {item.name} · {item.email}
              </button>
            ))}
          {roster.isSuccess && !roster.error && !choices.length && (
            <p className="muted">
              No additional matching contacts with a valid email.
            </p>
          )}
        </section>
      )}
      <small>
        From your connected mailbox (Settings → Personal). Separate copied
        addresses with commas; up to 10 per field.
      </small>
    </section>
  );
}
