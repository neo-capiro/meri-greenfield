import { z } from "zod";
export const targetDirectories = ["congress", "staff", "state"] as const;
export const targetSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  memberId: z.string(),
  sourceDirectory: z.enum(targetDirectories),
  memberName: z.string().nullable(),
  party: z.string().nullable(),
  state: z.string().nullable(),
  chamber: z.string().nullable(),
  committee: z.string().nullable(),
  staffKind: z.enum(["committee", "personal_office"]).nullable(),
  tier: z.number().int().min(1).max(3).nullable(),
  source: z.string(),
  addedAt: z.string(),
  representedFacilities: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .nullable()
    .optional(),
});
export type GovernmentTarget = z.infer<typeof targetSchema>;
export function targetKind(
  target: Pick<GovernmentTarget, "sourceDirectory" | "staffKind">,
) {
  if (target.sourceDirectory === "state") return "State legislator";
  if (target.sourceDirectory === "congress") return "Member of Congress";
  return target.staffKind === "committee"
    ? "Committee staff"
    : target.staffKind === "personal_office"
      ? "Personal-office staff"
      : "Staff · office type unknown";
}
export function targetProfileLink(
  base: string,
  target: Pick<GovernmentTarget, "sourceDirectory" | "memberId">,
) {
  const section =
    target.sourceDirectory === "congress"
      ? "members"
      : target.sourceDirectory === "state"
        ? "state-legislators"
        : "staff";
  return `${base}/directory/${section}/${encodeURIComponent(target.memberId)}`;
}
export const recommendationsSchema = z.object({
  computedAt: z.string().nullable(),
  recommendations: z.array(
    z.object({
      memberId: z.string(),
      office: z.string(),
      party: z.string().nullable(),
      state: z.string().nullable(),
      chamber: z.string().nullable(),
      committee: z.string().nullable(),
      score: z.number().min(0).max(1),
      tags: z.array(z.string()),
      billCount: z.number().int().nonnegative(),
    }),
  ),
});
