"use client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/shared/api/provider";
import { personSchema } from "./contracts";
export const peopleKey = (clientId: string) =>
  ["client-people", clientId] as const;
export function usePeople(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: peopleKey(clientId),
    queryFn: ({ signal }) =>
      api.request("core", `clients/${clientId}/people`, z.array(personSchema), {
        signal,
      }),
  });
}
