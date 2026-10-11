"use client";
import { useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { QueryState } from "@/shared/ui/QueryState";
import { useTargetDirectory } from "./directory-queries";
import { useTargetMutation } from "./target-queries";
import type { DirectoryKind } from "./directory-contracts";
import type { GovernmentTarget } from "./target-contracts";
import styles from "./targets.module.css";
const names = {
  congress: "Members",
  staff: "Congressional staff",
  state: "State legislators",
  committee: "Committee staff",
};
export function DirectoryResults({
  kind,
  query,
  clientId,
  targets,
  committeeId,
}: {
  kind: DirectoryKind;
  query: string;
  clientId: string;
  targets: GovernmentTarget[];
  committeeId?: string;
}) {
  const [page, setPage] = useState(1);
  const results = useTargetDirectory(kind, query, page, committeeId);
  const add = useTargetMutation(clientId);
  const busy =
    useIsMutating({ mutationKey: ["client-target-write", clientId] }) > 0;
  return (
    <section className="stack" aria-label={names[kind]}>
      <h3>{names[kind]}</h3>
      <QueryState
        pending={results.isFetching}
        error={results.error}
        retry={() => void results.refetch()}
      />
      <QueryState error={add.error} />
      {results.data && (
        <>
          {results.data.rows.map((row) => (
            <article className={styles.result} key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <p className="muted">
                  {row.title} · {row.meta}
                </p>
                {row.current !== undefined && (
                  <small>
                    {row.current ? "Current position" : "Former position"}
                  </small>
                )}
              </div>
              {targets.some((target) => target.memberId === row.id) ? (
                <span className="chip">Added</span>
              ) : (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    add.mutate({
                      kind: "add",
                      memberId: row.id,
                      sourceDirectory: row.directory,
                      source: "manual",
                    })
                  }
                >
                  Add <span className="srOnly">{row.name}</span>
                </button>
              )}
            </article>
          ))}
          {results.data.rows.length === 0 && (
            <p className="empty">No matches in this directory.</p>
          )}
          <div className="row between">
            <small>
              Page {results.data.page} · {results.data.total} records
            </small>
            <div className="row">
              <button
                className="button"
                disabled={page === 1 || results.isFetching || busy}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <button
                className="button"
                disabled={
                  results.isFetching ||
                  busy ||
                  results.data.page * results.data.pageSize >=
                    results.data.total
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
