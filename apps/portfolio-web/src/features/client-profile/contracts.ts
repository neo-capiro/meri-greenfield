import { z } from "zod";
export const activitySchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  occurredAt: z.iso.datetime({ offset: true }),
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
  origin: z.enum(["recorded", "derived"]),
  dueAt: z.string().nullable(),
  settledAt: z.string().nullable(),
  pinned: z.boolean(),
});
export type Activity = z.infer<typeof activitySchema>;
export const facilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  clientId: z.string(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  congressionalDistrict: z.string().nullable(),
  employeeCount: z.number().nullable(),
  notes: z.string().nullable(),
  geocodeStatus: z.string().nullable().optional(),
  latitude: z.union([z.number(), z.string()]).nullable().optional(),
  longitude: z.union([z.number(), z.string()]).nullable().optional(),
});
export type Facility = z.infer<typeof facilitySchema>;
export const teamMemberSchema = z.object({
  id: z.string().nullable(),
  userId: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: z.string().nullable(),
  isOwner: z.boolean(),
  addedAt: z.string().nullable(),
});
