import { z } from "zod";

const id = z.number().int().positive();
export const registrantSchema = z.object({
  ldaRegistrantId: id.nullable(),
  ldaRegistrantName: z.string().nullable(),
});
export const registrantHitsSchema = z.array(
  z.object({
    id,
    name: z.string().min(1),
    city: z.string().nullable(),
    state: z.string().nullable(),
    totalClients: z.number().int().nonnegative(),
    totalFilings: z.number().int().nonnegative(),
  }),
);
export const candidateSchema = z.object({
  ldaClientId: id,
  name: z.string().min(1),
  filings: z.number().int().nonnegative(),
  latestFilingYear: z.number().int().nullable(),
  totalSpend: z.number().finite(),
  onboardedAs: z.string().nullable(),
});
export const candidatesSchema = z.object({
  registrantId: id.nullable(),
  registrantName: z.string().nullable(),
  candidates: z.array(candidateSchema),
});
export const importReceiptSchema = z.object({
  created: z.number().int().nonnegative(),
  items: z.array(
    z.object({ id: z.string().min(1), name: z.string(), ldaClientId: id }),
  ),
  skipped: z.array(z.object({ ldaClientId: id, reason: z.string().min(1) })),
});
export type Registrant = z.infer<typeof registrantSchema>;
export type RegistrantHit = z.infer<typeof registrantHitsSchema>[number];
export type Candidate = z.infer<typeof candidateSchema>;
export type Candidates = z.infer<typeof candidatesSchema>;
export type ImportReceipt = z.infer<typeof importReceiptSchema>;
