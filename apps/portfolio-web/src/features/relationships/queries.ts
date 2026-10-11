"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { readPeople } from "./contact-api";
export const peopleKey = (clientId: string) =>
  ["client-people", clientId] as const;
export function usePeople(clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: peopleKey(clientId),
    queryFn: ({ signal }) => readPeople(api, clientId, signal),
  });
}
