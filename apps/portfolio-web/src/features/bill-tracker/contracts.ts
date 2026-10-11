import { z } from "zod";
export const billStageSchema = z.enum([
  "introduced",
  "committee",
  "passed",
  "enacted",
]);
const common = z.object({
  billId: z.string().min(1),
  displayNum: z.string(),
  title: z.string().nullable(),
  stage: billStageSchema,
  latestActionText: z.string().nullable().optional(),
  latestActionDate: z.string().nullable().optional(),
  canonicalStatus: z.string().nullable().optional(),
  unread: z.boolean(),
  note: z.string().nullable().optional(),
  trackedAt: z.string().nullable().optional(),
});
export const coreBoardSchema = z.object({
  columns: z.array(
    z.object({
      id: billStageSchema,
      label: z.string(),
      bills: z.array(
        common.extend({
          probability: z.number().min(0).max(1),
          tags: z.array(z.string()),
          change: z.object({ label: z.string(), tone: z.string() }).nullable(),
        }),
      ),
    }),
  ),
  total: z.number().int().nonnegative(),
});
export const intelBoardSchema = z
  .object({
    columns: z.array(
      z.object({
        id: billStageSchema,
        label: z.string(),
        cards: z.array(
          common.extend({
            passageProbability: z.number().min(0).max(1),
            matchedTags: z.array(z.string()),
            changeChip: z
              .object({ label: z.string(), tone: z.string() })
              .nullable(),
            terminalRisk: z.boolean(),
            jurisdiction: z.string().optional(),
            hearingCount: z.number().int().nonnegative(),
            lastHearingSessionId: z.string().nullable(),
          }),
        ),
      }),
    ),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    withheld: z.number().int().nonnegative(),
  })
  .refine(
    (page) => page.hasMore === Boolean(page.nextCursor),
    "Invalid board pagination",
  );
export const billSearchSchema = z.array(
  z.object({
    billId: z.string().min(1),
    displayNum: z.string(),
    title: z.string().nullable(),
    stage: billStageSchema,
    probability: z.number().min(0).max(1),
    jurisdiction: z.string().optional(),
  }),
);
export const corpusSchema = z.object({
  jurisdictions: z.array(
    z.object({
      key: z.string().regex(/^[A-Z]{2}$/),
      count: z.number().int().nonnegative(),
    }),
  ),
});
export type TrackedBill = z.infer<typeof common> & {
  probability: number;
  tags: string[];
  changeLabel?: string;
  changeTone?: string;
  terminalRisk: boolean;
  jurisdiction?: string;
  hearingCount?: number;
  lastHearingSessionId?: string | null;
};
export type BoardPage = {
  columns: {
    id: z.infer<typeof billStageSchema>;
    label: string;
    bills: TrackedBill[];
  }[];
  total: number;
  nextCursor: string | null;
  withheld: number;
};
export function coreBoard(data: z.infer<typeof coreBoardSchema>): BoardPage {
  return {
    columns: data.columns.map((column) => ({
      ...column,
      bills: column.bills.map((bill) => ({
        ...bill,
        changeLabel: bill.change?.label,
        changeTone: bill.change?.tone,
        terminalRisk: false,
      })),
    })),
    total: data.total,
    nextCursor: null,
    withheld: 0,
  };
}
export function intelBoard(data: z.infer<typeof intelBoardSchema>): BoardPage {
  return {
    columns: data.columns.map((column) => ({
      id: column.id,
      label: column.label,
      bills: column.cards.map((bill) => ({
        ...bill,
        probability: bill.passageProbability,
        tags: bill.matchedTags,
        changeLabel: bill.changeChip?.label,
        changeTone: bill.changeChip?.tone,
      })),
    })),
    total: data.total,
    nextCursor: data.nextCursor,
    withheld: data.withheld,
  };
}
export const coreTrackSchema = z.object({ tracked: z.literal(true) });
export const coreUntrackSchema = z.object({ untracked: z.literal(true) });
export const intelTrackSchema = z.object({
  billId: z.string(),
  clientId: z.string(),
});
export const intelUntrackSchema = z.object({
  ok: z.literal(true),
  removed: z.number().int().nonnegative(),
});
