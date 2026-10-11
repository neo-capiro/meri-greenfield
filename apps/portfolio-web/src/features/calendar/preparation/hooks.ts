"use client";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import type { PrepJob } from "./schema";
export { useCalendarCapabilities as usePreparationCapabilities } from "../access/public";
import {
  changeJob,
  generatePreparation,
  readJob,
  type GenerateInput,
} from "./api";

export const activeJob = (job: PrepJob | null | undefined) =>
  job?.status === "queued" || job?.status === "running";
export function usePreparationJob(meetingId: string, enabled: boolean) {
  const api = useApi();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["meeting-preparation", meetingId, "job"],
    enabled,
    queryFn: ({ signal }) => readJob(api, meetingId, signal),
    refetchInterval: (query) => (activeJob(query.state.data) ? 5000 : false),
  });
  const completed =
    query.data?.status === "completed" ? query.data.jobId : undefined;
  useEffect(() => {
    if (completed) {
      void cache.invalidateQueries({ queryKey: ["meeting", meetingId] });
      void cache.invalidateQueries({ queryKey: ["calendar", "meetings"] });
    }
  }, [completed, meetingId, cache]);
  return {
    ...query,
    refresh: async () => {
      await query.refetch();
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["meeting", meetingId] }),
        cache.invalidateQueries({ queryKey: ["calendar", "meetings"] }),
      ]);
    },
  };
}
export function useGeneratePreparation(
  meetingId: string,
  clientId: string | null,
) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (input: GenerateInput) =>
      generatePreparation(api, meetingId, input, clientId),
    onSuccess: async (result) => {
      if (result && "jobId" in result)
        cache.setQueryData(["meeting-preparation", meetingId, "job"], result);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["meeting", meetingId] }),
        cache.invalidateQueries({ queryKey: ["calendar", "meetings"] }),
      ]);
    },
  });
}
export function useChangePreparationJob(meetingId: string) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({
      jobId,
      action,
    }: {
      jobId: string;
      action: "cancel" | "resume";
    }) => changeJob(api, meetingId, jobId, action),
    onSuccess: (result) =>
      cache.setQueryData(["meeting-preparation", meetingId, "job"], result),
  });
}
