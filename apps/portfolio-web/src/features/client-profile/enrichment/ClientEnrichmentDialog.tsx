"use client";
import { useState, type ComponentProps } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { UploadDialog } from "@/features/files/public";
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
import { RunLedger } from "./RunLedger";
import styles from "./enrichment.module.css";
export function ClientEnrichmentDialog({
  clientId,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
}) {
  const access = useEnrichmentAccess();
  return (
    <ClientEnrichmentReview
      key={`${clientId}:${access.identity.data?.tenant?.id}:${access.identity.data?.user.id}`}
      clientId={clientId}
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      access={access}
    />
  );
}
function ClientEnrichmentReview({
  clientId,
  open,
  onOpenChange,
  access,
  onCloseAutoFocus,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  access: ReturnType<typeof useEnrichmentAccess>;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
}) {
  const { identity, canRead, canEdit } = access;
  const latest = useLatestReview(clientId, open && canRead);
  const setup = useEnrichmentSetup(clientId, open && canRead);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{
    run: FillRun;
    action: ReviewAction;
  }>();
  const [showSetup, setShowSetup] = useState(false);
  const [upload, setUpload] = useState<{ beforeDispatch: () => void }>();
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
      onCloseAutoFocus={onCloseAutoFocus}
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
                disabled={!canEdit || busy}
                title="Upload saves a client file immediately; it does not start research."
                onClick={() =>
                  setUpload({ beforeDispatch: action.createUploadGuard() })
                }
              >
                Upload
              </button>
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
            <p className={styles.uploadNotice}>
              Uploading saves a client file immediately. It does not start
              research or add the file to a run.
            </p>
            {upload && canEdit && (
              <UploadDialog
                clientId={clientId}
                beforeDispatch={upload.beforeDispatch}
                onClose={() => setUpload(undefined)}
              />
            )}
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
                <RunLedger
                  run={run}
                  busy={busy}
                  onCancel={() => request({ kind: "cancel" })}
                />
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
                    {run.findings.filter(canSelectFinding).length > 200
                      ? "Select first 200 new"
                      : "Select all new"}
                  </button>
                </header>
                {!run.findings.length && (
                  <p className={styles.empty}>
                    {run.status === "running"
                      ? "Research is still running. Findings will appear as they are saved."
                      : "No findings were saved in this run. This does not establish full source coverage."}
                  </p>
                )}
                {chosen.length > 200 && (
                  <p className={styles.empty} role="alert">
                    Apply up to 200 findings at a time. Deselect findings before
                    continuing.
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
