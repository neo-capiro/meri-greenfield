import { z } from "zod";
export const hierarchyLevels = [
  "executive",
  "c_suite",
  "senior_leadership",
  "leadership",
  "management",
  "team",
] as const;
export const personSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  name: z.string(),
  title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.string().nullable(),
  notes: z.string().nullable(),
  hierarchyLevel: z.enum(hierarchyLevels).nullable(),
  reportsToPersonId: z.string().uuid().nullable(),
  placementSource: z.enum(["manual", "auto_title"]),
  reviewRequired: z.boolean(),
  createdAt: z.string(),
});
export type Person = z.infer<typeof personSchema>;
export const contactInput = z.object({
  name: z.string().trim().min(1).max(300),
  title: z.string().max(300),
  email: z.union([z.email(), z.literal("")]),
  phone: z.string().max(120),
  role: z.string().max(300),
  notes: z.string().max(20000),
});
export function levelLabel(level: Person["hierarchyLevel"]) {
  return level ? level.replaceAll("_", " ") : "Not placed";
}
export function reportingCycle(people: Person[], id: string, manager: string) {
  const seen = new Set<string>([id]);
  let cursor: string | null = manager;
  while (cursor) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor =
      people.find((person) => person.id === cursor)?.reportsToPersonId ?? null;
  }
  return false;
}
export function titleOverlaps(people: Person[]) {
  const count = new Map<string, number>();
  people.forEach((person) => {
    const key = person.title?.trim().toLowerCase();
    if (key) count.set(key, (count.get(key) ?? 0) + 1);
  });
  return people.filter(
    (person) =>
      person.title && (count.get(person.title.trim().toLowerCase()) ?? 0) > 1,
  );
}
