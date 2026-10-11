import { z } from "zod";
import type { ApiClient } from "@/shared/api/http";
import {
  attachmentSchema,
  fileValidation,
  type Attachment,
} from "@/features/files/public";

export const MAIL_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export function mailFileValidation(file: Pick<File, "name" | "size" | "type">) {
  return (
    fileValidation(file) ??
    (file.size > MAIL_ATTACHMENT_BYTES
      ? "Email attachments must be 3 MiB or smaller per file."
      : null)
  );
}
export async function readMailAttachments(
  api: ApiClient,
  clientId: string,
  ids: string[],
) {
  z.uuid().parse(clientId);
  z.array(z.uuid())
    .max(5)
    .refine((items) => new Set(items).size === items.length)
    .parse(ids);
  if (!ids.length) return [];
  const rows = await api.request(
    "core",
    `engagement/attachments?clientId=${clientId}`,
    z
      .array(attachmentSchema.refine((row) => row.clientId === clientId))
      .refine(
        (items) => new Set(items.map((row) => row.id)).size === items.length,
      ),
  );
  return ids.map((id) => {
    const row = rows.find((item) => item.id === id);
    if (!row)
      throw new Error(
        "A selected attachment is no longer accessible. Remove it or refresh Files.",
      );
    return row;
  });
}
export function attachmentRefusal(row: Attachment) {
  if (row.usable !== true)
    return (
      row.blockedReason ??
      "Attachment readiness is not confirmed. Check scan status."
    );
  if (
    row.byteSize === null ||
    row.byteSize < 1 ||
    row.byteSize > MAIL_ATTACHMENT_BYTES
  )
    return "This attachment exceeds the email limit or its size is unverified.";
  return null;
}
