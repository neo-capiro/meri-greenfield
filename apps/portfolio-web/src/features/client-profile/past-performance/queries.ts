"use client";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "@/shared/auth/identity";
import { useApi } from "@/shared/api/provider";
import type { ApiClient } from "@/shared/api/http";
import { currentClientWriter, type ClientWriter } from "../quick-log/public";
import { submissionSchema } from "./contracts";
export const submissionKey = (clientId: string, actor?: ClientWriter) =>
  [
    "client-submissions",
    clientId,
    actor?.tenantId ?? "",
    actor?.userId ?? "",
  ] as const;
export function loadSubmissions(
  api: ApiClient,
  clientId: string,
  tenantId: string,
  signal?: AbortSignal,
) {
  return api.request(
    "core",
    `clients/${encodeURIComponent(clientId)}/submission-history`,
    z
      .array(submissionSchema)
      .max(200)
      .refine(
        (rows) =>
          rows.every(
            (row) => row.clientId === clientId && row.tenantId === tenantId,
          ) && new Set(rows.map((row) => row.id)).size === rows.length,
      ),
    { signal },
  );
}
export function useSubmissions(clientId: string) {
  useIdentity();
  const cache = useQueryClient();
  const api = useApi();
  const actor = currentClientWriter(cache);
  return useQuery({
    queryKey: submissionKey(clientId, actor),
    enabled: Boolean(actor),
    retry: false,
    queryFn: ({ signal }) => {
      if (!actor) throw new Error("Sign in to view saved submissions.");
      return loadSubmissions(api, clientId, actor.tenantId, signal);
    },
  });
}
