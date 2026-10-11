import { z } from "zod";

const federalMember = z.object({
  bioguideId: z.string(),
  fullName: z.string(),
  party: z.string().nullable(),
  state: z.string().nullable(),
  district: z.number().nullable(),
  chamber: z.string(),
});
const stateMember = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  chamber: z.string().nullable(),
  district: z.string().nullable(),
  party: z.string().nullable(),
  url: z.string().nullable(),
});
export const representationSchema = z.array(
  z.object({
    facility: z.object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable(),
      state: z.string().nullable(),
    }),
    representation: z.discriminatedUnion("unresolved", [
      z.object({
        unresolved: z.literal(true),
        reason: z.enum(["no_geocode", "no_state"]),
      }),
      z.object({
        unresolved: z.literal(false),
        federal: z.object({
          house: federalMember.nullable(),
          senate: z.array(federalMember),
        }),
        state: z.object({
          lower: stateMember.nullable(),
          upper: stateMember.nullable(),
        }),
      }),
    ]),
  }),
);
export type FacilityRepresentation = z.infer<
  typeof representationSchema
>[number]["representation"];

const position = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
export const boundaryCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      id: z.string(),
      geometry: z.discriminatedUnion("type", [
        z.object({
          type: z.literal("Polygon"),
          coordinates: z.array(z.array(position)),
        }),
        z.object({
          type: z.literal("MultiPolygon"),
          coordinates: z.array(z.array(z.array(position))),
        }),
      ]),
      properties: z.object({
        state: z.string(),
        districtCode: z.string(),
        status: z.literal("C"),
        vintage: z.string(),
        legislativeDistrictId: z.string().nullable(),
        name: z.string().nullable(),
        centroid: position,
      }),
    }),
  ),
});
export type BoundaryCollection = z.infer<typeof boundaryCollectionSchema>;
export const boundaryManifestSchema = z.object({
  status: z.literal("current"),
  vintage: z.string(),
  generatedAt: z.string(),
  districtCount: z.number().int().nonnegative(),
  source: z.string(),
  hash: z.string().min(1),
  warnings: z.array(z.string()),
});
const breakdown = z.object({
  component: z.string(),
  label: z.string(),
  weight: z.number(),
  credit: z.number(),
  rationale: z.string(),
  evidenceCount: z.number().int(),
});
export const facilityNexusSchema = z.object({
  clientId: z.string(),
  score: z.number().nullable(),
  coveragePercent: z.number(),
  breakdown: z.array(breakdown),
  generatedAt: z.string(),
  districts: z.array(
    z.object({ districtKey: z.string(), score: z.number().nullable() }),
  ),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })),
  freshness: z.array(
    z.object({
      source: z.string(),
      label: z.string(),
      lastSyncedAt: z.string().nullable(),
      neverSynced: z.boolean(),
      freshnessUnavailable: z.boolean().optional(),
    }),
  ),
});
