"use client";
import { useState } from "react";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { TextareaField } from "@/shared/ui/TextareaField";
import { readBrief, type BriefScope, type SaveInput } from "./api";
import { useWriteBrief } from "./hooks";
import { changedSections, draftOf, mergeDraft } from "./editing";
import { sectionKeys, sectionLabels, type BriefVersion } from "./contracts";
import styles from "./brief.module.css";

export function BriefEditor({
  scope,
  title,
  version,
  onClose,
}: {
  scope: BriefScope;
  title: string;
  version: BriefVersion;
  onClose: () => void;
}) {
  const api = useApi();
  const save = useWriteBrief(scope);
  const [base, setBase] = useState(version);
  const [draft, setDraft] = useState(() => draftOf(version));
  const [name, setName] = useState(title);
  const [attempt, setAttempt] = useState<SaveInput>();
  const [reviewed, setReviewed] = useState<BriefVersion>();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string>();
  const [discard, setDiscard] = useState(false);
  const conflict = save.error instanceof ApiError && save.error.status === 409;
  const unknown =
    !!attempt &&
    !!save.error &&
    (!(save.error instanceof ApiError) || save.error.status >= 500);
  const dirty =
    name !== title ||
    sectionKeys.some((key) => draft[key] !== base.sections[key].text);
  const accessDenied =
    save.error instanceof ApiError &&
    [401, 403, 404].includes(save.error.status);
  function close() {
    if (save.isPending || checking) return;
    if (dirty || unknown) setDiscard(true);
    else onClose();
  }
  async function reviewLatest() {
    setChecking(true);
    setMessage(undefined);
    try {
      const latest = await readBrief(api, scope);
      if (
        !latest.currentVersion ||
        !latest.brief ||
        latest.brief.status !== "draft"
      )
        throw new Error(
          "No editable current brief is available. Your local draft is preserved.",
        );
      setReviewed(latest.currentVersion);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load the latest brief.",
      );
    } finally {
      setChecking(false);
    }
  }
  function rebase() {
    if (!reviewed) return;
    try {
      const sections = mergeDraft(base, reviewed, draft);
      setDraft(draftOf({ ...reviewed, sections }));
      setBase(reviewed);
      setAttempt(undefined);
      setReviewed(undefined);
      save.reset();
      setMessage(
        "Latest version reviewed. Your changed sections are retained; save explicitly to create the next version.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Review the sources before merging.",
      );
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Edit saved prospect brief"
      description={`Sections based on version ${base.versionNumber}. Citations stay attached to the saved evidence.`}
      className={styles.editor}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (conflict || unknown || save.isPending) return;
          setMessage(undefined);
          try {
            if (!name.trim() || name.length > 300)
              throw new Error("Enter a title of 1–300 characters.");
            const input: SaveInput = {
              idempotencyKey: `brief-edit:${crypto.randomUUID()}`,
              expectedVersionNumber: base.versionNumber,
              sections: changedSections(base, draft),
              title: name,
            };
            setAttempt(input);
            save.mutate(input, { onSuccess: onClose });
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Check the brief fields.",
            );
          }
        }}
      >
        <label>
          Brief title
          <input
            value={name}
            maxLength={300}
            disabled={save.isPending || unknown}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {sectionKeys.map((key) => (
          <TextareaField
            key={key}
            label={sectionLabels[key]}
            value={draft[key]}
            maxLength={4000}
            rows={4}
            disabled={save.isPending || unknown}
            onChange={(event) =>
              setDraft((prior) => ({ ...prior, [key]: event.target.value }))
            }
            hint={`${draft[key].length}/4000 characters · Citation references are retained`}
          />
        ))}
        <p className="muted">
          Changed sections are marked edited. Unchanged sections keep their
          provenance and citations; user-written text is not independently
          verified by saving.
        </p>
        <QueryState error={save.error} />
        {message && <p role="status">{message}</p>}
        {unknown && (
          <div className="status stack" role="alert">
            <p>
              The outcome is unconfirmed. Your original draft is retained;
              retrying reuses the same save.
            </p>
            <button
              className="button"
              type="button"
              disabled={save.isPending}
              onClick={() => {
                if (attempt) save.mutate(attempt, { onSuccess: onClose });
              }}
            >
              Retry same save
            </button>
            <button
              className="button"
              type="button"
              disabled={checking}
              onClick={() => void reviewLatest()}
            >
              Check saved version
            </button>
          </div>
        )}
        {conflict && (
          <div className="status stack" role="alert">
            <p>
              Your draft is preserved. Review the latest saved version before
              creating another version.
            </p>
            <button
              className="button"
              type="button"
              disabled={checking}
              onClick={() => void reviewLatest()}
            >
              {checking ? "Loading latest…" : "Review latest version"}
            </button>
          </div>
        )}
        {reviewed && (
          <section className="stack" aria-label="Conflict review">
            <h3>Latest saved version {reviewed.versionNumber}</h3>
            <p>
              Your changed sections will replace the latest text only after you
              choose to keep them. Unchanged sections use the latest saved text.
              Nothing is saved by reviewing.
            </p>
            {sectionKeys
              .filter(
                (key) =>
                  draft[key] !== base.sections[key].text ||
                  reviewed.sections[key].text !== base.sections[key].text,
              )
              .map((key) => (
                <section key={key} className="stack">
                  <h3>{sectionLabels[key]}</h3>
                  <div className={styles.comparison}>
                    <div>
                      <strong>Latest saved text</strong>
                      <p>{reviewed.sections[key].text}</p>
                    </div>
                    <div>
                      <strong>Your draft</strong>
                      <p>{draft[key]}</p>
                    </div>
                  </div>
                </section>
              ))}
            {conflict && (
              <button className="button" type="button" onClick={rebase}>
                Use latest base and keep my changed sections
              </button>
            )}
          </section>
        )}
        {discard && (
          <div role="alert" className="status stack">
            <p>
              Discard your local draft? An unconfirmed save may already exist on
              the service.
            </p>
            <div className="row">
              <button
                className="button"
                type="button"
                onClick={() => setDiscard(false)}
              >
                Keep editing
              </button>
              <button className="button" type="button" onClick={onClose}>
                Discard local draft
              </button>
            </div>
          </div>
        )}
        <footer className="row">
          <button
            className="button"
            type="button"
            disabled={save.isPending || checking}
            onClick={close}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={
              !dirty ||
              save.isPending ||
              conflict ||
              unknown ||
              base.versionNumber >= 100 ||
              accessDenied
            }
          >
            {save.isPending ? "Saving…" : "Save new version"}
          </button>
        </footer>
        {base.versionNumber >= 100 && (
          <p role="note">The service’s 100-version limit has been reached.</p>
        )}
      </form>
    </Dialog>
  );
}
