"use client";
import { useState } from "react";
import { TextareaField } from "@/shared/ui/TextareaField";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useProspectHistory } from "./queries";
import { useProspectNote } from "./mutations";
import styles from "./prospects.module.css";
export function ProspectHistory({ id }: { id: string }) {
  const history = useProspectHistory(id);
  const [kind, setKind] = useState("");
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const save = useProspectNote(id, () => {
    setAdding(false);
    setNote("");
  });
  const rows = (history.data ?? [])
    .filter((item) => !kind || item.kind === kind)
    .toReversed();
  return (
    <section className="card stack">
      <header className="row between">
        <h2>Activity</h2>
        <button className="button" onClick={() => setAdding(true)}>
          + Add note
        </button>
      </header>
      <select
        aria-label="Prospect activity type"
        value={kind}
        onChange={(event) => setKind(event.target.value)}
      >
        <option value="">All activity</option>
        {[...new Set(history.data?.map((item) => item.kind))].map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <QueryState
        pending={history.isPending}
        error={history.error}
        retry={() => void history.refetch()}
      />
      {history.data &&
        (rows.length ? (
          <ol className={styles.history}>
            {rows.map((item) => (
              <li key={item.id}>
                <div className="row between">
                  <span className="chip">{item.kind}</span>
                  <time dateTime={item.createdAt}>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                  </time>
                </div>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">No activity yet.</p>
        ))}
      <Dialog
        open={adding}
        title="Add prospect note"
        description="Saved to this firm's prospect history."
        onOpenChange={(open) => {
          if (!save.isPending) setAdding(open);
        }}
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (note.trim()) save.mutate(note.trim());
          }}
        >
          <TextareaField
            label="Note"
            required
            autoFocus
            maxLength={4000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <QueryState error={save.error} />
          <button
            className="button primary"
            disabled={save.isPending || !note.trim()}
          >
            Save note
          </button>
        </form>
      </Dialog>
    </section>
  );
}
