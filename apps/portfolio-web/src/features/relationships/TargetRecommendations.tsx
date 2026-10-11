"use client";
import { QueryState } from "@/shared/ui/QueryState";
import {
  useTargetRecommendations,
  useRefreshTargetRecommendations,
  useTargetMutation,
} from "./target-queries";
import type { GovernmentTarget } from "./target-contracts";
import styles from "./targets.module.css";
export function TargetRecommendations({
  clientId,
  targets,
}: {
  clientId: string;
  targets: GovernmentTarget[];
}) {
  const query = useTargetRecommendations(clientId);
  const refresh = useRefreshTargetRecommendations(clientId);
  const add = useTargetMutation(clientId);
  return (
    <section className="card stack" aria-label="Suggested government targets">
      <header className="row between">
        <h2>Suggested by Meri</h2>
        <button
          className="button"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? "Refreshing…" : "Refresh recommendations"}
        </button>
      </header>
      <p className="muted">
        Service scores indicate relative priority within this client.
      </p>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      <QueryState error={refresh.error ?? add.error} />
      {query.data?.recommendations.map((row, index) => (
        <article className={styles.result} key={row.memberId}>
          <span>{index + 1}</span>
          <div>
            <strong>{row.office}</strong>
            <p className="muted">
              {[row.party, row.state, row.chamber, row.committee]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <small>
              {row.billCount} tracked bills · score {row.score.toFixed(2)} ·{" "}
              {row.tags.join(", ")}
            </small>
          </div>
          {targets.some((target) => target.memberId === row.memberId) ? (
            <span className="chip">Added</span>
          ) : (
            <button
              className="button"
              disabled={add.isPending}
              onClick={() =>
                add.mutate({
                  kind: "add",
                  memberId: row.memberId,
                  sourceDirectory: "congress",
                  source: "meri",
                })
              }
            >
              Add <span className="srOnly">{row.office}</span>
            </button>
          )}
        </article>
      ))}
      {query.data?.recommendations.length === 0 && (
        <p className="empty">No office recommendations are available yet.</p>
      )}
      {query.data?.computedAt && (
        <small>
          Computed {new Date(query.data.computedAt).toLocaleString()}
        </small>
      )}
    </section>
  );
}
