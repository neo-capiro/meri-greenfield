"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import {
  uploadParentFile,
  filesKey,
  type UploadAttempt,
  type Attachment,
} from "@/features/files/public";
import { guardedMailApi, useMailAuthority } from "./authority";
import {
  attachmentRefusal,
  mailFileValidation,
  readMailAttachments,
} from "./attachments";
import type { MailInitialDraft } from "./draft";

export type MailAttachmentJob = {
  id: string;
  file?: File;
  fileName: string;
  selectedId?: string;
  stage: string;
  error?: string;
  receipt?: Attachment;
};
export function useMailAttachments(
  clientId: string,
  initial?: MailInitialDraft["attachments"],
) {
  const api = useApi();
  const cache = useQueryClient();
  const authority = useMailAuthority(clientId);
  const [jobs, setJobs] = useState<MailAttachmentJob[]>(() =>
    (initial ?? []).map((item) => ({
      id: crypto.randomUUID(),
      fileName: item.fileName,
      selectedId: item.id,
      stage: "Check attachment availability before sending",
    })),
  );
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const attempts = useRef(new Map<string, UploadAttempt>());
  const patch = (id: string, value: Partial<MailAttachmentJob>) =>
    setJobs((items) =>
      items.map((job) => (job.id === id ? { ...job, ...value } : job)),
    );
  async function run(job: MailAttachmentJob) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    patch(job.id, { error: undefined });
    try {
      const assert = authority.capture();
      const guarded = guardedMailApi(api, assert);
      let receipt = job.receipt;
      if (!receipt && !job.selectedId) {
        if (!job.file) throw new Error("Select a file before uploading.");
        const attempt = attempts.current.get(job.id) ?? {};
        attempts.current.set(job.id, attempt);
        receipt = await uploadParentFile(
          guarded,
          { clientId },
          job.file,
          attempt,
          (stage) => patch(job.id, { stage }),
          "email-compose",
          async (url, options) => {
            assert();
            const response = await fetch(url, options);
            assert();
            return response;
          },
          assert,
        );
        assert();
        patch(job.id, { receipt, stage: "Uploaded · checking scan status" });
      }
      const selectedId = receipt?.id ?? job.selectedId;
      if (!selectedId) throw new Error("Attachment reference is missing.");
      const [current] = await readMailAttachments(guarded, clientId, [
        selectedId,
      ]);
      assert();
      if (!current) throw new Error("Attachment status was not returned.");
      patch(job.id, {
        receipt: current,
        stage: attachmentRefusal(current) ?? "Ready to attach",
        error: undefined,
      });
      await cache.invalidateQueries({ queryKey: filesKey(clientId) });
    } catch (error) {
      patch(job.id, {
        error:
          error instanceof Error ? error.message : "Attachment upload failed.",
        stage: "Needs review",
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function add(file: File) {
    if (lock.current || jobs.length >= 5) return;
    const job = {
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      stage: "Selected",
      error: mailFileValidation(file) ?? undefined,
    };
    setJobs((items) => [...items, job]);
    if (!job.error) void run(job);
  }
  return {
    jobs,
    busy,
    add,
    run,
    remove: (id: string) => {
      if (!lock.current) {
        setJobs((items) => items.filter((job) => job.id !== id));
        attempts.current.delete(id);
      }
    },
    ids: jobs.flatMap((job) => (job.receipt ? [job.receipt.id] : [])),
    blocked: jobs.some(
      (job) =>
        Boolean(job.error) ||
        !job.receipt ||
        Boolean(attachmentRefusal(job.receipt)),
    ),
  };
}
