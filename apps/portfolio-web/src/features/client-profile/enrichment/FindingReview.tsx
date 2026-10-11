"use client";
import { useState } from "react";
import { useMatters } from "@/features/advocacy/public";
import { QueryState } from "@/shared/ui/QueryState";
import {
  canSelectFinding,
  safeEvidenceUrl,
  type Finding,
  type JsonValue,
} from "./contracts";
import type { ReviewAction } from "./actions";
import styles from "./enrichment.module.css";
export function FindingValue({ value }: { value: JsonValue }) {
  if (value === null) return <span className="muted">None</span>;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul className={styles.valueList}>
        {value.map((item, i) => (
          <li key={i}>
            <FindingValue value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span className="muted">Empty list</span>
    );
  return (
    <dl className={styles.valueObject}>
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            <FindingValue value={item} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
function ComparisonValue({ value }: { value: JsonValue }) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.title === "string"
  )
    return (
      <>
        <p>{value.title}</p>
        <details>
          <summary>Saved details</summary>
          <FindingValue value={value} />
        </details>
      </>
    );
  return <FindingValue value={value} />;
}
function MatterChoice({
  clientId,
  onAssign,
  disabled,
}: {
  clientId: string;
  onAssign: (
    target: { matterId: string } | { newMatter: { title: string } },
  ) => void;
  disabled: boolean;
}) {
  const query = useMatters(clientId);
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const valid =
    id === "new"
      ? Boolean(title.trim()) && title.length <= 300
      : query.data?.some((m) => m.id === id);
  return (
    <div className={styles.reviewControls}>
      <p>
        Applying to a matter saves this finding immediately. It is separate from
        the selected-findings action.
      </p>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {!query.error && query.data && (
        <>
          <label className="stack">
            Matter
            <select
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={disabled || query.isFetching}
            >
              <option value="">Choose a matter</option>
              {query.data.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
              <option value="new">Create new matter</option>
            </select>
          </label>
          {id === "new" && (
            <label className="stack">
              New matter title
              <input
                value={title}
                maxLength={300}
                onChange={(e) => setTitle(e.target.value)}
                disabled={disabled}
              />
            </label>
          )}
          <button
            className="button primary"
            disabled={disabled || !valid || query.isFetching}
            onClick={() => {
              if (valid)
                onAssign(
                  id === "new"
                    ? { newMatter: { title: title.trim() } }
                    : { matterId: id },
                );
            }}
          >
            Apply finding to matter
          </button>
        </>
      )}
    </div>
  );
}
export function FindingReview({
  clientId,
  finding,
  checked,
  onSelect,
  onAction,
  editable,
  busy,
}: {
  clientId: string;
  finding: Finding;
  checked: boolean;
  onSelect: (checked: boolean) => void;
  onAction: (action: ReviewAction) => void;
  editable: boolean;
  busy: boolean;
}) {
  const [panel, setPanel] = useState<"ignore" | "matter">();
  const [reason, setReason] = useState("");
  const selectable = canSelectFinding(finding);
  return (
    <article
      className={styles.finding}
      aria-label={`Finding ${finding.targetKey}`}
    >
      <header className={styles.findingHeader}>
        <label>
          <input
            type="checkbox"
            checked={checked}
            disabled={!editable || busy || !selectable}
            onChange={(e) => onSelect(e.target.checked)}
          />
          <strong>{finding.targetKey}</strong>
        </label>
        <span className={styles.badge}>{finding.status}</span>
        {finding.status === "pending" && (
          <button
            className="button ghost"
            disabled={!editable || busy}
            onClick={() => setPanel(panel === "ignore" ? undefined : "ignore")}
          >
            Ignore
          </button>
        )}
        {finding.status === "rejected" && (
          <button
            className="button ghost"
            disabled={!editable || busy}
            onClick={() => onAction({ kind: "restore", findingId: finding.id })}
          >
            Restore
          </button>
        )}
      </header>
      <div className={styles.comparison}>
        <div>
          <h4>Current</h4>
          <ComparisonValue value={finding.currentValue} />
        </div>
        <div>
          <h4>Proposed</h4>
          <ComparisonValue value={finding.proposedValue} />
        </div>
      </div>
      <details className={styles.evidence}>
        <summary>
          {finding.factKind} · {finding.source} · source evidence (
          {finding.evidence.length})
        </summary>
        <p>
          Service confidence: {finding.confidence}. This is a source assessment,
          not a guarantee.
        </p>
        {finding.evidence.map((e, i) => {
          const url = safeEvidenceUrl(e.url);
          return (
            <blockquote key={i}>
              <p>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    {e.label}
                  </a>
                ) : (
                  e.label
                )}
              </p>
              {e.excerpt && <p>{e.excerpt}</p>}
              {e.source && <cite>{e.source}</cite>}
              {e.metadata && (
                <details>
                  <summary>Source metadata</summary>
                  <FindingValue value={e.metadata} />
                </details>
              )}
              {e.observedAt && (
                <p>
                  Observed: <time dateTime={e.observedAt}>{e.observedAt}</time>
                </p>
              )}
            </blockquote>
          );
        })}
      </details>
      {finding.rejectionReason && (
        <p className="muted">Ignored: {finding.rejectionReason}</p>
      )}
      {finding.status === "pending" && !selectable && (
        <p className="muted">
          This finding has no supported apply operation in this review.
        </p>
      )}
      {panel === "ignore" && finding.status === "pending" && (
        <div className={styles.reviewControls}>
          <label className="stack">
            Reason (optional)
            <textarea
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy || !editable}
            />
          </label>
          <button
            className="button"
            disabled={busy || !editable}
            onClick={() =>
              onAction({ kind: "reject", findingId: finding.id, reason })
            }
          >
            Confirm ignore
          </button>
        </div>
      )}
      {finding.kind === "advocacy_record" && finding.status === "pending" && (
        <>
          <button
            className="button ghost"
            disabled={!editable || busy}
            onClick={() => setPanel(panel === "matter" ? undefined : "matter")}
          >
            Choose matter
          </button>
          {panel === "matter" && (
            <MatterChoice
              clientId={clientId}
              disabled={!editable || busy}
              onAssign={(target) =>
                onAction({ kind: "assign", findingId: finding.id, target })
              }
            />
          )}
        </>
      )}
    </article>
  );
}
