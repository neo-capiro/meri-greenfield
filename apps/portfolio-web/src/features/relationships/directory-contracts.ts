import { z } from "zod";
export const directoryKinds = [
  "congress",
  "staff",
  "state",
  "committee",
] as const;
export type DirectoryKind = (typeof directoryKinds)[number];
export type DirectoryResult = {
  id: string;
  name: string;
  title: string;
  meta: string;
  directory: "congress" | "staff" | "state";
  current?: boolean;
};
export type DirectoryPage = {
  rows: DirectoryResult[];
  total: number;
  page: number;
  pageSize: number;
};
const page = {
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
};
export const memberSearchSchema = z.object({
  ...page,
  contacts: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      title: z.string(),
      chamber: z.string(),
      state: z.string(),
      party: z.string(),
    }),
  ),
});
export const peopleSearchSchema = z.object({
  ...page,
  people: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      title: z.string(),
      personType: z.literal("staff"),
      isCurrent: z.boolean(),
      state: z.string().nullable(),
      party: z.string().nullable(),
    }),
  ),
});
export const stateSearchSchema = z.object({
  total: page.total,
  rows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      chamber: z.string(),
      state: z.string(),
      party: z.string().nullable(),
      district: z.string(),
    }),
  ),
});
export const committeeSchema = z.object({
  id: z.string(),
  officeId: z.number().int(),
  parentOfficeId: z.number().int().nullable(),
  name: z.string(),
  chamber: z.string(),
  kind: z.string(),
  staffCount: z.number().int().nonnegative(),
});
export const committeeSearchSchema = z.object({
  ...page,
  committees: z.array(committeeSchema),
});
export type Committee = z.infer<typeof committeeSchema>;
export const committeeStaffSchema = z.object({
  ...page,
  committee: committeeSchema.nullable(),
  staff: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      title: z.string(),
      isCurrent: z.boolean(),
      committee: z.object({ id: z.string(), name: z.string() }),
    }),
  ),
});
const method = z.object({
  type: z.string().nullable().optional(),
  value: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export const staffDetailSchema = z.object({
  id: z.string(),
  kind: z.literal("staff"),
  emails: z.array(method),
  positions: z.array(
    z.object({
      title: z.string().nullable(),
      officeName: z.string().nullable(),
      isCurrent: z.boolean(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
    }),
  ),
});
export const memberDetailSchema = z.object({
  id: z.string(),
  kind: z.literal("member"),
  socialContacts: z.array(method),
  offices: z.array(
    z.object({
      name: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
    }),
  ),
});
export const stateDetailSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string(),
});
export function committeeLabel(committee: Committee, committees: Committee[]) {
  const ancestors: string[] = [];
  const seen = new Set<number>([committee.officeId]);
  let parentId = committee.parentOfficeId;
  while (parentId !== null) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = committees.find((row) => row.officeId === parentId);
    if (!parent) break;
    ancestors.unshift(parent.name);
    parentId = parent.parentOfficeId;
  }
  return [committee.chamber, ...ancestors, committee.name].join(" / ");
}
