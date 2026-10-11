"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import {
  canSelectFinding,
  previewOnlyDependency,
  type FillRun,
} from "./contracts";
import {
  useEnrichmentAccess,
  useEnrichmentSetup,
  useLatestReview,
} from "./queries";
import { useReviewAction } from "./useReviewAction";
import type { ReviewAction } from "./actions";
import { FindingReview } from "./FindingReview";
import { ResearchSetup } from "./ResearchSetup";
import styles from "./enrichment.module.css";
export function ClientEnrichmentDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { identity, canRead, canEdit } = useEnrichmentAccess();
  const latest = useLatestReview(clientId, open && canRead);
  const setup = useEnrichmentSetup(clientId, open && canRead);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{
    run: FillRun;
    action: ReviewAction;
  }>();
  const [showSetup, setShowSetup] = useState(false);
  const action = useReviewAction(clientId, open, {
    userId: identity.data?.user.id ?? "",
    tenantId: identity.data?.tenant?.id ?? "",
  });
  const run = !latest.error ? latest.data : undefined;
  const chosen =
    run?.findings
      .filter((f) => selected.includes(f.id) && canSelectFinding(f))
      .map((f) => f.id) ?? [];
  const busy =
    action.mutation.isPending || latest.isFetching || action.uncertain;
  const request = (next: ReviewAction) => {
    if (run) setConfirm({ run, action: next });
  };
  return (
    <Dialog
      drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Fill with Meri"
      className={styles.drawer}
    >
      <div className={styles.scroll}>
        <QueryState
          pending={identity.isPending}
          error={identity.error}
          retry={() => void identity.refetch()}
        />
        {!identity.isPending && !identity.error && !canRead && (
          <p role="status">
            Your current session cannot access this client review.
          </p>
        )}
        {canRead && (
          <>
            <div className={styles.sourceBar}>
              <span>{setup.data?.website ?? "Saved client sources"}</span>
              <button
                className="button"
                onClick={() => setShowSetup((v) => !v)}
              >
                Research setup
              </button>
              <button
                className="button primary"
                disabled
                title={previewOnlyDependency}
              >
                Run again
              </button>
            </div>
            <QueryState
              pending={latest.isPending}
              error={latest.error}
              retry={() => void latest.refetch()}
            />
            <QueryState error={action.mutation.error} />
            {action.uncertain && (
              <div role="alert" className="status error">
                The request may have saved changes. Do not repeat it. Refresh
                the saved review to inspect current status; this service has no
                operation receipt for resolving an ambiguous response.
                <button
                  className="button"
                  onClick={() => void latest.refetch()}
                >
                  Refresh saved review
                </button>
              </div>
            )}
            {action.receipt && (
              <p role="status" className="status">
                {action.receipt}
              </p>
            )}
            {(showSetup || (!latest.isPending && !latest.error && !run)) && (
              <>
                <QueryState
                  pending={setup.isPending}
                  error={setup.error}
                  retry={() => void setup.refetch()}
                />
                {setup.data && !setup.error && (
                  <ResearchSetup clientId={clientId} setup={setup.data} />
                )}
              </>
            )}
            {run && (
              <>
                <section className={styles.ledger} aria-label="Task ledger">
                  <div className="row between">
                    <h3>{run.stage ?? run.status}</h3>
                    <span className={styles.badge}>{run.status}</span>
                  </div>
                  <p className="muted">
                    Started{" "}
                    <time dateTime={run.startedAt}>
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
                        {task.taskType}
                        <small>
                          Attempt {task.attempt} of {task.maxAttempts}
                          {task.errorMessage ? ` · ${task.errorMessage}` : ""}
                        </small>
                      </div>
                      <span>{task.status}</span>
                      {task.status === "failed" && (
                        <button
                          className="button"
                          disabled
                          title={previewOnlyDependency}
                        >
                          Retry unavailable
                        </button>
                      )}
                    </div>
                  ))}
                  {!run.tasks?.length && (
                    <p className="muted">
                      This saved run has no task ledger. Source outcomes remain
                      available below.
                    </p>
                  )}
                  <details>
                    <summary>Saved scope and source outcomes</summary>
                    <p>
                      Sources:{" "}
                      {run.requestedSources.join(", ") ||
                        "No connected sources"}
                    </p>
                    <p>
                      Documents:{" "}
                      {
                        (run.attachmentIds ?? run.setup?.attachmentIds ?? [])
                          .length
                      }
                      ; saved LDA identities:{" "}
                      {(
                        run.selectedLdaIds ??
                        run.setup?.selectedLdaIds ??
                        []
                      ).join(", ") || "None recorded"}
                    </p>
                    {Object.entries(run.sourceStates).map(([source, state]) => (
                      <p key={source}>
                        {source}:{" "}
                        {typeof state === "string"
                          ? state
                          : state &&
                              typeof state === "object" &&
                              !Array.isArray(state) &&
                              typeof state.status === "string"
                            ? state.status
                            : "See saved run"}
                      </p>
                    ))}
                  </details>
                  {run.status === "running" && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => request({ kind: "cancel" })}
                    >
                      Cancel run
                    </button>
                  )}
                </section>
                <header className={styles.findingsHead}>
                  <h3>Findings · {run.findings.length}</h3>
                  <button
                    className="button ghost"
                    disabled={!canEdit || busy}
                    onClick={() =>
                      setSelected(
                        run.findings
                          .filter(canSelectFinding)
                          .slice(0, 200)
                          .map((f) => f.id),
                      )
                    }
                  >
                    Select all new
                  </button>
                </header>
                {!run.findings.length && (
                  <p className={styles.empty}>
                    {run.status === "running"
                      ? "Research is still running. Findings will appear as they are saved."
                      : "No findings were saved in this run. This does not establish full source coverage."}
                  </p>
                )}
                {run.findings.map((f) => (
                  <FindingReview
                    key={f.id}
                    clientId={clientId}
                    finding={f}
                    checked={chosen.includes(f.id)}
                    editable={canEdit && !action.uncertain}
                    busy={busy}
                    onSelect={(checked) =>
                      setSelected(
                        checked
                          ? [...selected.filter((id) => id !== f.id), f.id]
                          : selected.filter((id) => id !== f.id),
                      )
                    }
                    onAction={request}
                  />
                ))}
                {confirm && (
                  <section
                    className={styles.confirm}
                    role="region"
                    aria-label="Confirm review action"
                  >
                    <h3>
                      {confirm.action.kind === "apply"
                        ? `Apply ${confirm.action.findingIds.length} selected findings?`
                        : confirm.action.kind === "cancel"
                          ? "Cancel this run?"
                          : confirm.action.kind === "assign"
                            ? "Apply finding and assign matter?"
                            : confirm.action.kind === "reject"
                              ? "Ignore this finding?"
                              : "Restore this finding?"}
                    </h3>
                    <p>
                      {confirm.action.kind === "cancel"
                        ? "Cancellation stops remaining work. It does not undo changes already saved."
                        : "This changes the saved client review immediately. The service rechecks pending findings; a group apply can partially succeed."}
                    </p>
                    <div className="row">
                      <button
                        className="button"
                        disabled={action.mutation.isPending}
                        onClick={() => setConfirm(undefined)}
                      >
                        Back to review
                      </button>
                      <button
                        className="button primary"
                        disabled={
                          busy ||
                          (!canEdit && confirm.action.kind !== "cancel") ||
                          !canRead
                        }
                        onClick={() =>
                          action.mutation.mutate(
                            { review: confirm.run, action: confirm.action },
                            { onSuccess: () => setConfirm(undefined) },
                          )
                        }
                      >
                        Confirm {confirm.action.kind}
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
      <footer className={styles.footer}>
        <span>
          {canEdit
            ? `${chosen.length} selected. Applying saves reviewed findings.`
            : "Applying needs an admin."}
        </span>
        <button className="button" onClick={() => onOpenChange(false)}>
          Close review
        </button>
        <button
          className="button primary"
          disabled={!canEdit || busy || !chosen.length || chosen.length > 200}
          onClick={() => request({ kind: "apply", findingIds: chosen })}
        >
          Apply {chosen.length} selected
        </button>
      </footer>
    </Dialog>
  );
}
