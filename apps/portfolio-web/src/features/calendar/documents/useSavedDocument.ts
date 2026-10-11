"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useDispatchGuard } from "../access/public";
import { readSavedDocument } from "./api";
import {
  documentId,
  type DocumentMeeting,
  type SavedMeetingDocument,
} from "./contracts";

export function useSavedDocument(
  meeting: DocumentMeeting,
  document: SavedMeetingDocument,
  actor: { userId?: string; tenantId?: string; allowed: boolean },
) {
  const api = useApi();
  const assertSession = useDispatchGuard(actor.userId, actor.tenantId);
  const queryKey = savedDocumentKey(meeting, document, actor);
  const query = useQuery({
    queryKey,
    enabled: actor.allowed && Boolean(actor.userId && actor.tenantId),
    queryFn: async ({ signal }) => {
      assertSession();
      const result = await readSavedDocument(api, meeting, document, signal);
      assertSession();
      return result;
    },
    staleTime: 0,
    retry: false,
  });
  return { ...query, queryKey };
}

export function savedDocumentKey(
  meeting: DocumentMeeting,
  document: SavedMeetingDocument,
  actor: { userId?: string; tenantId?: string },
) {
  return [
    "meeting-document",
    actor.tenantId ?? null,
    actor.userId ?? null,
    meeting.id,
    meeting.client?.id ?? null,
    document.kind,
    documentId(document),
  ] as const;
}
