"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity, canAdminister } from "@/shared/auth/identity";
import { useDispatchGuard, usePreparationCapabilities } from "../access/public";
import { readPreference, readSession } from "./api";
import { progressing } from "./contracts";

export function useAttendanceAccess() {
  const identity = useIdentity();
  const capabilities = usePreparationCapabilities();
  const userId = identity.data?.user.id,
    tenantId = identity.data?.tenant?.id;
  const readAllowed = Boolean(
    userId &&
    tenantId &&
    !identity.isPending &&
    !identity.isFetching &&
    !identity.error &&
    (identity.data?.role === "standard_user" ||
      canAdminister(identity.data?.role)),
  );
  const allowed =
    readAllowed &&
    !capabilities.isPending &&
    !capabilities.isFetching &&
    !capabilities.error &&
    capabilities.data?.runtime?.externalActionsEnabled === true;
  const guard = useDispatchGuard(userId, tenantId, true);
  return {
    identity,
    capabilities,
    readAllowed,
    allowed,
    guard,
    scope: `${tenantId}:${userId}`,
  };
}
export const sessionKey = (scope: string, meetingId: string) =>
  ["calendar", "attendance", "session", scope, meetingId] as const;
export const preferenceKey = (scope: string, clientId: string) =>
  ["calendar", "attendance", "preference", scope, clientId] as const;
export function useAttendanceSession(
  meetingId: string,
  scope: string,
  enabled: boolean,
) {
  const api = useApi();
  return useQuery({
    queryKey: sessionKey(scope, meetingId),
    enabled,
    queryFn: ({ signal }) => readSession(api, meetingId, signal),
    refetchInterval: (query) =>
      progressing(query.state.data) ? 20_000 : false,
  });
}
export function useAttendancePreference(
  clientId: string,
  scope: string,
  enabled: boolean,
) {
  const api = useApi();
  return useQuery({
    queryKey: preferenceKey(scope, clientId),
    enabled,
    queryFn: ({ signal }) => readPreference(api, clientId, signal),
    refetchInterval: (query) => (query.state.data?.stopping ? 20_000 : false),
  });
}
