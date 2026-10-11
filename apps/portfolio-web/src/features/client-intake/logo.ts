import { z } from "zod";
import type { ApiClient } from "@/shared/api/http";
import { clientReceipt } from "./profile-api";

export const logoTypes = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
] as const;
export const maxLogoBytes = 2 * 1024 * 1024;
const ticketSchema = z
  .object({
    url: z.url().refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    }),
    fields: z.record(z.string(), z.string()),
    s3Key: z.string().min(1),
  })
  .refine(
    (ticket) => ticket.fields.key === ticket.s3Key,
    "Upload key does not match the signed form.",
  );
export type LogoAttempt = {
  file: File;
  ticket?: z.infer<typeof ticketSchema>;
  bytesUploaded?: boolean;
};
export function validateLogo(
  file: Pick<File, "size" | "type">,
): string | undefined {
  if (!(logoTypes as readonly string[]).includes(file.type))
    return "Choose a PNG, JPEG, SVG or WebP logo.";
  if (file.size < 1 || file.size > maxLogoBytes)
    return "Logo must be between 1 byte and 2 MB.";
}
// A failed confirmation retries the same staged object; it never silently
// creates another client or retransmits successfully uploaded bytes.
export async function uploadClientLogo(
  api: ApiClient,
  clientId: string,
  attempt: LogoAttempt,
  transport: typeof fetch = fetch,
  assertCurrent?: () => void,
  signal?: AbortSignal,
) {
  const invalid = validateLogo(attempt.file);
  if (invalid) throw new Error(invalid);
  assertCurrent?.();
  if (!attempt.bytesUploaded) {
    const ticket = await api.request(
      "core",
      `clients/${encodeURIComponent(clientId)}/logo/upload-url`,
      ticketSchema,
      {
        method: "POST",
        signal,
        body: {
          contentType: attempt.file.type,
          contentLength: attempt.file.size,
        },
      },
    );
    assertCurrent?.();
    const form = new FormData();
    for (const [key, value] of Object.entries(ticket.fields))
      form.append(key, value);
    form.append("file", attempt.file);
    const response = await transport(ticket.url, {
      method: "POST",
      body: form,
      credentials: "omit",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error("Logo storage upload failed. Retry the upload.");
    attempt.ticket = ticket;
    attempt.bytesUploaded = true;
  }
  assertCurrent?.();
  if (!attempt.ticket)
    throw new Error("Logo upload reference is missing. Select the file again.");
  const saved = await api.request(
    "core",
    `clients/${encodeURIComponent(clientId)}/logo/confirm`,
    clientReceipt(clientId),
    {
      method: "POST",
      signal,
      body: { s3Key: attempt.ticket.s3Key, contentType: attempt.file.type },
    },
  );
  assertCurrent?.();
  return saved;
}
