"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { ApiError } from "@/shared/api/http";
import { readLibrary } from "./api";
import type { LibraryFilters } from "./contracts";
import type { CalendarZone } from "../range";
export const libraryKey = ["calendar", "library"] as const;
export function useMeetingLibrary(
  filters: LibraryFilters | undefined,
  zone: CalendarZone,
  clientId: string | undefined,
  allowed: boolean,
  actorScope: string,
) {
  const api = useApi();
  return useQuery({
    queryKey: [...libraryKey, actorScope, clientId ?? null, zone, filters],
    enabled: allowed && Boolean(filters),
    queryFn: ({ signal }) => {
      if (!filters) throw new ApiError(422, "Choose valid library filters.");
      return readLibrary(api, filters, zone, clientId, signal);
    },
  });
}
