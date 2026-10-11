"use client";
import { useCallback, useState } from "react";
import { useIdentity } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { Meeting } from "../../contracts";
import { useVoiceSource } from "./useVoiceSource";
import { voiceFileValidation, type ReviewedVoiceSource } from "./source";
import styles from "./voice-source.module.css";

export interface VoiceMemoSourceProps {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (source: ReviewedVoiceSource) => boolean;
}
export function VoiceMemoSource(props: VoiceMemoSourceProps) {
  const identity = useIdentity();
  return (
    <VoiceSourceForm
      key={`${props.meeting.id}:${props.meeting.client?.id}:${identity.data?.tenant?.id}:${identity.data?.user.id}`}
      {...props}
    />
  );
}
function AudioMemoPreview({ file }: { file: File }) {
  const [failed, setFailed] = useState(false);
  const attach = useCallback(
    (node: HTMLAudioElement | null) => {
      if (!node) return;
      const url = URL.createObjectURL(file);
      node.src = url;
      return () => {
        node.pause();
        node.removeAttribute("src");
        node.load();
        URL.revokeObjectURL(url);
      };
    },
    [file],
  );
  return (
    <>
      <audio
        ref={attach}
        controls
        preload="metadata"
        aria-label="Review selected audio memo"
        onError={() => setFailed(true)}
      />
      {failed && (
        <small role="status">
          This browser could not play the selected audio. Verify the original
          memo before using its transcript.
        </small>
      )}
    </>
  );
}
function VoiceSourceForm({
  meeting,
  open,
  onOpenChange,
  onGenerate,
}: VoiceMemoSourceProps) {
  const voice = useVoiceSource(meeting, open);
  const [file, setFile] = useState<File>();
  const [selection, setSelection] = useState(0);
  const [validation, setValidation] = useState("");
  const result = voice.mutation.data;
  const frozen = voice.frozen;
  function select(next: File | undefined) {
    if (frozen || voice.mutation.isPending) return;
    voice.reset();
    setFile(next);
    setSelection((value) => value + 1);
    setValidation(next ? (voiceFileValidation(next) ?? "") : "");
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record Voice Memo"
      description="Upload an audio memo to transcribe."
      className={styles.dialog}
    >
      <div className={styles.form}>
        <QueryState
          pending={voice.identity.isPending || voice.capabilities.isPending}
          error={voice.identity.error ?? voice.capabilities.error}
          retry={() =>
            void (voice.identity.error
              ? voice.identity.refetch()
              : voice.capabilities.refetch())
          }
        />
        <label>
          Audio memo
          <input
            type="file"
            aria-label="Audio memo"
            accept="audio/*,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
            disabled={
              !voice.allowed ||
              voice.mutation.isPending ||
              frozen ||
              Boolean(result)
            }
            onChange={(event) => select(event.target.files?.[0])}
          />
        </label>
        <p className="muted">
          The uploaded audio is transcribed for this debrief. Review the
          transcript before generating. Audio files must be 25 MiB or smaller.
        </p>
        {file && <small>{file.name}</small>}
        {file && !validation && open && (
          <AudioMemoPreview key={selection} file={file} />
        )}
        {validation && <p role="alert">{validation}</p>}
        {voice.stage && <p role="status">{voice.stage}</p>}
        {!voice.allowed &&
          !voice.identity.isPending &&
          !voice.capabilities.isPending && (
            <p role="status">
              A current authorized session and enabled transcription service are
              required. Your selected source is retained.
            </p>
          )}
        <QueryState error={voice.mutation.error} />
        {frozen && !result && !voice.extractionUnknown && (
          <p className="muted">
            This attempt retains the original audio and upload reference.
            Checking again confirms the same upload and reads its current
            readiness.
          </p>
        )}
        {result && (
          <>
            {result.truncated === true && (
              <p role="alert">
                Only part of this source was extracted. Review omitted material
                before continuing.
              </p>
            )}
            {result.truncated === undefined && (
              <p role="status">
                The service did not report transcript completeness. Review the
                transcript against your audio memo.
              </p>
            )}
            {result.disclosure && <p role="status">{result.disclosure}</p>}
            <label>
              Reviewed transcript
              <textarea
                aria-label="Reviewed voice transcript"
                value={result.text}
                readOnly
                rows={8}
              />
            </label>
            <p className="muted">
              Generation creates a draft. Review and save it separately; this
              action does not approve or share the debrief.
            </p>
          </>
        )}
        <footer className={styles.actions}>
          <button
            type="button"
            className="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          {result ? (
            <button
              type="button"
              className="button primary"
              disabled={!voice.allowed || voice.mutation.isPending}
              onClick={() => {
                try {
                  voice.assertCurrent();
                } catch {
                  return;
                }
                if (onGenerate({ ...result, method: "voice" }))
                  onOpenChange(false);
              }}
            >
              Generate Debrief
            </button>
          ) : (
            <button
              type="button"
              className="button primary"
              disabled={
                !voice.allowed ||
                !file ||
                Boolean(validation) ||
                voice.mutation.isPending ||
                voice.extractionUnknown
              }
              onClick={() => {
                if (file) voice.prepare(file);
              }}
            >
              {voice.mutation.isPending
                ? "Working…"
                : frozen
                  ? "Check saved audio and transcribe"
                  : "Upload and transcribe"}
            </button>
          )}
        </footer>
      </div>
    </Dialog>
  );
}
