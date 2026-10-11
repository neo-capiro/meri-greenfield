import { z } from "zod";
export const capabilitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  description: z.string().nullable(),
  sector: z.string().nullable(),
  tags: z.array(z.string()),
  issueCodes: z.array(z.string()),
  trl: z.number().int().min(1).max(9).nullable(),
  mrl: z.number().int().min(1).max(10).nullable(),
  peNumber: z.string().nullable(),
  peNumbers: z.array(z.string()),
  keywords: z.array(z.string()),
  notes: z.string().nullable(),
});
export type Capability = z.infer<typeof capabilitySchema>;
export const capabilityInputSchema = capabilitySchema
  .omit({
    id: true,
    peNumber: true,
  })
  .extend({
    name: z.string().trim().min(1, "Capability name is required.").max(300),
    type: z.string().trim().min(1, "Capability type is required.").max(120),
    description: z.string().max(20000).nullable(),
    notes: z.string().max(20000).nullable(),
  });
export type CapabilityInput = z.infer<typeof capabilityInputSchema>;
export const fitSchema = z.object({
  status: z.enum(["ready", "empty", "profile_too_thin", "stale"]),
  computedAt: z.string().nullable(),
  emptyReason: z.string().optional(),
  matches: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["pe", "bill", "fo"]),
      targetId: z.string(),
      target: z.string(),
      why: z.string(),
      fit: z.number().min(0).max(100),
      capabilityIds: z.array(z.string()),
      href: z.string().nullable().optional(),
    }),
  ),
});
// Existing Portfolio TRL classification, revalidated against the current client
// capability contract: 1–3 research, 4–6 prototype, 7–9 fielded.
export const maturity = (trl: number | null) =>
  trl === null
    ? "Not set"
    : trl >= 7
      ? "Fielded"
      : trl >= 4
        ? "Prototype"
        : "Research";
export function fitLink(
  href: string | undefined | null,
  existingApp: string | undefined,
) {
  return existingApp &&
    href?.startsWith("/") &&
    !href.startsWith("//") &&
    !href.includes("\\")
    ? `${existingApp}${href}`
    : undefined;
}
