"use client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/shared/api/provider";
import { attachmentSchema, accessSchema } from "./contracts";
export const filesKey = (id: string) => ["client-files", id] as const;
export function useFiles(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: filesKey(clientId),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `engagement/attachments?clientId=${clientId}`,
        z.array(attachmentSchema),
        { signal },
      ),
    refetchInterval: (query) =>
      query.state.data?.some(
        (f) =>
          f.lifecycleStatus === "quarantined" ||
          f.extractionStatus === "pending",
      )
        ? 10000
        : false,
  });
}
export function useFileAccess(clientId: string, id?: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["file-access", clientId, id],
    enabled: Boolean(id),
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `clients/${clientId}/files/${id}/access`,
        accessSchema,
        { signal },
      ),
  });
}
