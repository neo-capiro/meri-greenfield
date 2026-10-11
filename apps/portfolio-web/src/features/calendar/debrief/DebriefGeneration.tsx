"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { Meeting } from "../contracts";
import { MeetingTranscriptUpload } from "../library/public";
import { usePreparationCapabilities, useDispatchGuard } from "../access/public";
import { debriefBody, generateDebrief } from "./api";
import { ManualDebriefSource } from "./ManualDebriefSource";
import { VoiceMemoSource } from "./voice/VoiceMemoSource";
import { SavedMeetingNotesSource } from "../review/public";
type ReviewedDebriefSource = {
  text: string;
  method: "manual" | "upload" | "voice";
};
type DebriefGenerationProps = {
  meeting: Meeting;
  onDraft: (body: string) => void;
};

export function DebriefGeneration(props: DebriefGenerationProps) {
  const identity = useIdentity();
  // Written source and pending generation belong to one meeting and actor.
  return (
    <SessionDebriefGeneration
      key={`${props.meeting.id}:${identity.data?.tenant?.id}:${identity.data?.user.id}`}
      {...props}
    />
  );
}

function SessionDebriefGeneration({
  meeting,
  onDraft,
}: DebriefGenerationProps) {
  const api = useApi();
  const identity = useIdentity();
  const capabilities = usePreparationCapabilities();
  const guard = useDispatchGuard(
    identity.data?.user.id,
    identity.data?.tenant?.id,
    true,
  );
  const [uploading, setUploading] = useState(false);
  const [manual, setManual] = useState(false);
  const [voice, setVoice] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [source, setSource] = useState<ReviewedDebriefSource>();
  const busy = useRef(false);
  const lifetime = useRef<AbortController | undefined>(undefined);
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, [meeting.id, identity.data?.user.id, identity.data?.tenant?.id]);
  const allowed = Boolean(
    identity.data?.user.id &&
    identity.data.tenant?.id &&
    !identity.isPending &&
    !identity.isFetching &&
    !identity.error &&
    (identity.data.role === "standard_user" ||
      canAdminister(identity.data.role)) &&
    !capabilities.isPending &&
    !capabilities.isFetching &&
    !capabilities.error &&
    capabilities.data?.runtime?.externalActionsEnabled === true,
  );
  const mutation = useMutation({
    retry: false,
    mutationFn: async (reviewed: ReviewedDebriefSource) => {
      const scope = lifetime.current;
      if (!allowed || !scope || scope.signal.aborted)
        throw new ApiError(
          403,
          "Debrief generation is unavailable for this session.",
        );
      guard();
      const draft = await generateDebrief(
        api,
        meeting.id,
        reviewed.text,
        scope.signal,
        reviewed.method,
      );
      if (scope.signal.aborted)
        throw new ApiError(409, "This meeting session is no longer active.");
      guard();
      return { draft, scope };
    },
    onSuccess: ({ draft, scope }) => {
      if (scope.signal.aborted || lifetime.current !== scope) return;
      setSource(undefined);
      onDraft(debriefBody(draft));
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  function generate(reviewed: ReviewedDebriefSource) {
    if (busy.current || !allowed) return false;
    busy.current = true;
    setSource(reviewed);
    mutation.mutate(reviewed);
    return true;
  }
  return (
    <>
      <button
        className="button"
        disabled={!allowed || mutation.isPending}
        onClick={() => setSavedNotes(true)}
      >
        Use saved meeting notes
      </button>
      <SavedMeetingNotesSource
        meeting={meeting}
        open={savedNotes}
        onOpenChange={setSavedNotes}
        onGenerate={generate}
      />
      <button
        className="button"
        disabled={!allowed || mutation.isPending}
        onClick={() => setUploading(true)}
      >
        Transcript and attachments
      </button>
      <button
        className="button"
        disabled={!allowed || mutation.isPending}
        onClick={() => setManual(true)}
      >
        Type Notes Manually
      </button>
      <ManualDebriefSource
        open={manual}
        onOpenChange={setManual}
        allowed={allowed && !mutation.isPending}
        onGenerate={(text) => generate({ text, method: "manual" })}
      />
      <button
        className="button"
        disabled={!allowed || mutation.isPending}
        onClick={() => setVoice(true)}
      >
        Record Voice Memo
      </button>
      <VoiceMemoSource
        meeting={meeting}
        open={voice}
        onOpenChange={setVoice}
        onGenerate={generate}
      />
      <QueryState
        error={capabilities.error ?? identity.error}
        retry={() =>
          void (identity.error ? identity.refetch() : capabilities.refetch())
        }
      />
      {capabilities.isSuccess &&
        !capabilities.data.runtime?.externalActionsEnabled && (
          <small className="muted">
            Source extraction and debrief generation are unavailable in this
            environment.
          </small>
        )}
      <MeetingTranscriptUpload
        meeting={meeting}
        open={uploading}
        onOpenChange={setUploading}
        onExtracted={(reviewed) => generate({ ...reviewed, method: "upload" })}
      />
      <Dialog
        open={Boolean(source)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setSource(undefined);
        }}
        title="Generate meeting debrief"
      >
        <p>
          Generating a draft from the reviewed source. Review and save it before
          approval or sharing.
        </p>
        <QueryState pending={mutation.isPending} error={mutation.error} />
        {mutation.error && (
          <>
            <p>
              Your reviewed source is retained. A failed response may follow a
              completed generation; generating again starts another request.
            </p>
            <button
              className="button"
              disabled={!allowed || mutation.isPending}
              onClick={() => {
                if (source) generate(source);
              }}
            >
              Generate again from this source
            </button>
          </>
        )}
      </Dialog>
    </>
  );
}
