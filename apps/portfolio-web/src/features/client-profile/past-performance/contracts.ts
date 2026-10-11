import { z } from "zod";
export const submissionSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  clientId: z.uuid(),
  capabilityId: z.uuid().nullable(),
  fiscalYear: z.string(),
  title: z.string(),
  meta: z.string().nullable(),
  outcome: z.string().nullable(),
  outcomeType: z.string(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type SavedSubmission = z.infer<typeof submissionSchema>;
