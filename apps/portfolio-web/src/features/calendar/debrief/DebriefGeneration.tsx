"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import {
  canAdminister,
  identitySchema,
  useIdentity,
} from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { Meeting } from "../contracts";
import {
  MeetingTranscriptUpload,
  type ExtractedMeetingSource,
} from "../library/public";
import { usePreparationCapabilities } from "../preparation/public";
import { debriefBody, generateDebrief } from "./api";

export function DebriefGeneration({
  meeting,
  onDraft,
}: {
  meeting: Meeting;
  onDraft: (body: string) => void;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const capabilities = usePreparationCapabilities();
  const [uploading, setUploading] = useState(false);
  const [source, setSource] = useState<ExtractedMeetingSource>();
  const busy = useRef(false);
  const lifetime = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    lifetime.current = new AbortController();
    return () => lifetime.current?.abort();
  }, []);
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
    mutationFn: async (reviewed: ExtractedMeetingSource) => {
      const current = cache.getQueryState(["identity"]);
      const actor = identitySchema.safeParse(current?.data);
      const runtime = cache.getQueryState<
        NonNullable<typeof capabilities.data>
      >(["meeting-preparation", "capabilities"]);
      const scope = lifetime.current;
      if (
        !allowed ||
        !scope ||
        scope.signal.aborted ||
        current?.status !== "success" ||
        current.fetchStatus !== "idle" ||
        current.error ||
        !actor.success ||
        actor.data.user.id !== identity.data?.user.id ||
        actor.data.tenant?.id !== identity.data?.tenant?.id ||
        !(
          actor.data.role === "standard_user" || canAdminister(actor.data.role)
        ) ||
        runtime?.status !== "success" ||
        runtime.fetchStatus !== "idle" ||
        runtime.error ||
        runtime.data?.runtime?.externalActionsEnabled !== true
      )
        throw new ApiError(
          403,
          "Debrief generation is unavailable for this session.",
        );
      const draft = await generateDebrief(
        api,
        meeting.id,
        reviewed.text,
        scope.signal,
      );
      if (scope.signal.aborted)
        throw new ApiError(409, "This meeting session is no longer active.");
      return draft;
    },
    onSuccess: (draft) => {
      if (lifetime.current?.signal.aborted) return;
      setSource(undefined);
      onDraft(debriefBody(draft));
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  function generate(reviewed: ExtractedMeetingSource) {
    if (busy.current || !allowed) return;
    busy.current = true;
    setSource(reviewed);
    mutation.mutate(reviewed);
  }
  return (
    <>
      <button
        className="button"
        disabled={!allowed || mutation.isPending}
        onClick={() => setUploading(true)}
      >
        Transcript and attachments
      </button>
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
        onExtracted={generate}
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
              Your extracted source is retained. A failed response may follow a
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
