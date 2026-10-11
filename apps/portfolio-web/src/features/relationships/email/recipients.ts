import { z } from "zod";

export const mailRecipient = z.object({
  email: z.email().transform((email) => email.trim().toLowerCase()),
  name: z.string().max(300).optional(),
  personId: z.uuid().optional(),
});
export type Recipient = z.infer<typeof mailRecipient>;
export function copiedRecipients(text: string): Recipient[] {
  if (!text.trim()) return [];
  return text
    .split(/[,;\n]/)
    .map((email) => mailRecipient.parse({ email: email.trim() }));
}
export function recipients(to: Recipient[], cc: string, bcc: string) {
  const parsed = z
    .object({
      to: z.array(mailRecipient).min(1).max(50),
      cc: z.array(mailRecipient).max(10),
      bcc: z.array(mailRecipient).max(10),
    })
    .parse({ to, cc: copiedRecipients(cc), bcc: copiedRecipients(bcc) });
  const emails = [...parsed.to, ...parsed.cc, ...parsed.bcc].map(
    (item) => item.email,
  );
  if (new Set(emails).size !== emails.length)
    throw new Error(
      "Each email address can appear only once across To, Cc and Bcc.",
    );
  return parsed;
}
