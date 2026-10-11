"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { fetchOwnedCalendarConnections } from "./api";

export const calendarConnectionsKey = (tenantId: string, userId: string) =>
  ["calendar-sync-connections", tenantId, userId] as const;
export function useOwnedCalendarConnections(
  tenantId: string,
  userId: string,
  enabled: boolean,
  assertCurrent: () => void,
) {
  const api = useApi();
  return useQuery({
    queryKey: calendarConnectionsKey(tenantId, userId),
    enabled,
    queryFn: async ({ signal }) => {
      assertCurrent();
      const accounts = await fetchOwnedCalendarConnections(api, userId, signal);
      assertCurrent();
      return accounts;
    },
  });
}
