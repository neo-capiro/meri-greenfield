"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { queryString } from "@/shared/api/http";
import { clientSearchSchema, programResponseSchema } from "./contracts";
export function useMatchedOpportunities(
  clientId: string,
  page: number,
  query: string,
) {
  const api = useApi();
  return useQuery({
    queryKey: ["matched-opportunities", clientId, page, query],
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `intelligence/opportunities/v2/search?${queryString({ mode: "matched", clientId, page, pageSize: 20, sort: "deadline", direction: "asc", query, queryMatch: "keywords", lifecycle: "active" })}`,
        clientSearchSchema(clientId, page),
        { signal },
      ),
  });
}
export function useRelevantPrograms(clientId: string, page: number) {
  const api = useApi();
  return useQuery({
    queryKey: ["client-program-relevance", clientId, page],
    queryFn: ({ signal }) =>
      api.request(
        "core",
        `intelligence/clients/${encodeURIComponent(clientId)}/pe-relevance?${queryString({ page, limit: 20 })}`,
        programResponseSchema.refine(
          (result) => result.page === page,
          "Program page mismatch",
        ),
        { signal },
      ),
  });
}
