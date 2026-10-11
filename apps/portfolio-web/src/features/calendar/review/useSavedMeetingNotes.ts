"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useCalendarCapabilities } from "../access/public";
import { readSavedNotes, revalidateSavedNote } from "./api";
import {
  reviewKey,
  type ReviewMeeting,
  type SavedNote,
  type SavedNotesSource,
} from "./contracts";
import { useReviewActor } from "./useReviewActor";

export function useSavedMeetingNotes(meeting: ReviewMeeting, open: boolean) {
  const api = useApi();
  const authority = useReviewActor(true);
  const capabilities = useCalendarCapabilities();
  const [selected, setSelected] = useState<SavedNote>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error>();
  const busy = useRef(false);
  const runtimeReady =
    capabilities.isSuccess &&
    !capabilities.isFetching &&
    !capabilities.error &&
    capabilities.data.runtime?.externalActionsEnabled === true;
  const query = useQuery({
    queryKey: reviewKey("notes", meeting, authority.actor ?? {}),
    enabled: open && authority.allowed && runtimeReady,
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      authority.guard();
      const rows = await readSavedNotes(api, meeting, signal);
      authority.guard();
      return rows;
    },
  });
  const ready =
    open &&
    authority.allowed &&
    query.isSuccess &&
    !query.isFetching &&
    !query.error &&
    runtimeReady;
  async function generate(onGenerate: (source: SavedNotesSource) => boolean) {
    if (busy.current || !ready || !selected) return false;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const source = await revalidateSavedNote(
        api,
        meeting,
        selected,
        authority.guard,
      );
      authority.guard();
      return onGenerate(source);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error("The saved note could not be verified."),
      );
      return false;
    } finally {
      setPending(false);
      busy.current = false;
    }
  }
  return {
    ...authority,
    capabilities,
    query,
    selected,
    setSelected,
    pending,
    error,
    ready,
    generate,
  };
}
