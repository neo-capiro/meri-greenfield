"use client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "../api/provider";
export const identitySchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().nullable(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
  }),
  tenant: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  role: z.string().nullable().optional(),
  billingAdmin: z.boolean().optional(),
});
export function useIdentity() {
  const api = useApi();
  return useQuery({
    queryKey: ["identity"],
    queryFn: ({ signal }) =>
      api.request("core", "me", identitySchema, { signal }),
  });
}
export const canAdminister = (role: string | null | undefined) =>
  role === "user_admin" || role === "capiro_admin";
