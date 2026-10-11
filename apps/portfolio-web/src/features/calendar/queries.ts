"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import {
  fetchMeetings,
  fetchHearings,
  fetchPlanner,
  fetchUpcomingDeadlines,
} from "./feeds";
import { meetingSchema, noteSchema } from "./contracts";
import { z } from "zod";
export function useCalendarFeeds(
  range: { from: string; to: string; startDay: string; endDay: string },
  zone: string,
  clientId?: string,
  mixed = false,
) {
  const api = useApi();
  const meetings = useQuery({
    queryKey: [
      "calendar",
      "meetings",
      range.from,
      range.to,
      clientId ?? null,
      zone,
    ],
    queryFn: ({ signal }) =>
      fetchMeetings(api, range.from, range.to, zone, clientId, signal),
  });
  const hearings = useQuery({
    queryKey: ["calendar", "hearings", range.startDay, range.endDay],
    enabled: mixed,
    queryFn: ({ signal }) =>
      fetchHearings(api, range.startDay, range.endDay, signal),
  });
  const planner = useQuery({
    queryKey: ["calendar", "planner", range.startDay, range.endDay],
    enabled: mixed,
    queryFn: ({ signal }) =>
      fetchPlanner(api, range.startDay, range.endDay, signal),
  });
  const deadlines = useQuery({
    queryKey: ["calendar", "deadlines", range.startDay, range.endDay],
    enabled: mixed,
    queryFn: ({ signal }) =>
      fetchUpcomingDeadlines(api, range.startDay, range.endDay, signal),
  });
  return { meetings, hearings, planner, deadlines };
}
export function useMeeting(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["meeting", id],
    enabled: Boolean(id),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `engagement/meetings/${encodeURIComponent(id ?? "")}`,
        meetingSchema.refine((meeting) => meeting.id === id, {
          message: "Meeting response does not match the requested meeting",
        }),
        { signal },
      ),
  });
}
export function useMeetingNotes(id: string | null, kind: "notes" | "debriefs") {
  const api = useApi();
  return useQuery({
    queryKey: ["meeting", id, kind],
    enabled: Boolean(id),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `engagement/meetings/${encodeURIComponent(id ?? "")}/${kind}`,
        z.array(noteSchema),
        { signal },
      ),
  });
}
