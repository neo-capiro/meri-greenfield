"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import {
  fileValidation,
  filesKey,
  uploadParentFile,
  type UploadAttempt,
} from "@/features/files/public";
import type { Meeting } from "../contracts";
import { usePreparationCapabilities, useDispatchGuard } from "../access/public";
import { extractMeetingSource } from "./api";
import type { ExtractedMeetingSource } from "./contracts";
import styles from "./library.module.css";

export function MeetingTranscriptUpload({
  meeting,
  open,
  onOpenChange,
  onExtracted,
}: {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (source: ExtractedMeetingSource) => void;
}) {
  const identity = useIdentity();
  return (
    <TranscriptForm
      key={`${open}:${meeting.id}:${meeting.client?.id}:${identity.data?.tenant?.id}:${identity.data?.user.id}`}
      meeting={meeting}
      open={open}
      onOpenChange={onOpenChange}
      onExtracted={onExtracted}
    />
  );
}
function TranscriptForm({
  meeting,
  open,
  onOpenChange,
  onExtracted,
}: {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (source: ExtractedMeetingSource) => void;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const capabilities = usePreparationCapabilities();
  const guard = useDispatchGuard(
    identity.data?.user.id,
    identity.data?.tenant?.id,
    true,
  );
  const [file, setFile] = useState<File>();
  const [stage, setStage] = useState("");
  const [retryStage, setRetryStage] = useState<
    "upload" | "confirm" | "extract"
  >("upload");
  const [validation, setValidation] = useState("");
  const [result, setResult] = useState<ExtractedMeetingSource>();
  const attempt = useRef<UploadAttempt>({});
  const confirmed = useRef<string | undefined>(undefined);
  const allowed = Boolean(
    identity.data &&
    identity.data.user.id &&
    identity.data.tenant?.id &&
    !identity.isPending &&
    !identity.isFetching &&
    !identity.error &&
    !capabilities.isPending &&
    !capabilities.isFetching &&
    !capabilities.error &&
    capabilities.data?.runtime?.externalActionsEnabled === true &&
    (identity.data.role === "standard_user" ||
      canAdminister(identity.data.role)),
  );
  const mutation = useMutation({
    mutationFn: async () => {
      guard();
      if (!allowed)
        throw new ApiError(
          403,
          "Uploading a source is unavailable for this role.",
        );
      if (!file) throw new Error("Select a source file.");
      const scopedApi: ApiClient = {
        request(service, path, schema, options) {
          guard();
          return api.request(service, path, schema, options);
        },
      };
      if (!confirmed.current) {
        const receipt = await uploadParentFile(
          scopedApi,
          { meetingId: meeting.id, clientId: meeting.client?.id ?? null },
          file,
          attempt.current,
          setStage,
          "manual",
          fetch,
          guard,
        );
        guard();
        confirmed.current = receipt.id;
        await Promise.all([
          cache.invalidateQueries({ queryKey: ["meeting", meeting.id] }),
          ...(meeting.client
            ? [
                cache.invalidateQueries({
                  queryKey: filesKey(meeting.client.id),
                }),
              ]
            : []),
        ]);
      }
      setStage("Extracting source text");
      return extractMeetingSource(scopedApi, confirmed.current);
    },
    onSuccess: (source) => {
      guard();
      setResult(source);
      setStage("Source extracted. Review it before continuing.");
    },
    onError: () => {
      try {
        guard();
      } catch {
        return;
      }
      setRetryStage(
        confirmed.current
          ? "extract"
          : attempt.current.storageUnknown || attempt.current.bytesUploaded
            ? "confirm"
            : "upload",
      );
    },
  });
  function selectFile(next: File | undefined) {
    setFile(next);
    attempt.current = {};
    confirmed.current = undefined;
    setResult(undefined);
    setStage("");
    setRetryStage("upload");
    setValidation(next ? (fileValidation(next) ?? "") : "");
    mutation.reset();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
      title="Transcript and attachments"
      description="Choose a source for the meeting debrief."
      className={styles.assignment}
    >
      <div className="stack">
        <p className="muted">
          Audio, video, .txt, .md, PDF, .doc and .docx are supported, up to 25
          MiB. The current service does not accept .vtt/.srt transcript types.
        </p>
        <QueryState
          pending={
            identity.isPending || identity.isFetching || capabilities.isPending
          }
          error={identity.error ?? capabilities.error}
          retry={() =>
            void (identity.error ? identity.refetch() : capabilities.refetch())
          }
        />
        <label>
          Selected file
          <input
            type="file"
            aria-label="Meeting source file"
            accept="audio/*,video/*,.txt,.md,.pdf,.doc,.docx"
            disabled={!allowed || mutation.isPending || Boolean(result)}
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
        </label>
        {file && <small>{file.name}</small>}
        {validation && <p role="alert">{validation}</p>}
        {stage && <p role="status">{stage}</p>}
        {!allowed && identity.isSuccess && !identity.isFetching && (
          <p role="alert">
            {capabilities.data?.runtime?.externalActionsEnabled !== true
              ? "Source extraction is unavailable in this environment."
              : "You do not have permission to upload a source."}
          </p>
        )}
        <QueryState error={mutation.error} />
        {result && (
          <>
            <p>
              Extraction does not approve or share this file. Review the source
              before generating or saving a debrief.
            </p>
            {result.truncated && (
              <p role="alert">
                Only part of this source was extracted. Review the omitted
                material before continuing.
              </p>
            )}
            {result.truncated === undefined && (
              <p role="status">
                The service did not report transcript completeness. Review it
                against the original source before continuing.
              </p>
            )}
            {result.disclosure && <p role="status">{result.disclosure}</p>}
            <label>
              Extracted text
              <textarea
                aria-label="Extracted meeting source"
                value={result.text}
                readOnly
                rows={9}
              />
            </label>
          </>
        )}
        <div className="row">
          <button
            className="button"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          {result ? (
            <button
              className="button primary"
              disabled={!allowed}
              onClick={() => {
                onExtracted(result);
                onOpenChange(false);
              }}
            >
              Use extracted source
            </button>
          ) : (
            <button
              className="button primary"
              disabled={
                !allowed || !file || Boolean(validation) || mutation.isPending
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? "Working…"
                : retryStage === "extract"
                  ? "Retry extraction"
                  : retryStage === "confirm"
                    ? "Retry confirmation"
                    : "Upload and extract"}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
