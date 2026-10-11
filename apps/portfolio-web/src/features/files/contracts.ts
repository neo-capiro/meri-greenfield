import { z } from "zod";
export const attachmentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().nullable(),
  fileName: z.string(),
  contentType: z.string(),
  byteSize: z.number().nullable(),
  source: z.string(),
  folder: z.string().nullable(),
  viewerMode: z.enum(["all", "restricted"]),
  viewerUserIds: z.array(z.string()),
  uploadedByUserId: z.string().nullable(),
  uploadedByName: z.string().nullable().optional(),
  createdAt: z.string(),
  lifecycleStatus: z.string(),
  scanStatus: z.string().nullable(),
  extractionStatus: z.string().nullable(),
  indexedAt: z.string().nullable(),
  usable: z.boolean().optional(),
  blockedReason: z.string().optional(),
  scanDisclosure: z.string().optional(),
  downloadUrl: z.string().nullable().optional(),
  previewUrl: z.string().nullable().optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;
export const accessSchema = attachmentSchema.pick({
  id: true,
  fileName: true,
  folder: true,
  viewerMode: true,
  viewerUserIds: true,
  uploadedByUserId: true,
});
export const uploadTicketSchema = z.object({
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  s3Key: z.string(),
});
export type UploadTicket = z.infer<typeof uploadTicketSchema>;
export const MAX_BYTES = 25 * 1024 * 1024;
// Verified Engagement allowlist. The server verifies actual bytes and scan readiness.
const extensions: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  tsv: "text/tab-separated-values",
};
export function contentType(file: Pick<File, "type" | "name">) {
  const mime =
    (
      file.type ||
      extensions[file.name.split(".").pop()?.toLowerCase() ?? ""] ||
      ""
    )
      .split(";")[0]
      ?.trim()
      .toLowerCase() ?? "";
  return mime !== "image/svg+xml" &&
    (Object.values(extensions).includes(mime) ||
      /^(image|audio|video)\//.test(mime))
    ? mime
    : null;
}
export function fileValidation(file: Pick<File, "type" | "name" | "size">) {
  if (!file.size) return "Empty files cannot be uploaded.";
  if (file.size > MAX_BYTES) return "Each file must be 25 MiB or smaller.";
  if (file.name.length > 240)
    return "File names must be 240 characters or shorter.";
  if (!contentType(file))
    return "Unsupported file type. Choose a document, image, audio or video file. SVG is not supported.";
  return null;
}
export function signedUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export const fileStatus = (file: Attachment) =>
  file.usable === false
    ? (file.blockedReason ?? file.lifecycleStatus)
    : file.extractionStatus === "extracted"
      ? "Text searchable"
      : file.extractionStatus === "truncated"
        ? "Text partial"
        : file.extractionStatus === "empty"
          ? "No readable text"
          : (file.extractionStatus ?? "Text status unavailable");
export function filterFiles(
  files: Attachment[],
  search: string,
  folder: string | undefined,
  source: string,
  sort: string,
) {
  return files
    .filter(
      (file) =>
        (!search ||
          file.fileName.toLowerCase().includes(search.toLowerCase())) &&
        (folder === undefined || file.folder === (folder || null)) &&
        (!source || file.source === source),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.fileName.localeCompare(b.fileName)
        : b.createdAt.localeCompare(a.createdAt),
    );
}
