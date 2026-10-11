"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { filesKey } from "@/features/files/public";
import {
  approveReviewedAttachment,
  AttachmentApprovalError,
  readMeetingAttachments,
} from "./api";
import {
  reviewKey,
  type MeetingAttachment,
  type ReviewMeeting,
} from "./contracts";
import { useReviewActor } from "./useReviewActor";

export function useAttachmentApproval(meeting: ReviewMeeting) {
  const api = useApi();
  const cache = useQueryClient();
  const authority = useReviewActor();
  const key = reviewKey("attachments", meeting, authority.actor ?? {});
  const query = useQuery({
    queryKey: key,
    enabled: authority.allowed,
    retry: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      authority.guard();
      if (!authority.actor) throw new Error("A current session is required.");
      const rows = await readMeetingAttachments(
        api,
        meeting,
        authority.actor,
        signal,
      );
      authority.guard();
      return rows;
    },
  });
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<Error>();
  const [uncertain, setUncertain] = useState<string>();
  const busy = useRef(false);
  async function approve(file: MeetingAttachment) {
    if (
      busy.current ||
      uncertain ||
      !authority.allowed ||
      !authority.actor ||
      query.isFetching ||
      query.error
    )
      return;
    busy.current = true;
    setPending(file.id);
    setError(undefined);
    let confirmed = false;
    try {
      const receipt = await approveReviewedAttachment(
        api,
        meeting,
        authority.actor,
        file,
        authority.guard,
      );
      confirmed = true;
      authority.guard();
      cache.setQueryData<MeetingAttachment[]>(key, (rows) =>
        rows?.map((row) =>
          row.id === receipt.id
            ? {
                ...row,
                approvedAt: receipt.approvedAt,
                approvedByUserId: receipt.approvedByUserId,
              }
            : row,
        ),
      );
      void cache.invalidateQueries({ queryKey: ["meeting", meeting.id] });
      if (meeting.client)
        void cache.invalidateQueries({ queryKey: filesKey(meeting.client.id) });
    } catch (failure) {
      if (
        confirmed ||
        (failure instanceof AttachmentApprovalError && failure.uncertain)
      )
        setUncertain(file.id);
      setError(
        confirmed
          ? new AttachmentApprovalError(
              "Approval may have completed before the session changed. Refresh the attachment status before another action. This attempt will not retry automatically.",
              true,
            )
          : failure instanceof Error
            ? failure
            : new Error("Approval could not be verified."),
      );
    } finally {
      setPending(undefined);
      busy.current = false;
    }
  }
  async function refresh() {
    if (busy.current || !authority.allowed) return;
    try {
      authority.guard();
      const result = await query.refetch();
      authority.guard();
      // A read showing approval can resolve completion. An unapproved read cannot
      // prove an in-flight POST will never finish; keep replay frozen in that case.
      if (
        !result.error &&
        uncertain &&
        result.data?.some((row) => row.id === uncertain && row.approvedAt)
      ) {
        setUncertain(undefined);
        setError(undefined);
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error("Status could not be refreshed."),
      );
    }
  }
  return { ...authority, query, pending, error, uncertain, approve, refresh };
}
