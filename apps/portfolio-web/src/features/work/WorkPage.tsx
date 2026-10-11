"use client";
import type { Destinations } from "@/shared/config/config";
import { Temporal } from "temporal-polyfill";
import { QueryState } from "@/shared/ui/QueryState";
import { useStrategies, useStrategyDetails } from "./queries";
import { workProjection } from "./contracts";
import { WorkspaceDocuments } from "./WorkspaceDocuments";
import styles from "./work.module.css";
export function WorkPage({
  clientId,
  destinations,
}: {
  clientId: string;
  destinations: Destinations;
}) {
  const summaries = useStrategies(clientId);
  const queries = useStrategyDetails((summaries.data ?? []).map((s) => s.id));
  const details = queries.flatMap((query) => (query.data ? [query.data] : []));
  const complete =
    summaries.isSuccess && queries.every((query) => query.isSuccess);
  const projection = workProjection(
    details,
    Temporal.Now.plainDateISO().toString(),
  );
  const base = destinations.existingApp;
  const strategyLink = (id: string, nodeId?: string) =>
    `${base}/strategies/${id}${nodeId ? `?step=${nodeId}` : ""}`;
  return (
    <div className="page stack">
      <header className="row between">
        <h1>Client work</h1>
        {base && (
          <div className={styles.actions}>
            <span className={styles.source}>Source of truth: Strategies</span>
            <a
              className="button"
              href={`${base}/strategies?clientId=${encodeURIComponent(clientId)}`}
            >
              Open Strategies
            </a>
            <a
              className="button primary"
              href={`${base}/strategies/new?clientId=${encodeURIComponent(clientId)}`}
            >
              New strategy
            </a>
          </div>
        )}
      </header>
      <section className={styles.pulse} aria-label="Client strategy portfolio">
        <h2>Client strategy portfolio</h2>
        {[
          ["Current strategies", summaries.data?.length],
          [
            "Active / in progress",
            complete ? projection.live.length : undefined,
          ],
          ["Next 30 days", complete ? projection.upcoming.length : undefined],
          ["Open risks", complete ? projection.risks.length : undefined],
          ["Linked artifacts", complete ? projection.artifacts : undefined],
        ].map(([label, count]) => (
          <div key={label}>
            <strong>{count ?? "—"}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <WorkspaceDocuments clientId={clientId} destinations={destinations} />
      <QueryState
        pending={summaries.isPending || queries.some((q) => q.isPending)}
        error={summaries.error ?? queries.find((q) => q.error)?.error}
        retry={() => {
          void summaries.refetch();
          queries.forEach((query) => void query.refetch());
        }}
      />
      <div className={styles.columns}>
        <section className="stack" aria-label="Strategies">
          {details.map((strategy) => (
            <article key={strategy.id} className="card stack">
              <p className="eyebrow">
                {strategy.type}
                {strategy.draftedByMeri && " · Drafted with Meri"}
              </p>
              <header className="row between">
                <h2>{strategy.title}</h2>
                {base && (
                  <a href={strategyLink(strategy.id)}>Open strategy ↗</a>
                )}
              </header>
              <p className="muted">{strategy.goal ?? "No goal provided."}</p>
              <small>
                Target {strategy.targetDate?.slice(0, 10) ?? "not set"}
              </small>
              <h3>Next strategy nodes</h3>
              {strategy.nodes
                .filter((n) => n.status !== "completed")
                .slice(0, 5)
                .map((node) => (
                  <div className="row between" key={node.id}>
                    <span>{node.title}</span>
                    <span className="chip">
                      {node.status.replaceAll("_", " ")}
                    </span>
                    <small>{node.startsOn.slice(0, 10)}</small>
                    {base && (
                      <a href={strategyLink(strategy.id, node.id)}>
                        Open step ↗
                      </a>
                    )}
                  </div>
                ))}
            </article>
          ))}
          {summaries.data?.length === 0 && (
            <p className="empty">No current strategies for this client.</p>
          )}
        </section>
        <aside className="stack">
          <section className="card stack">
            <h2>Upcoming work</h2>
            <small>
              Active and in-progress nodes starting in the next 30 days.
            </small>
            {projection.upcoming.map((node) => (
              <div className="stack" key={node.id}>
                <strong>{node.title}</strong>
                <small>
                  {node.startsOn.slice(0, 10)} · {node.strategyTitle}
                </small>
                {base && (
                  <a href={strategyLink(node.strategyId, node.id)}>
                    Open step ↗
                  </a>
                )}
              </div>
            ))}
            {complete && projection.upcoming.length === 0 && (
              <p className="muted">No dated work in this range.</p>
            )}
          </section>
          <section className="card stack">
            <h2>Risks &amp; blockers</h2>
            {projection.risks.map((node) => (
              <article key={node.id} className={styles.risk}>
                <strong>{node.title}</strong>
                <p>{node.note}</p>
                <small>
                  {node.openEnded ? "Ongoing" : node.startsOn.slice(0, 10)}
                </small>
                {base && (
                  <p>
                    <a href={strategyLink(node.strategyId, node.id)}>
                      Open risk ↗
                    </a>
                  </p>
                )}
              </article>
            ))}
            {complete && projection.risks.length === 0 && (
              <p className="muted">No open risks.</p>
            )}
          </section>
        </aside>
      </div>
      {!base && (
        <p className="muted">
          Configure the existing application destination to open Strategies and
          Workspace.
        </p>
      )}
    </div>
  );
}
