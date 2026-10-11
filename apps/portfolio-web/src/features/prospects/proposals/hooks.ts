"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { readTemplate, readTemplateLibrary } from "./api";

export function useTemplateLibrary(tenantId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["workspace-template-library", tenantId],
    queryFn: ({ signal }) => readTemplateLibrary(api, signal),
    retry: false,
  });
}
export function useTemplate(tenantId: string, id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["workspace-template", tenantId, id],
    enabled: !!id,
    queryFn: ({ signal }) => {
      if (!id) throw new Error("Select a template to preview.");
      return readTemplate(api, id, signal);
    },
    retry: false,
  });
}
