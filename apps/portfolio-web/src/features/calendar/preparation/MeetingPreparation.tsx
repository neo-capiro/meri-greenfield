"use client";
import { useState } from "react";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { QueryState } from "@/shared/ui/QueryState";
import { TextareaField } from "@/shared/ui/TextareaField";
import type { Meeting } from "../contracts";
import type { Preparation, PrepDepth } from "./schema";
import type { GenerateInput } from "./api";
import {
  activeJob,
  usePreparationCapabilities,
  usePreparationJob,
  useGeneratePreparation,
  useChangePreparationJob,
} from "./hooks";
import { PreparationEditor } from "./PreparationEditor";
import { PreparationSettings } from "./PreparationSettings";
import { PreparationProgress } from "./PreparationProgress";
import { PreparationContent, PreparationSources } from "./PreparationContent";
import { PreparationDocumentActions } from "./PreparationDocumentActions";
import styles from "./preparation.module.css";

export type PreparationMeeting = Pick<
  Meeting,
  "id" | "client" | "status" | "subject" | "attendees"
> & {
  preps: Preparation[];
};
export function MeetingPreparation({
  meeting,
}: {
  meeting: PreparationMeeting;
}) {
  const identity = useIdentity();
  const allowed =
    !identity.error &&
    !identity.isPending &&
    (identity.data?.role === "standard_user" ||
      canAdminister(identity.data?.role));
  return (
    <ScopedPreparation
      key={`${identity.data?.user.id}:${identity.data?.tenant?.id}:${meeting.id}:${meeting.client?.id}`}
      meeting={meeting}
      allowed={allowed}
      identityPending={identity.isPending}
      identityError={identity.error}
      retryIdentity={() => void identity.refetch()}
    />
  );
}
function ScopedPreparation({
  meeting,
  allowed,
  identityPending,
  identityError,
  retryIdentity,
}: {
  meeting: PreparationMeeting;
  allowed: boolean;
  identityPending: boolean;
  identityError: Error | null;
  retryIdentity: () => void;
}) {
  const capabilities = usePreparationCapabilities();
  const comprehensive =
    capabilities.data?.meetingPrepComprehensiveEnabled === true;
  const job = usePreparationJob(
    meeting.id,
    allowed && capabilities.isSuccess && comprehensive,
  );
  const generate = useGeneratePreparation(
    meeting.id,
    meeting.client?.id ?? null,
  );
  const change = useChangePreparationJob(meeting.id);
  const [focus, setFocus] = useState("");
  const [depth, setDepth] = useState<PrepDepth>("standard");
  const [request, setRequest] = useState<GenerateInput>();
  const [editing, setEditing] = useState<Preparation>();
  const [settings, setSettings] = useState(false);
  const [sources, setSources] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const prep = meeting.preps[0];
  const institutional =
    prep?.generatedFrom?.schemaVersion ===
    "research_portfolio_institutional_v1";
  function updateJob(action: "cancel" | "resume") {
    const currentJob = job.data;
    if (!currentJob || !allowed || institutional || change.isPending) return;
    if (action === "resume") setProgressOpen(true);
    change.mutate({ jobId: currentJob.jobId, action });
  }
  const active = activeJob(job.data);
  const busy = active || generate.isPending || change.isPending;
  const cancelled = ["cancelled", "canceled", "deleted"].includes(
    meeting.status.toLowerCase(),
  );
  const canGenerate =
    allowed &&
    !institutional &&
    !cancelled &&
    !busy &&
    capabilities.isSuccess &&
    capabilities.data.runtime?.externalActionsEnabled === true &&
    (!comprehensive || job.isSuccess) &&
    !generate.isError;
  function begin() {
    if (!canGenerate || focus.length > 4000) return;
    const input: GenerateInput = {
      requestKey: crypto.randomUUID(),
      depth,
      additionalContext: focus,
    };
    setRequest(input);
    setSettings(false);
    setProgressOpen(true);
    generate.mutate(input);
  }
  async function refresh() {
    await Promise.all([job.refresh(), capabilities.refetch()]);
  }
  return (
    <section className={styles.panel} aria-label="Meeting preparation">
      <div className="row between">
        <span className="chip">{prep?.status ?? "Not started"}</span>
        <small>
          {prep?.sharedAt === undefined
            ? ""
            : prep.sharedAt
              ? "Shared preparation"
              : "Private until shared"}
        </small>
      </div>
      <QueryState
        pending={identityPending || capabilities.isPending}
        error={identityError ?? capabilities.error}
        retry={
          identityError ? retryIdentity : () => void capabilities.refetch()
        }
      />
      {!identityPending && !allowed && (
        <p role="note">Your role does not allow preparation changes.</p>
      )}
      {institutional && (
        <p role="note">
          This institutional preparation uses its originating Research Portfolio
          review workflow. Review state:{" "}
          {prep.generatedFrom?.reviewStatus ?? "Unavailable"}.
        </p>
      )}
      {cancelled && (
        <p role="note">
          This meeting is cancelled. Its saved preparation remains available.
        </p>
      )}
      {capabilities.isSuccess &&
        capabilities.data.runtime?.externalActionsEnabled !== true && (
          <p role="note">
            Preparation generation is unavailable in this environment.
          </p>
        )}
      {comprehensive && (
        <QueryState
          pending={job.isPending && allowed}
          error={job.error}
          retry={() => void job.refetch()}
        />
      )}
      <div className={styles.actions}>
        {allowed && !institutional && (
          <button className="button" disabled={!canGenerate} onClick={begin}>
            {prep ? "Regenerate" : "Generate with Meri"}
          </button>
        )}
        {allowed && !institutional && prep && (
          <button
            className="button"
            disabled={busy}
            onClick={() => setEditing(prep)}
          >
            Edit prep
          </button>
        )}
        {allowed && !institutional && (
          <button
            className="button"
            disabled={busy || !capabilities.isSuccess || generate.isError}
            onClick={() => setSettings(true)}
          >
            Prep settings
          </button>
        )}
      </div>
      {allowed && !institutional && (
        <TextareaField
          label="Refine preparation"
          placeholder="Add context for Meri to use when regenerating…"
          value={focus}
          maxLength={4000}
          rows={2}
          disabled={busy || generate.isError}
          onChange={(event) => setFocus(event.target.value)}
          hint={`${focus.length}/4000 characters`}
        />
      )}
      {generate.isPending && (
        <div className={styles.progress} role="status">
          <h3>Preparing your briefing</h3>
          <p>Meri is reading the meeting’s evidence.</p>
          <p>
            {comprehensive
              ? "Waiting for the saved job receipt. Progress will be recovered from the service."
              : "Waiting for the preparation response. Keep this page open to receive the result."}
          </p>
        </div>
      )}
      {job.data && (
        <div
          className={styles.progress}
          role={job.data.status === "failed" ? "alert" : "status"}
        >
          <h3>
            {active
              ? "Preparing your briefing"
              : job.data.status === "failed"
                ? "Preparation could not finish"
                : job.data.status === "cancelled"
                  ? "Preparation cancelled"
                  : "Preparation completed"}
          </h3>
          {active ? (
            <>
              <p>Current stage: {job.data.stage.replaceAll("_", " ")}</p>
              <p>
                Progress is saved. You can close this page while preparation
                runs.
              </p>
              <button
                className="button"
                disabled={!allowed || institutional || change.isPending}
                onClick={() => updateJob("cancel")}
              >
                Cancel preparation
              </button>
            </>
          ) : job.data.status === "failed" ? (
            <>
              <p>
                Your previous briefing is unchanged. Adjust the focus for a new
                run or resume the saved run.
              </p>
              {job.data.errorCode && <code>{job.data.errorCode}</code>}
              {allowed &&
                !institutional &&
                job.data.errorCode !== "PREP_BUDGET_EXHAUSTED" && (
                  <div>
                    <button
                      className="button"
                      disabled={
                        change.isPending ||
                        generate.isPending ||
                        cancelled ||
                        capabilities.data?.runtime?.externalActionsEnabled !==
                          true
                      }
                      onClick={() => updateJob("resume")}
                    >
                      Resume preparation
                    </button>
                  </div>
                )}
            </>
          ) : job.data.status === "cancelled" ? (
            <p>Your previous briefing is unchanged.</p>
          ) : job.data.prepId && prep?.id === job.data.prepId ? (
            <p>The saved briefing is ready to use.</p>
          ) : (
            <>
              <p>
                {job.data.prepId
                  ? "The new preparation is saved, but it has not loaded yet."
                  : "The service reported completion without a saved preparation reference."}
              </p>
              <button className="button" onClick={() => void refresh()}>
                Check preparation status
              </button>
            </>
          )}
        </div>
      )}
      <QueryState error={change.error} />
      {change.isError && (
        <button className="button" onClick={() => void job.refetch()}>
          Check preparation status
        </button>
      )}
      <QueryState error={generate.error} />
      {generate.isError && (
        <div className={styles.progress}>
          <p>
            The request outcome is not confirmed. Check saved status before
            continuing.
          </p>
          <button className="button" onClick={() => void refresh()}>
            Check preparation status
          </button>
          {comprehensive && request && job.isSuccess && !active && (
            <button
              className="button"
              disabled={
                !allowed || institutional || cancelled || generate.isPending
              }
              onClick={() => {
                if (allowed && !institutional && !cancelled)
                  generate.mutate(request);
              }}
            >
              Retry same preparation request
            </button>
          )}
          {!comprehensive && (
            <p>
              Automatic resubmission is unavailable for this preparation
              service. Reopen the meeting to check for saved content before
              starting another run.
            </p>
          )}
        </div>
      )}
      {prep ? (
        <>
          <PreparationContent prep={prep} />
          <PreparationDocumentActions
            key={prep.id}
            meeting={meeting}
            preparation={prep}
            canPrepare={allowed && !institutional && !busy}
          />
          <button className="button ghost" onClick={() => setSources(true)}>
            View sources and citations
          </button>
          <small>
            Saved{" "}
            <time
              dateTime={prep.updatedAt ?? prep.createdAt}
              title={prep.updatedAt ?? prep.createdAt}
            >
              {Number.isFinite(Date.parse(prep.updatedAt ?? prep.createdAt))
                ? new Date(prep.updatedAt ?? prep.createdAt).toLocaleString(
                    undefined,
                    { dateStyle: "medium", timeStyle: "short" },
                  )
                : "date unavailable"}
            </time>
          </small>
        </>
      ) : (
        <p className="empty">No preparation yet.</p>
      )}
      {editing && (
        <PreparationEditor
          meetingId={meeting.id}
          clientId={meeting.client?.id ?? null}
          prep={editing}
          canWrite={allowed && !institutional}
          onClose={() => setEditing(undefined)}
        />
      )}
      {settings && (
        <PreparationSettings
          meetingId={meeting.id}
          client={meeting.client}
          depth={depth}
          onDepth={setDepth}
          onClose={() => setSettings(false)}
          onGenerate={begin}
          comprehensive={comprehensive}
          canGenerate={canGenerate}
          canWrite={allowed && !institutional}
        />
      )}
      {sources && prep && (
        <PreparationSources
          prep={prep}
          meeting={meeting}
          onClose={() => setSources(false)}
        />
      )}
      {comprehensive &&
        progressOpen &&
        (generate.isPending || active || change.isPending) && (
          <PreparationProgress
            saved={active}
            stage={job.data?.stage}
            canCancel={allowed && !institutional && active && !change.isPending}
            onClose={() => setProgressOpen(false)}
            onCancel={() => {
              updateJob("cancel");
              setProgressOpen(false);
            }}
          />
        )}
    </section>
  );
}
