import { z } from "zod";
import { safeWebsite, type Client } from "@/features/portfolio/public";
import { validDay } from "@/shared/date/civil";
import { businessFlags } from "./catalog";

export const intakeFormSchema = z.object({
  name: z.string().trim().min(1, "Legal name is required.").max(200),
  website: z
    .string()
    .trim()
    .min(1, "Website is required.")
    .refine((v) => Boolean(safeWebsite(v)), "Enter a valid website."),
  description: z.string().trim().min(1, "Company description is required."),
  primaryContactEmail: z.union([z.email(), z.literal("")]),
  primaryContactPhone: z.string(),
  primaryContactName: z.string(),
  cageCode: z.string().max(5, "CAGE code must be at most 5 characters."),
  uei: z.string().max(12, "UEI must be at most 12 characters."),
  ein: z.string(),
  samStatus: z.string(),
  samExpirationDate: z.string(),
  ldaRegistrantName: z.string(),
  naicsCodes: z.array(z.string()),
  pscCodes: z.array(z.string()),
  applicantTypes: z.array(z.string()),
  setAsideCertifications: z.array(z.string()),
  sectors: z.array(z.string()),
  submissionTracks: z.array(z.string()),
  issueCodes: z.array(z.string()),
  fundingPriorities: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(120, "Each funding priority is limited to 120 characters."),
    )
    .max(20, "Use at most 20 funding priorities."),
  engagementStartDate: z.string(),
  internalNotes: z.string(),
  sbClassification: z.record(z.string(), z.boolean()),
});
export type IntakeForm = z.infer<typeof intakeFormSchema>;
export type IntakeField = keyof IntakeForm;
export const stepFields: readonly (readonly IntakeField[])[] = [
  [
    "name",
    "website",
    "description",
    "primaryContactEmail",
    "primaryContactPhone",
    "sbClassification",
  ],
  [
    "cageCode",
    "uei",
    "ein",
    "samStatus",
    "samExpirationDate",
    "ldaRegistrantName",
    "naicsCodes",
    "pscCodes",
    "applicantTypes",
    "setAsideCertifications",
  ],
  [
    "sectors",
    "fundingPriorities",
    "submissionTracks",
    "issueCodes",
    "engagementStartDate",
    "primaryContactName",
    "internalNotes",
  ],
];
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
export function clientToIntake(client?: Client): IntakeForm {
  const intake = record(client?.intakeData);
  const business = record(intake.sbClassification);
  return {
    name: client?.name ?? "",
    website: client?.website ?? "",
    description: client?.description ?? "",
    primaryContactEmail: client?.primaryContactEmail ?? "",
    primaryContactPhone: client?.primaryContactPhone ?? "",
    primaryContactName: client?.primaryContactName ?? "",
    cageCode: client?.cageCode ?? text(intake.cageCode),
    uei: client?.uei ?? text(intake.uei),
    ein: text(intake.ein),
    samStatus: text(intake.samStatus),
    samExpirationDate: text(intake.samExpirationDate),
    ldaRegistrantName: text(intake.ldaRegistrantName),
    naicsCodes: client?.naicsCodes ?? [],
    pscCodes: client?.pscCodes ?? [],
    applicantTypes: client?.applicantTypes ?? [],
    setAsideCertifications: client?.setAsideCertifications ?? [],
    sectors: strings(intake.sectors).length
      ? strings(intake.sectors)
      : client?.sectorTag
        ? [client.sectorTag]
        : [],
    fundingPriorities: strings(intake.fundingPriorities),
    submissionTracks: client?.submissionTracks ?? [],
    issueCodes: client?.issueCodes ?? [],
    engagementStartDate: text(intake.engagementStartDate),
    internalNotes: text(intake.internalNotes),
    sbClassification: Object.fromEntries(
      businessFlags.map(([key]) => [
        key,
        business[key] === true ||
          business[key] === "true" ||
          business[key] === 1,
      ]),
    ),
  };
}
export function validateIntake(
  values: IntakeForm,
  initial?: IntakeForm,
): Partial<Record<IntakeField, string>> {
  const errors: Partial<Record<IntakeField, string>> = {};
  const result = intakeFormSchema.safeParse(values);
  if (!result.success)
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && key in values)
        errors[key as IntakeField] ??= issue.message;
    }
  if (
    values.description.length > 600 &&
    values.description !== initial?.description
  )
    errors.description = "Company description is limited to 600 characters.";
  if (
    values.internalNotes.length > 2000 &&
    values.internalNotes !== initial?.internalNotes
  )
    errors.internalNotes = "Internal notes are limited to 2,000 characters.";
  if (
    values.ein.trim() &&
    !/^\d{2}-?\d{7}$/.test(values.ein.trim()) &&
    values.ein !== initial?.ein
  )
    errors.ein =
      "Enter nine digits, for example 12-3456789, or leave EIN empty.";
  for (const key of ["samExpirationDate", "engagementStartDate"] as const)
    if (values[key] && !validDay(values[key]))
      errors[key] = "Enter a valid date.";
  return errors;
}
export interface ClientProfileInput {
  name?: string;
  website?: string | null;
  description?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  uei?: string | null;
  cageCode?: string | null;
  sectorTag?: string | null;
  naicsCodes?: string[];
  pscCodes?: string[];
  applicantTypes?: string[];
  setAsideCertifications?: string[];
  submissionTracks?: string[];
  issueCodes?: string[];
  intakeData?: Record<string, unknown>;
  profileType?: "CLIENT";
  profileStatus?: "ACTIVE";
}
const codes = (values: string[]) => [
  ...new Set(values.map((v) => v.trim().toUpperCase()).filter(Boolean)),
];
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
// PUT has whole-object intakeData semantics. Apply only dirty wizard keys over
// a fresh server record; retain unrelated/unknown intake and top-level fields.
export function intakePayload(
  values: IntakeForm,
  initial?: IntakeForm,
  latest?: Client,
): ClientProfileInput {
  const changed = (key: IntakeField) =>
    !initial || !equal(values[key], initial[key]);
  const body: ClientProfileInput = initial
    ? {}
    : { profileType: "CLIENT", profileStatus: "ACTIVE" };
  if (changed("name")) body.name = values.name.trim();
  for (const key of [
    "website",
    "description",
    "primaryContactName",
    "primaryContactEmail",
    "primaryContactPhone",
    "uei",
    "cageCode",
  ] as const)
    if (changed(key)) {
      const value = values[key].trim();
      if (value || initial)
        body[key] = value
          ? key === "uei" || key === "cageCode"
            ? value.toUpperCase()
            : value
          : null;
    }
  for (const key of [
    "naicsCodes",
    "pscCodes",
    "applicantTypes",
    "setAsideCertifications",
    "submissionTracks",
    "issueCodes",
  ] as const)
    if (changed(key))
      body[key] =
        key === "naicsCodes" || key === "pscCodes"
          ? codes(values[key])
          : [...values[key]];
  const intake = { ...record(latest?.intakeData) };
  let intakeChanged = false;
  for (const key of [
    "samStatus",
    "samExpirationDate",
    "ldaRegistrantName",
    "ein",
    "sectors",
    "fundingPriorities",
    "engagementStartDate",
    "internalNotes",
    "sbClassification",
  ] as const)
    if (changed(key)) {
      intakeChanged = true;
      let value: unknown = values[key];
      if (typeof value === "string") value = value.trim();
      if (
        key === "ein" &&
        typeof value === "string" &&
        /^\d{2}-?\d{7}$/.test(value)
      )
        value = value.replace("-", "");
      if (key === "sbClassification") {
        const merged = { ...record(intake.sbClassification) };
        for (const [flag] of businessFlags) {
          if (
            initial &&
            values.sbClassification[flag] === initial.sbClassification[flag]
          )
            continue;
          if (values.sbClassification[flag]) merged[flag] = true;
          else delete merged[flag];
        }
        value = Object.keys(merged).length ? merged : undefined;
      }
      if (
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && !value.length)
      )
        delete intake[key];
      else intake[key] = value;
    }
  if (changed("sectors")) body.sectorTag = values.sectors[0] ?? null;
  if (intakeChanged) body.intakeData = intake;
  return body;
}
