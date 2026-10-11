"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { acknowledged } from "@/shared/api/http";
import { meetingSchema } from "./contracts";
export function useSaveMeeting(
  meetingId: string | undefined,
  onSaved: () => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      api.request(
        "core",
        `engagement/meetings${meetingId ? `/${encodeURIComponent(meetingId)}` : ""}`,
        meetingSchema,
        { method: meetingId ? "PUT" : "POST", body },
      ),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["calendar", "meetings"] }),
        cache.invalidateQueries({ queryKey: ["meeting", meetingId] }),
      ]);
      onSaved();
    },
  });
}
export type ArtifactChange =
  | { action: "save"; id?: string; body: string; confidential: boolean }
  | { action: "approve" | "share" | "unshare"; id: string };
export function useChangeMeetingArtifact(
  meetingId: string,
  kind: "notes" | "debriefs",
  onSaved: () => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  const base = `engagement/meetings/${encodeURIComponent(meetingId)}`;
  return useMutation({
    mutationFn: (change: ArtifactChange) => {
      if (change.action === "save")
        return api.request(
          "core",
          `${base}/${kind}${change.id ? `/${encodeURIComponent(change.id)}` : ""}`,
          acknowledged,
          {
            method: change.id ? "PATCH" : "POST",
            body: { body: change.body, confidential: change.confidential },
          },
        );
      if (change.action === "approve")
        return api.request(
          "core",
          `${base}/${kind}/${encodeURIComponent(change.id)}/approve`,
          acknowledged,
          { method: "POST" },
        );
      return api.request(
        "core",
        `${base}/artifacts/${change.action}`,
        acknowledged,
        {
          method: "POST",
          body: {
            artifacts: [
              { type: kind === "notes" ? "note" : "debrief", id: change.id },
            ],
          },
        },
      );
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["meeting", meetingId] }),
        cache.invalidateQueries({ queryKey: ["calendar", "meetings"] }),
      ]);
      onSaved();
    },
  });
}
