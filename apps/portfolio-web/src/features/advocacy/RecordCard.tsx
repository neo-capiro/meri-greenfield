import type { AdvocacyRecord } from "./contracts";
import { advocacySourceUrl } from "./source";
import styles from "./advocacy.module.css";

export function RecordCard({
  record,
  canEdit,
  onCorrect,
}: {
  record: AdvocacyRecord;
  canEdit: boolean;
  onCorrect: (kind: "reassign" | "detach" | "not-advocacy") => void;
}) {
  const sourceUrl = advocacySourceUrl(record);
  return (
    <article className={styles.record}>
      <header className="row between">
        <strong>{record.title}</strong>
        <span className="chip">
          {record.evidenceClass.replaceAll("_", " ")}
        </span>
      </header>
      <small>
        {record.activityDate ? (
          <time dateTime={record.activityDate} title={record.activityDate}>
            {new Date(record.activityDate).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}{" "}
            UTC
          </time>
        ) : (
          "Date not supplied"
        )}{" "}
        · {record.recordType.replaceAll("_", " ")}
        {record.status ? ` · ${record.status.replaceAll("_", " ")}` : ""}
        {" · "}
        {new Intl.NumberFormat(undefined, {
          style: "percent",
          maximumFractionDigits: 1,
        }).format(record.confidence)}{" "}
        confidence
      </small>
      {record.summary && <p>{record.summary}</p>}
      {record.outcome && (
        <p>
          <strong>Outcome:</strong> {record.outcome}
        </p>
      )}
      <small>
        Source: {record.sourceType}
        {record.sourceId ? ` · ${record.sourceId}` : ""}
        {record.matterLocked === true ? " · Assignment locked" : ""}
      </small>
      {record.metadata?.presentation?.sourceTitle && (
        <small>
          Original source title: {record.metadata.presentation.sourceTitle}
        </small>
      )}
      {record.metadata?.presentation?.sourceStatus && (
        <small>
          Original source status: {record.metadata.presentation.sourceStatus}
        </small>
      )}
      {sourceUrl ? (
        <a
          className="button ghost"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View source ↗
        </a>
      ) : (
        <small>Source link unavailable.</small>
      )}
      {canEdit && (
        <nav
          className={styles.recordActions}
          aria-label={`Correct ${record.title}`}
        >
          <button
            className="button ghost"
            onClick={() => onCorrect("reassign")}
          >
            Reassign
          </button>
          <button className="button ghost" onClick={() => onCorrect("detach")}>
            Detach
          </button>
          <button
            className="button ghost"
            onClick={() => onCorrect("not-advocacy")}
          >
            Not advocacy
          </button>
        </nav>
      )}
    </article>
  );
}
