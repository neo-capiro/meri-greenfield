"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { Dialog } from "@/shared/ui/Dialog";
import { uploadParentFile, type UploadAttempt } from "./upload";
import { fileValidation } from "./contracts";
import { filesKey } from "./queries";
type Job = {
  id: string;
  file: File;
  stage: string;
  error?: string;
  complete?: boolean;
};
export function UploadDialog({
  clientId,
  onClose,
  source,
  beforeDispatch,
}: {
  clientId: string;
  onClose: () => void;
  source?: string;
  beforeDispatch?: () => void;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const attempts = useRef(new Map<string, UploadAttempt>());
  const patch = (id: string, update: Partial<Job>) =>
    setJobs((jobs) =>
      jobs.map((job) => (job.id === id ? { ...job, ...update } : job)),
    );
  async function run(job: Job) {
    setBusy(true);
    patch(job.id, { error: undefined });
    const attempt = attempts.current.get(job.id) ?? {};
    attempts.current.set(job.id, attempt);
    try {
      await uploadParentFile(
        api,
        { clientId },
        job.file,
        attempt,
        (stage) => patch(job.id, { stage }),
        source,
        fetch,
        beforeDispatch,
      );
      beforeDispatch?.();
      patch(job.id, {
        complete: true,
        stage: "Uploaded · awaiting service processing",
      });
      attempts.current.delete(job.id);
      await cache.invalidateQueries({ queryKey: filesKey(clientId) });
    } catch (error) {
      patch(job.id, {
        error: error instanceof Error ? error.message : "Upload failed.",
        stage: "Failed",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title="Upload files"
      description="Up to 25 MiB per file. Server verification and scan policy determine when a file can be opened."
    >
      <div className="stack">
        <label>
          Select files
          <input
            type="file"
            multiple
            disabled={busy}
            onChange={(event) =>
              setJobs((jobs) => [
                ...jobs,
                ...Array.from(event.target.files ?? []).map((file) => ({
                  id: crypto.randomUUID(),
                  file,
                  stage: "Ready",
                  error: fileValidation(file) ?? undefined,
                })),
              ])
            }
          />
        </label>
        {jobs.map((job) => (
          <article className="card stack" key={job.id}>
            <strong>{job.file.name}</strong>
            <small role="status">{job.stage}</small>
            {job.error && <p role="alert">{job.error}</p>}
            {!job.complete && (
              <button
                className="button"
                disabled={busy || Boolean(fileValidation(job.file))}
                onClick={() => void run(job)}
              >
                {job.stage === "Failed" ? "Retry file" : "Upload file"}
              </button>
            )}
          </article>
        ))}
        <button className="button" disabled={busy} onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}
