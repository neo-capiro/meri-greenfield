"use client";
import { QueryState } from "@/shared/ui/QueryState";
import type { TrackerBackend } from "@/shared/config/config";
import {
  billDate,
  hearingHref,
  mentionTime,
  type BillHearing,
} from "./hearings";
import styles from "./bill-updates.module.css";
import { useBillHearings } from "./queries";

export function BillHearings({
  clientId,
  billId,
  backend,
  existingApp,
}: {
  clientId: string;
  billId: string;
  backend: TrackerBackend;
  existingApp?: string;
}) {
  const query = useBillHearings(clientId, billId, backend);
  return (
    <section className={styles.section} aria-label="Discussed in hearings">
      <h3>Discussed in hearings</h3>
      {backend !== "intelligence" ? (
        <p className="muted">
          Hearing links are not enabled for this workspace.
        </p>
      ) : (
        <>
          {query.isPending && <p role="status">Loading hearings…</p>}
          <QueryState error={query.error} retry={() => void query.refetch()} />
          {!query.error &&
            query.data &&
            (query.data.hearings.length === 0 ? (
              <p className="muted">No hearings have discussed this bill yet.</p>
            ) : (
              query.data.hearings.map((hearing) => (
                <HearingRow
                  key={hearing.sessionId}
                  hearing={hearing}
                  existingApp={existingApp}
                />
              ))
            ))}
        </>
      )}
    </section>
  );
}
function HearingRow({
  hearing,
  existingApp,
}: {
  hearing: BillHearing;
  existingApp?: string;
}) {
  const href = hearingHref(existingApp, hearing.hearingId);
  const date = billDate(hearing.occurredAt);
  return (
    <article className={styles.hearing}>
      <header className="row between">
        {href ? (
          <a href={href}>{hearing.title ?? "Hearing"} →</a>
        ) : (
          <strong>{hearing.title ?? "Hearing"}</strong>
        )}
        {date && <time dateTime={hearing.occurredAt ?? undefined}>{date}</time>}
      </header>
      {!href && (
        <small className="muted">
          {!hearing.hearingId
            ? "Full hearing record is unavailable."
            : "Hearing detail is unavailable in this environment."}
        </small>
      )}
      {hearing.mentions.slice(0, 3).map((mention, index) => (
        <Mention
          key={`${mention.segmentId ?? "mention"}-${index}`}
          mention={mention}
        />
      ))}
      {hearing.mentions.length > 3 && (
        <details>
          <summary>{hearing.mentions.length - 3} more mentions</summary>
          {hearing.mentions.slice(3).map((mention, index) => (
            <Mention
              key={`${mention.segmentId ?? "mention"}-${index}`}
              mention={mention}
            />
          ))}
        </details>
      )}
      {hearing.mentions.length === 0 && (
        <small className="muted">No mention excerpt is available.</small>
      )}
    </article>
  );
}
function Mention({ mention }: { mention: BillHearing["mentions"][number] }) {
  return (
    <div className={styles.mention}>
      <p>
        {mention.timestampMs !== null && (
          <span className="mono">{mentionTime(mention.timestampMs)} </span>
        )}
        {mention.speakerName && <strong>{mention.speakerName}: </strong>}
        {mention.quote ? (
          <q>{mention.quote}</q>
        ) : (
          <span>
            {mention.quoteSource === "encrypted"
              ? "Quote unavailable (encrypted)."
              : "No quote is available."}
          </span>
        )}
      </p>
      {mention.quoteSource && mention.quoteSource !== "encrypted" && (
        <small>Quote source: {mention.quoteSource}</small>
      )}
      {mention.issueTags.length > 0 && (
        <div className="row">
          {mention.issueTags.map((tag, index) => (
            <span key={`${tag}-${index}`} className="chip">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
