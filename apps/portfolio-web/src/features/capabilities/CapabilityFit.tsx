"use client";
import { QueryState } from "@/shared/ui/QueryState";
import { useCapabilityFit, useRefreshFit } from "./queries";
import { fitLink } from "./contracts";
export function CapabilityFit({
  clientId,
  existingApp,
}: {
  clientId: string;
  existingApp?: string;
}) {
  const query = useCapabilityFit(clientId);
  const refresh = useRefreshFit(clientId);
  return (
    <section className="card stack">
      <header className="row between">
        <div>
          <p className="eyebrow">Where capabilities create fit</p>
          <h3>
            {query.data
              ? `${query.data.matches.length} fit matches`
              : "Capability fit"}
          </h3>
        </div>
        <button
          className="button"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? "Refreshing…" : "Refresh"}
        </button>
      </header>
      <QueryState
        pending={query.isPending}
        error={query.error ?? refresh.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <>
          <small>
            {query.data.status === "stale"
              ? "Profile changed; refresh these matches. "
              : ""}
            {query.data.computedAt
              ? `Computed ${new Date(query.data.computedAt).toLocaleString()}`
              : "Not computed yet"}
          </small>
          {query.data.matches.map((match) => (
            <article key={match.id} className="stack">
              <div className="row">
                <strong>{match.target}</strong>
                <span className="chip">Fit {match.fit}/100</span>
              </div>
              <p className="muted">{match.why}</p>
              {fitLink(match.href, existingApp) && (
                <a href={fitLink(match.href, existingApp)}>Open target ↗</a>
              )}
            </article>
          ))}
          {query.data.matches.length === 0 && (
            <p>{query.data.emptyReason ?? "No matches available."}</p>
          )}
        </>
      )}
    </section>
  );
}
