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
export const activityEditSchema = z.object({
  title: z.string().trim().min(1, "Enter an activity title.").max(300),
  body: z.string().trim().max(5000),
});
export type ActivityEdit = z.infer<typeof activityEditSchema>;
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
  stateHouseDistrict: z.string().nullable().optional(),
  stateSenateDistrict: z.string().nullable().optional(),
  districtSource: z.string().nullable().optional(),
  congressionalDistrictCongress: z.number().int().nullable().optional(),
  geocodedAt: z.string().nullable().optional(),
  geocodeMatchedAddress: z.string().nullable().optional(),
  geocodeLastError: z.string().nullable().optional(),
  geocodeNextAttemptAt: z.string().nullable().optional(),
  geocodeAttemptCount: z.number().int().nullable().optional(),
  geocodeCandidateRevision: z
    .string()
    .regex(/^v1:[0-9a-f]{64}$/)
    .optional(),
  geocodeCandidates: z
    .array(
      z.object({
        matchedAddress: z.string().nullable(),
        congressionalDistrict: z.string().nullable(),
        state: z.string().nullable(),
        latitude: z.number().nullable(),
        longitude: z.number().nullable(),
      }),
    )
    .nullable()
    .optional(),
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
