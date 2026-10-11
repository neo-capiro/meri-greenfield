import type { OpportunitySearch } from "./contracts";
import {
  opportunityLink,
  opportunityDate,
  opportunityAmount,
} from "./presentation";
import styles from "./opportunities.module.css";
export function OpportunityResults({
  data,
  clientId,
  base,
}: {
  data: OpportunitySearch;
  clientId: string;
  base?: string;
}) {
  return (
    <>
      {!data.catalogComplete && (
        <p className="status" role="status">
          Some catalogs are incomplete or out of date. Counts describe the
          available results.
        </p>
      )}
      <details className={styles.health}>
        <summary>Source status</summary>
        <ul>
          {data.freshness.map((item) => (
            <li key={item.source}>
              {item.source.replaceAll("_", " ")} ·{" "}
              {item.state.replaceAll("_", " ")}
              {item.lastSyncedAt &&
                ` · last synced ${opportunityDate(item.lastSyncedAt)}`}
            </li>
          ))}
        </ul>
      </details>
      {data.profileGaps?.items.map((gap) => (
        <p className="status" key={`${gap.tag}-${gap.title}`}>
          <strong>{gap.title}</strong>
          <br />
          {gap.body}
        </p>
      ))}
      {data.opportunities.map((item) => (
        <article
          className={styles.item}
          key={`${item.source}:${item.sourceRecordId}`}
        >
          <h3>
            {base ? (
              <a href={opportunityLink(base, clientId, item)}>{item.title}</a>
            ) : (
              item.title
            )}
          </h3>
          <p className="muted">{item.agency ?? "Agency not stated"}</p>
          {item.matchedSignals.length > 0 ? (
            <p className="muted">
              {item.matchedSignals
                .map((signal) => signal.matchedOn)
                .join(" · ")}
            </p>
          ) : (
            <p className="muted">Match explanation not available</p>
          )}
          <p className="muted">
            Eligibility:{" "}
            {item.eligibility?.state.replaceAll("_", " ") ?? "unknown"}
            {item.eligibility?.reason && ` · ${item.eligibility.reason}`}
          </p>
          <div className={styles.meta}>
            <span className="chip">{item.type.replaceAll("_", " ")}</span>
            <strong title="The service does not supply a currency field.">
              {opportunityAmount(item)}
            </strong>
            <small>{opportunityDate(item.deadline)}</small>
            <span className="muted">
              {item.decoration?.workflow.available
                ? (item.decoration.workflow.status ?? "Match")
                : "Workflow unavailable"}
            </span>
          </div>
        </article>
      ))}
      {data.opportunities.length === 0 && (
        <p className="empty">No matching opportunities on this page.</p>
      )}
    </>
  );
}
