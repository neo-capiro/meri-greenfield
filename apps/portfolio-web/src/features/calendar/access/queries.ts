"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { calendarCapabilitiesSchema } from "./contracts";

export function useCalendarCapabilities() {
  const api = useApi();
  return useQuery({
    queryKey: ["meeting-preparation", "capabilities"],
    queryFn: ({ signal }) =>
      api.request(
        "core",
        "engagement/capabilities",
        calendarCapabilitiesSchema,
        {
          signal,
        },
      ),
  });
}
