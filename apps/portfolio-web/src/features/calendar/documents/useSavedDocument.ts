"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { readSavedDocument } from "./api";
import {
  documentId,
  type DocumentMeeting,
  type SavedMeetingDocument,
} from "./contracts";

export function useSavedDocument(
  meeting: DocumentMeeting,
  document: SavedMeetingDocument,
) {
  const api = useApi();
  return useQuery({
    queryKey: [
      "meeting-document",
      meeting.id,
      meeting.client?.id ?? null,
      document.kind,
      documentId(document),
    ],
    queryFn: ({ signal }) => readSavedDocument(api, meeting, document, signal),
    staleTime: 0,
    retry: false,
  });
}
