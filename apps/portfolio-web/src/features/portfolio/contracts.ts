import { z } from "zod";
import { sectorLabel } from "@/shared/domain/sector";
// Verified boundary projection: capirov2 ClientsService / Client Prisma model.
// Extra backend fields are stripped; this app does not own or invent their semantics.
export const clientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  website: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  productDescription: z.string().nullable().optional(),
  profileType: z.string().nullable().optional(),
  profileStatus: z.string(),
  status: z.string(),
  sectorTag: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  primaryContactName: z.string().nullable().optional(),
  primaryContactEmail: z.string().nullable().optional(),
  primaryContactPhone: z.string().nullable().optional(),
  intakeData: z
    .object({ profileNotes: z.string().optional() })
    .passthrough()
    .nullable()
    .optional(),
  submissionTracks: z.array(z.string()).optional(),
  issueCodes: z.array(z.string()).optional(),
  uei: z.string().nullable().optional(),
  cageCode: z.string().nullable().optional(),
  naicsCodes: z.array(z.string()).optional(),
  pscCodes: z.array(z.string()).optional(),
  setAsideCertifications: z.array(z.string()).optional(),
  applicantTypes: z.array(z.string()).optional(),
});
export type Client = z.infer<typeof clientSchema>;
export function clientSectors(client: Client): string[] {
  const stored = client.intakeData?.sectors;
  const sectors = Array.isArray(stored)
    ? stored
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const fallback = client.sectorTag?.trim();
  return [...new Set(sectors.length ? sectors : fallback ? [fallback] : [])];
}
export function clientSectorLabel(client: Client): string | null {
  const primary = clientSectors(client)[0];
  return primary ? sectorLabel(primary) : null;
}
export function clientLocation(client: Client): string | null {
  const city = client.intakeData?.city;
  const state = client.intakeData?.state;
  const parts = [city, state]
    .filter((part): part is string => typeof part === "string")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
export const memberSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});
export type Member = z.infer<typeof memberSchema>;
export const ownerSchema = z.object({
  accountOwnerUserId: z.string().nullable(),
  accountOwner: memberSchema.nullable(),
});
export const ownersSchema = z.record(z.string(), ownerSchema);
export const memberName = (member: Member | undefined | null) =>
  member
    ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ||
      member.email
    : "Unassigned";
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
export function safeWebsite(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export const createProfileSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required.").max(200),
  website: z
    .string()
    .trim()
    .refine(
      (value) => !value || Boolean(safeWebsite(value)),
      "Enter a valid website.",
    ),
  description: z.string().trim(),
  sectorTag: z.string().trim(),
  primaryContactName: z.string().trim(),
  primaryContactEmail: z.union([z.email(), z.literal("")]),
  primaryContactPhone: z.string().trim(),
  profileType: z.literal("CLIENT"),
});
export type CreateProfile = z.infer<typeof createProfileSchema>;
