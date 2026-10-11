import { previewOnlyDependency, sources, type FillRun } from "./contracts";
import { FindingValue } from "./FindingReview";
import styles from "./enrichment.module.css";
const taskNames: Record<string, string> = {
  ...sources,
  client_document: "Client document",
  federal_market: "Federal Market",
  facility_resolution: "Facilities",
  district_nexus: "District Nexus",
  advocacy_history: "Advocacy History",
  lifecycle_outcomes: "Lifecycle Outcomes",
  reconciliation: "Reconciliation",
  completion_audit: "Profile Completion",
};
export function RunLedger({
  run,
  busy,
  onCancel,
}: {
  run: FillRun;
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <section className={styles.ledger} aria-label="Task ledger">
      <div className="row between">
        <h3>{run.stage?.replaceAll("_", " ") ?? run.status}</h3>
        <span className={styles.badge}>{run.status}</span>
      </div>
      <p className="muted">
        Started{" "}
        <time dateTime={run.startedAt} title={run.startedAt}>
          {new Date(run.startedAt).toLocaleString()}
        </time>
      </p>
      {run.error && <p role="alert">{run.error}</p>}
      {run.tasks?.map((task) => (
        <div className={styles.task} key={task.id}>
          <span aria-hidden="true">
            {task.status === "completed"
              ? "✓"
              : task.status === "running"
                ? "●"
                : "○"}
          </span>
          <div>
            {taskNames[task.taskType] ?? task.taskType}
            <small>
              Attempt {task.attempt} of {task.maxAttempts}
              {task.errorMessage ? ` · ${task.errorMessage}` : ""}
            </small>
          </div>
          <span>{task.status}</span>
          {task.status === "failed" && (
            <button className="button" disabled title={previewOnlyDependency}>
              Retry unavailable
            </button>
          )}
        </div>
      ))}
      {!run.tasks?.length && (
        <p className="muted">
          This saved run has no task ledger. Source outcomes remain available
          below.
        </p>
      )}
      <details>
        <summary>Saved scope and source outcomes</summary>
        <p>
          Sources:{" "}
          {run.requestedSources.map((s) => taskNames[s] ?? s).join(", ") ||
            "No connected sources"}
        </p>
        <p>
          Documents:{" "}
          {(run.attachmentIds ?? run.setup?.attachmentIds ?? []).length}; saved
          LDA identities:{" "}
          {(run.selectedLdaIds ?? run.setup?.selectedLdaIds ?? []).join(", ") ||
            "None recorded"}
        </p>
        {Object.entries(run.sourceStates).map(([source, state]) => (
          <div key={source}>
            <h4>{taskNames[source] ?? source}</h4>
            <FindingValue value={state} />
          </div>
        ))}
      </details>
      {run.status === "running" && (
        <button className="button" disabled={busy} onClick={onCancel}>
          Cancel run
        </button>
      )}
    </section>
  );
}
