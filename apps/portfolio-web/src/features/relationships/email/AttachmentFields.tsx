"use client";
import type { useMailAttachments } from "./useMailAttachments";
import { mailFileValidation, attachmentRefusal } from "./attachments";
import styles from "./email.module.css";
export function AttachmentFields({
  state,
  disabled,
}: {
  state: ReturnType<typeof useMailAttachments>;
  disabled: boolean;
}) {
  return (
    <section className="stack" aria-label="Email attachments">
      <label>
        Attach file
        <input
          type="file"
          disabled={disabled || state.busy || state.jobs.length >= 5}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) state.add(file);
            event.target.value = "";
          }}
        />
      </label>
      <small>
        Up to 5 files, 3 MiB each. Uploaded files are saved to this client’s
        Files. Removing here only detaches them from this draft.
      </small>
      {state.jobs.map((job) => (
        <article key={job.id} className={styles.attachment}>
          <strong>
            {job.fileName}
            {job.file ? ` · ${Math.ceil(job.file.size / 1024)} KiB` : ""}
          </strong>
          <small role="status">{job.stage}</small>
          {job.receipt?.scanDisclosure && <p>{job.receipt.scanDisclosure}</p>}
          {job.error && <p role="alert">{job.error}</p>}
          <div className="row">
            {((job.selectedId && !job.receipt) ||
              job.error ||
              (job.receipt && attachmentRefusal(job.receipt))) && (
              <button
                type="button"
                className="button"
                disabled={
                  disabled ||
                  state.busy ||
                  Boolean(job.file && mailFileValidation(job.file))
                }
                onClick={() => void state.run(job)}
              >
                {job.receipt || job.selectedId
                  ? "Check scan status"
                  : "Retry confirmation / upload"}
              </button>
            )}
            <button
              type="button"
              className="button ghost"
              disabled={disabled || state.busy}
              onClick={() => state.remove(job.id)}
              aria-label={`Remove attachment ${job.fileName}`}
            >
              Remove
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
