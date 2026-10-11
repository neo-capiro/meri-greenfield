import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { readMailAttachments, attachmentRefusal } from "./attachments";
import { mailRecipient } from "./recipients";

export const sendInputSchema = z.object({
  clientId: z.uuid(),
  personIds: z.array(z.uuid()).max(50).optional(),
  to: z.array(mailRecipient).min(1).max(50),
  cc: z.array(mailRecipient).max(10).optional(),
  bcc: z.array(mailRecipient).max(10).optional(),
  subject: z.string().trim().min(1).max(300),
  bodyHtml: z.string().min(1).max(40000),
  appendSignature: z.boolean(),
  threadId: z.uuid().optional(),
  attachmentIds: z.array(z.uuid()).max(5).optional(),
});
export type SendInput = z.infer<typeof sendInputSchema>;
export class MailSendError extends Error {
  constructor(
    message: string,
    public readonly uncertain: boolean,
  ) {
    super(message);
  }
}
export async function sendReviewedMail(
  api: ApiClient,
  input: SendInput,
  assert: () => void,
) {
  let body: SendInput;
  try {
    body = sendInputSchema.parse(input);
    const emails = [...body.to, ...(body.cc ?? []), ...(body.bcc ?? [])].map(
      (item) => item.email,
    );
    if (new Set(emails).size !== emails.length)
      throw new Error("Duplicate email recipients are not allowed.");
    assert();
    if (body.threadId) {
      await api.request(
        "core",
        `engagement/mail-threads/${body.threadId}`,
        z
          .object({ id: z.uuid(), clientId: z.string().nullable() })
          .refine(
            (thread) =>
              thread.id === body.threadId && thread.clientId === body.clientId,
          ),
      );
      assert();
    }
    const attachments = await readMailAttachments(
      api,
      body.clientId,
      body.attachmentIds ?? [],
    );
    for (const attachment of attachments) {
      const refusal = attachmentRefusal(attachment);
      if (refusal) throw new Error(`${attachment.fileName}: ${refusal}`);
    }
    assert();
  } catch (error) {
    throw new MailSendError(
      error instanceof Error ? error.message : "Email preflight failed.",
      false,
    );
  }
  try {
    // No asynchronous boundary between the final actor check and dispatch.
    const receipt = await api.request(
      "core",
      "engagement/mail/send",
      z
        .object({
          ok: z.literal(true),
          threadId: z.uuid(),
          messageId: z.uuid(),
        })
        .refine(
          (receipt) => !body.threadId || receipt.threadId === body.threadId,
        ),
      {
        method: "POST",
        body: {
          ...body,
          to: body.to.map(({ email, name }) => ({ email, name })),
          cc: body.cc?.map(({ email, name }) => ({ email, name })),
          bcc: body.bcc?.map(({ email, name }) => ({ email, name })),
        },
      },
    );
    try {
      assert();
    } catch {
      throw new MailSendError(
        "Your session changed while sending. Delivery may have completed; check the original mailbox Sent Items.",
        true,
      );
    }
    return receipt;
  } catch (error) {
    if (error instanceof MailSendError) throw error;
    throw new MailSendError(
      error instanceof Error
        ? error.message
        : "Email delivery could not be confirmed.",
      // Reply persistence can return404 after the provider already sent. Only
      // verified auth guard statuses establish a pre-provider refusal here.
      !(error instanceof ApiError) || ![401, 403].includes(error.status),
    );
  }
}
