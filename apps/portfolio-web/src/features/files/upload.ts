import type { ApiClient } from "@/shared/api/http";
import {
  attachmentSchema,
  contentType,
  fileValidation,
  signedUrl,
  uploadTicketSchema,
  type UploadTicket,
} from "./contracts";
export interface UploadAttempt {
  ticket?: UploadTicket;
  bytesUploaded?: boolean;
  storageUnknown?: boolean;
  scope?: string;
  file?: File;
}
export interface UploadParent {
  clientId?: string | null;
  meetingId?: string;
}
export async function uploadFile(
  api: ApiClient,
  clientId: string,
  file: File,
  attempt: UploadAttempt,
  onStage: (stage: string) => void,
  source = "manual",
  transport: typeof fetch = fetch,
) {
  return uploadParentFile(
    api,
    { clientId },
    file,
    attempt,
    onStage,
    source,
    transport,
  );
}
/** Shared upload transport. Parent authorization and byte verification remain server-owned. */
export async function uploadParentFile(
  api: ApiClient,
  parent: UploadParent,
  file: File,
  attempt: UploadAttempt,
  onStage: (stage: string) => void,
  source = "manual",
  transport: typeof fetch = fetch,
  beforeDispatch?: () => void,
) {
  const invalid = fileValidation(file);
  if (invalid) throw new Error(invalid);
  if (!parent.clientId && !parent.meetingId)
    throw new Error("Choose a client or meeting before uploading.");
  const metadata = {
    ...(parent.clientId ? { clientId: parent.clientId } : {}),
    ...(parent.meetingId ? { meetingId: parent.meetingId } : {}),
    fileName: file.name,
    contentType: contentType(file)!,
  };
  const scope = JSON.stringify({ ...metadata, source });
  if (
    (attempt.scope && attempt.scope !== scope) ||
    (attempt.file && attempt.file !== file)
  )
    throw new Error(
      "This upload attempt belongs to another file or parent. Start a new upload.",
    );
  attempt.scope = scope;
  attempt.file = file;
  if (!attempt.bytesUploaded && !attempt.storageUnknown) {
    onStage("Preparing upload");
    beforeDispatch?.();
    const ticket = await api.request(
      "core",
      "engagement/attachments/upload-url",
      uploadTicketSchema,
      { method: "POST", body: { ...metadata, contentLength: file.size } },
    );
    const url = signedUrl(ticket.url);
    if (!url)
      throw new Error("The upload service returned an invalid destination.");
    const form = new FormData();
    for (const [key, value] of Object.entries(ticket.fields))
      form.append(key, value);
    form.append("file", file);
    onStage("Uploading bytes");
    attempt.ticket = ticket;
    beforeDispatch?.();
    let response: Response;
    try {
      response = await transport(url, {
        method: "POST",
        body: form,
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      attempt.storageUnknown = true;
      throw new Error(
        "Upload completion is unknown. Retry confirmation before uploading another copy.",
      );
    }
    if (!response.ok)
      throw new Error("Storage upload failed. Retry this file.");
    attempt.ticket = ticket;
    attempt.bytesUploaded = true;
  }
  if (!attempt.ticket)
    throw new Error("Upload confirmation is missing its storage reference.");
  onStage("Confirming upload");
  beforeDispatch?.();
  const receiptSchema = parent.meetingId
    ? attachmentSchema
        .extend({
          meetingId: attachmentSchema.shape.id,
          s3Key: uploadTicketSchema.shape.s3Key,
        })
        .refine(
          (receipt) =>
            receipt.meetingId === parent.meetingId &&
            receipt.clientId === (parent.clientId ?? null) &&
            receipt.s3Key === attempt.ticket?.s3Key &&
            receipt.fileName === metadata.fileName &&
            receipt.contentType === metadata.contentType,
        )
    : attachmentSchema.refine(
        (receipt) =>
          receipt.clientId === parent.clientId &&
          receipt.fileName === metadata.fileName &&
          receipt.contentType === metadata.contentType,
      );
  const receipt = await api.request(
    "core",
    "engagement/attachments/confirm",
    receiptSchema,
    {
      method: "POST",
      body: { ...metadata, s3Key: attempt.ticket.s3Key, source },
    },
  );
  attempt.bytesUploaded = true;
  attempt.storageUnknown = false;
  return receipt;
}
