"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { profileKey } from "./queries";
import {
  boundaryCollectionSchema,
  boundaryManifestSchema,
  facilityNexusSchema,
  representationSchema,
} from "./facility-map-contracts";

export function useFacilityRepresentation(clientId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: profileKey(clientId, "representation"),
    enabled,
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${clientId}/representation`,
        representationSchema,
        { signal },
      ),
  });
}
export function useFacilityNexus(clientId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: profileKey(clientId, "district-nexus"),
    enabled,
    queryFn: async ({ signal }) => {
      const value = await api.request(
        "core",
        `intelligence/clients/${clientId}/district-nexus-v2`,
        facilityNexusSchema,
        { signal },
      );
      if (value.clientId !== clientId)
        throw new Error(
          "The footprint response belongs to a different client.",
        );
      return value;
    },
  });
}
export function useFacilityBoundaries(enabled: boolean) {
  const api = useApi();
  const manifest = useQuery({
    queryKey: ["facility-map", "boundary-manifest", "C"],
    enabled,
    queryFn: ({ signal }) =>
      api.request(
        "core",
        "intelligence/district-nexus/boundaries?status=C",
        boundaryManifestSchema,
        { signal },
      ),
    staleTime: 300_000,
  });
  const geometry = useQuery({
    queryKey: ["facility-map", "boundaries", "C", manifest.data?.hash],
    enabled: enabled && Boolean(manifest.data),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        "intelligence/district-nexus/boundaries/C/geojson",
        boundaryCollectionSchema,
        { signal },
      ),
    staleTime: 300_000,
  });
  return { manifest, geometry };
}
