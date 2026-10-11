"use client";
import { useState } from "react";
import { TextareaField } from "@/shared/ui/TextareaField";
import { initials } from "@/features/portfolio/public";
import { useIdentity } from "@/shared/auth/identity";
import {
  memberNoteInputSchema,
  type MemberReference,
  type MemberNoteReceipt,
} from "./contracts";
import { useMemberNote } from "./useMemberNote";
import styles from "./member-notes.module.css";

type Props = {
  member: MemberReference;
  onSaved?: (receipt: MemberNoteReceipt) => void;
  onChangeMember?: () => void;
};

export function MemberNoteForm(props: Props) {
  const identity = useIdentity();
  // Actual scope changes start a fresh draft. Role/invalidation changes retain
  // the same session, including any unknown completion freeze.
  return (
    <NoteSession
      key={`${identity.data?.tenant?.id}:${identity.data?.user.id}:${props.member.id}`}
      {...props}
    />
  );
}

function NoteSession({ member, onSaved, onChangeMember }: Props) {
  const [text, setText] = useState("");
  const [validation, setValidation] = useState("");
  const state = useMemberNote(member, onSaved);
  const locked =
    state.mutation.isPending || state.uncertain || Boolean(state.receipt);
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = memberNoteInputSchema.safeParse({
          body: text,
          directoryContactName: member.name,
        });
        if (!parsed.success) {
          setValidation(parsed.error.issues[0]?.message ?? "Review this note.");
          return;
        }
        setValidation("");
        state.mutation.mutate(parsed.data.body);
      }}
    >
      <div className={styles.field}>
        <span className={styles.label}>Member</span>
        <div className={styles.selected}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(member.name)}
          </span>
          <strong>{member.name}</strong>
          {onChangeMember && (
            <button
              type="button"
              className={styles.change}
              disabled={locked}
              onClick={onChangeMember}
            >
              Change member
            </button>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.label}>What kind of log</span>
        <div className={styles.kinds} aria-label="Member log type">
          <span className={styles.active}>Note</span>
          {["Call", "Meeting", "Email", "Commitment"].map((kind) => (
            <button
              type="button"
              key={kind}
              disabled
              title="This member log type needs a supported persistence contract."
            >
              {kind}
            </button>
          ))}
        </div>
        <small>Files to: Directory note on {member.name}.</small>
      </div>
      <TextareaField
        label="What happened"
        hint="Shared with users in your tenant who can access Directory notes."
        placeholder="What was said, what was asked, what was promised…"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={4000}
        required
        disabled={locked || !state.canWrite}
        rows={4}
      />
      <div className={styles.context}>
        <span className={styles.label}>Saved time</span>
        <p>The service records the time when the note is saved.</p>
        <p>
          Staff selection, event time, client association, objective linking and
          Planner follow-up are unavailable for member notes.
        </p>
      </div>
      {state.checkingIdentity ? (
        <p role="status">Checking your session…</p>
      ) : state.identityError ? (
        <div role="alert" className="status error">
          <p>{state.identityError.message}</p>
          <button
            type="button"
            className="button"
            onClick={state.retryIdentity}
          >
            Retry session
          </button>
        </div>
      ) : !state.canWrite && !locked ? (
        <p role="status">
          Your current session cannot save this note. Reopen Quick log after
          checking your account.
        </p>
      ) : null}
      {validation && <p role="alert">{validation}</p>}
      {state.mutation.error && (
        <p role="alert" className="status error">
          {state.mutation.error.message}
        </p>
      )}
      {state.uncertain && (
        <p role="alert" className="status error">
          The save result is uncertain. Check this member’s Directory notes
          before saving again. This form will not resend the request.
        </p>
      )}
      {state.receipt && (
        <p role="status">
          Note saved to Directory. Recorded{" "}
          {new Date(state.receipt.createdAt).toLocaleString()}.
        </p>
      )}
      <footer className={styles.footer}>
        <small>{text.length}/4000</small>
        <button
          className="button primary"
          disabled={!state.canWrite || locked || !text.trim()}
        >
          {state.mutation.isPending
            ? "Saving…"
            : state.receipt
              ? "Saved"
              : "Log it"}
        </button>
      </footer>
    </form>
  );
}
