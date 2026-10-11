"use client";
import { useState } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import type { CorrectionContext } from "./CorrectionDialog";
import { useAdvocacyTimeline } from "./queries";
import styles from "./advocacy.module.css";
export function UnassignedRecords({
  clientId,
  canEdit,
  onCorrect,
}: {
  clientId: string;
  canEdit: boolean;
  onCorrect: (context: CorrectionContext) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const timeline = useAdvocacyTimeline(clientId, expanded);
  const rows = !timeline.error
    ? timeline.data?.filter(
        (row) => row.kind === "record" && row.matterId === null,
      )
    : undefined;
  return (
    <div className="stack">
      <button
        className="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        Unassigned records
      </button>
      {expanded && (
        <>
          <p className="muted">
            Unassigned records in the latest 500 history entries. Older records
            may be outside this limited view.
          </p>
          <QueryState
            pending={timeline.isPending}
            error={timeline.error}
            retry={() => void timeline.refetch()}
          />
          {rows?.map((row) => (
            <article className={styles.record} key={row.id}>
              <strong>{row.title}</strong>
              <small>{row.subtype.replaceAll("_", " ")} · Unassigned</small>
              {canEdit && (
                <button
                  className="button"
                  onClick={() =>
                    onCorrect({ kind: "reassign", matter: null, record: row })
                  }
                >
                  Reassign record
                </button>
              )}
            </article>
          ))}
          {rows?.length === 0 && (
            <p className="muted">
              No unassigned records returned in this limited history view.
            </p>
          )}
        </>
      )}
    </div>
  );
}
