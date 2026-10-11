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
  const invalid = fileValidation(file);
  if (invalid) throw new Error(invalid);
  const metadata = {
    clientId,
    fileName: file.name,
    contentType: contentType(file)!,
  };
  if (!attempt.bytesUploaded) {
    onStage("Preparing upload");
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
    const response = await transport(url, {
      method: "POST",
      body: form,
      credentials: "omit",
      redirect: "error",
    });
    if (!response.ok)
      throw new Error("Storage upload failed. Retry this file.");
    attempt.ticket = ticket;
    attempt.bytesUploaded = true;
  }
  if (!attempt.ticket)
    throw new Error("Upload confirmation is missing its storage reference.");
  onStage("Confirming upload");
  return api.request(
    "core",
    "engagement/attachments/confirm",
    attachmentSchema,
    {
      method: "POST",
      body: { ...metadata, s3Key: attempt.ticket.s3Key, source },
    },
  );
}
