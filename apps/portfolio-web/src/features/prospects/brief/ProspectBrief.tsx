"use client";
import { useState } from "react";
import { ApiError } from "@/shared/api/http";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { QueryState } from "@/shared/ui/QueryState";
import { useBrief, useWriteBrief } from "./hooks";
import type { BriefScope, CreateInput } from "./api";
import { BriefViewer } from "./BriefViewer";
import styles from "./brief.module.css";
import { BriefDate } from "./BriefDate";

export function ProspectBrief({ prospectId }: { prospectId: string }) {
  const identity = useIdentity();
  const allowed =
    identity.isSuccess &&
    !identity.error &&
    !identity.isPending &&
    (identity.data?.role === "standard_user" ||
      canAdminister(identity.data?.role));
  const tenantId = identity.data?.tenant?.id;
  return (
    <section
      className={`card ${styles.card}`}
      aria-label="Federal strategy brief"
    >
      <h2>Federal strategy brief</h2>
      <p className="muted">
        A saved, versioned brief from the prospect’s authorized dossier
        evidence.
      </p>
      <QueryState
        pending={identity.isPending}
        error={identity.error}
        retry={() => void identity.refetch()}
      />
      {allowed && tenantId ? (
        <ScopedBrief
          key={`${identity.data?.user.id}:${tenantId}:${prospectId}`}
          scope={{ tenantId, prospectId }}
        />
      ) : (
        !identity.isPending &&
        !identity.error && (
          <p role="note">
            An authorized firm member and account are required to read or change
            prospect briefs.
          </p>
        )
      )}
    </section>
  );
}
function ScopedBrief({ scope }: { scope: BriefScope }) {
  const current = useBrief(scope);
  const create = useWriteBrief(scope);
  const [attempt, setAttempt] = useState<CreateInput>();
  const [open, setOpen] = useState(false);
  const unavailable =
    current.error instanceof ApiError && current.error.status === 404;
  const ambiguous =
    create.isError &&
    (!(create.error instanceof ApiError) || create.error.status >= 500);
  const accessDenied =
    create.error instanceof ApiError &&
    (create.error.status === 401 || create.error.status === 403);
  const result = current.isSuccess ? current.data : undefined;
  return (
    <>
      {unavailable ? (
        <div className="status" role="note">
          <p>
            Briefs are unavailable for this account or prospect. The service
            does not distinguish an unavailable feature from a missing record.
          </p>
          <button className="button" onClick={() => void current.refetch()}>
            Check availability
          </button>
        </div>
      ) : (
        <QueryState
          pending={current.isPending}
          error={current.error}
          retry={() => void current.refetch()}
        />
      )}
      <QueryState error={create.error} />
      {create.isError && (
        <div className="status stack" role="alert">
          <p>
            {ambiguous
              ? "The creation outcome is not confirmed. Check saved status or explicitly retry the same request; no automatic re-generation is performed."
              : "Creation was rejected. Review the error and check saved status before retrying."}
          </p>
          <div className="row">
            <button className="button" onClick={() => void current.refetch()}>
              Check saved status
            </button>
            {attempt && !accessDenied && (
              <button
                className="button"
                disabled={create.isPending}
                onClick={() => create.mutate(attempt)}
              >
                Retry same creation request
              </button>
            )}
          </div>
        </div>
      )}
      {result?.brief ? (
        <div className={styles.saved}>
          <div>
            <strong>{result.brief.title}</strong>
            <small>
              {result.brief.status} ·{" "}
              {result.currentVersion ? (
                <>
                  Version {result.currentVersion.versionNumber} · Saved{" "}
                  <BriefDate value={result.currentVersion.createdAt} />
                </>
              ) : (
                "No saved version"
              )}
            </small>
          </div>
          <button className="button" onClick={() => setOpen(true)}>
            Open brief
          </button>
        </div>
      ) : (
        current.isSuccess && <p>No brief has been saved yet.</p>
      )}
      {result &&
        (!result.brief ||
          (result.brief.status === "draft" && !result.currentVersion)) && (
          <button
            className="button primary"
            disabled={create.isPending || create.isError}
            onClick={() => {
              const input = {
                idempotencyKey: `brief-create:${crypto.randomUUID()}`,
              };
              setAttempt(input);
              create.mutate(input);
            }}
          >
            {create.isPending
              ? "Generating and saving…"
              : "Generate from dossier"}
          </button>
        )}
      <small>
        Workspace filing and candidate objectives require separate supported
        workflows.
      </small>
      {open && result?.brief && (
        <BriefViewer
          scope={scope}
          data={result}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
