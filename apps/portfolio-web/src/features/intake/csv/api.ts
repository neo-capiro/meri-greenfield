import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { csvRowSchema, type CsvClientRow } from "./model";
export const csvReceiptSchema = z.object({
  created: z.number().int().nonnegative(),
  total: z.number().int().min(1).max(500),
  errors: z.array(
    z.object({
      row: z.number().int().nonnegative(),
      field: z.string().optional(),
      message: z.string(),
    }),
  ),
  items: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export type CsvReceipt = z.infer<typeof csvReceiptSchema>;
export function verifyCsvReceipt(receipt: CsvReceipt, rows: CsvClientRow[]) {
  const failed = new Set(receipt.errors.map((error) => error.row));
  const expected = rows.filter((_, index) => !failed.has(index));
  return (
    receipt.total === rows.length &&
    receipt.created === receipt.items.length &&
    receipt.created + receipt.errors.length === rows.length &&
    failed.size === receipt.errors.length &&
    receipt.errors.every((error) => error.row < rows.length) &&
    new Set(receipt.items.map((item) => item.id)).size ===
      receipt.items.length &&
    expected.every(
      (row, index) => receipt.items[index]?.name === row.name.trim(),
    )
  );
}
export async function importCsvClients(
  api: ApiClient,
  rows: CsvClientRow[],
  guard: () => void,
  signal: AbortSignal,
  dispatched: () => void,
) {
  const body = { rows: z.array(csvRowSchema).min(1).max(500).parse(rows) };
  guard();
  signal.throwIfAborted();
  dispatched();
  const receipt = await api.request(
    "core",
    "clients/bulk-import",
    csvReceiptSchema,
    { method: "POST", body, signal },
  );
  guard();
  if (!verifyCsvReceipt(receipt, body.rows))
    throw new ApiError(
      502,
      "The import receipt does not account for every submitted row. Inspect Portfolio before importing again.",
    );
  return receipt;
}
