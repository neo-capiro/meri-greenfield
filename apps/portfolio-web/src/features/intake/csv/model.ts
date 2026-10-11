import { z } from "zod";
import { safeWebsite } from "@/features/portfolio/public";
export const csvFields = [
  "name",
  "website",
  "description",
  "productDescription",
  "primaryContactName",
  "primaryContactEmail",
  "primaryContactPhone",
  "sectorTag",
] as const;
export type CsvField = (typeof csvFields)[number];
export const csvRowSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required.").max(200),
  website: z
    .string()
    .refine((value) => Boolean(safeWebsite(value)), "Enter a valid website.")
    .optional(),
  description: z.string().optional(),
  productDescription: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.email().optional(),
  primaryContactPhone: z.string().optional(),
  sectorTag: z.string().optional(),
  profileType: z.literal("CLIENT"),
  profileStatus: z.literal("ACTIVE"),
});
export type CsvClientRow = z.infer<typeof csvRowSchema>;
export interface CsvRecord {
  cells: string[];
  line: number;
}
export function parseClientCsv(text: string): CsvRecord[] {
  if (new TextEncoder().encode(text).length > 1_048_576)
    throw new Error("Use a CSV file no larger than 1 MB.");
  const input = text.replace(/^\uFEFF/, "");
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let value = "";
  let quoted = false;
  let closed = false;
  let line = 1;
  let start = 1;
  function cell() {
    cells.push(value);
    value = "";
    closed = false;
  }
  function record() {
    cell();
    if (cells.some((value) => value.trim()))
      records.push({ cells, line: start });
    cells = [];
    if (records.length > 501)
      throw new Error("Import at most 500 client rows plus a header.");
  }
  for (let index = 0; index < input.length; index++) {
    const ch = input[index];
    if (quoted) {
      if (ch === '"') {
        if (input[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        value += ch;
        if (ch === "\n" || (ch === "\r" && input[index + 1] !== "\n")) line++;
      }
      continue;
    }
    if (ch === ",") {
      cell();
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      record();
      if (ch === "\r" && input[index + 1] === "\n") index++;
      line++;
      start = line;
      continue;
    }
    if (ch === '"') {
      if (value.length || closed)
        throw new Error(`Unexpected quote on line ${line}.`);
      quoted = true;
      continue;
    }
    if (closed)
      throw new Error(`Unexpected text after a quoted value on line ${line}.`);
    value += ch;
  }
  if (quoted)
    throw new Error(`Unclosed quoted value starting on line ${start}.`);
  if (value.length || cells.length || closed) record();
  if (records.length < 2)
    throw new Error("Include a header and at least one client row.");
  const header = records[0];
  if (!header) throw new Error("Include a CSV header.");
  const width = header.cells.length;
  if (width > 50) throw new Error("Use no more than 50 columns.");
  if (records.some((row) => row.cells.length !== width))
    throw new Error(
      "Each row must have the same number of columns as the header.",
    );
  return records;
}
export function defaultMapping(header: string[]): (CsvField | "")[] {
  const used = new Set<string>();
  return header.map((value) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const field = csvFields.find((field) => field.toLowerCase() === normalized);
    if (!field || used.has(field)) return "";
    used.add(field);
    return field;
  });
}
export function mapClientCsv(records: CsvRecord[], mapping: (CsvField | "")[]) {
  const selected = mapping.filter(Boolean);
  if (new Set(selected).size !== selected.length)
    throw new Error("Map each client field only once.");
  if (!selected.includes("name"))
    throw new Error("Map an organization name column.");
  return records.slice(1).map((record) => {
    const input: Record<string, string> = {
      profileType: "CLIENT",
      profileStatus: "ACTIVE",
    };
    mapping.forEach((field, index) => {
      const value = record.cells[index]?.trim();
      if (field && value) input[field] = value;
    });
    const result = csvRowSchema.safeParse(input);
    return {
      line: record.line,
      cells: record.cells,
      row: result.success ? result.data : undefined,
      error: result.success
        ? undefined
        : result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" "),
    };
  });
}
