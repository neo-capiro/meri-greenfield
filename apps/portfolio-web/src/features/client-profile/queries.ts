"use client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/shared/api/provider";
import { activitySchema, facilitySchema, teamMemberSchema } from "./contracts";
export const profileKey = (clientId: string, section: string) =>
  ["client-profile", clientId, section] as const;
export function useActivity(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: profileKey(clientId, "activity"),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${clientId}/activity?limit=500`,
        z.array(activitySchema),
        { signal },
      ),
  });
}
export function useFacilities(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: profileKey(clientId, "facilities"),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${clientId}/facilities`,
        z
          .array(facilitySchema)
          .refine((facilities) =>
            facilities.every((facility) => facility.clientId === clientId),
          ),
        { signal },
      ),
    refetchInterval: (query) =>
      query.state.data?.some(
        (f) =>
          f.geocodeStatus === "pending" ||
          (f.geocodeNextAttemptAt &&
            new Date(f.geocodeNextAttemptAt).getTime() >=
              Date.now() - 120_000 &&
            new Date(f.geocodeNextAttemptAt).getTime() <= Date.now() + 30_000),
      )
        ? 5000
        : false,
  });
}
export function useTeam(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: profileKey(clientId, "team"),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${clientId}/team`,
        z.array(teamMemberSchema),
        { signal },
      ),
  });
}
