"use client";
import { z } from "zod";
import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { MailSendError, sendReviewedMail, type SendInput } from "./email/send";
import { useMailAuthority } from "./email/authority";
const recipientSchema = z.object({
  email: z.string(),
  name: z.string().nullable().optional(),
});
export const messageSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().nullable(),
  fromEmail: z.string().nullable(),
  fromName: z.string().nullable(),
  toRecipients: z.array(recipientSchema),
  ccRecipients: z.array(recipientSchema),
  bodyText: z.string().nullable(),
  sentAt: z.string().nullable(),
  receivedAt: z.string().nullable(),
  createdAt: z.string(),
});
export const threadSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().nullable(),
  subject: z.string(),
  snippet: z.string().nullable(),
  connectionEmail: z.string().nullable(),
  participants: z.array(recipientSchema),
  messages: z.array(messageSchema),
});
export type MailThread = z.infer<typeof threadSchema>;
export function threadsForRecipient(threads: MailThread[], email: string) {
  const target = email.trim().toLowerCase();
  return threads.filter(
    (thread) =>
      thread.participants.some((p) => p.email.toLowerCase() === target) ||
      thread.messages.some(
        (message) =>
          message.fromEmail?.toLowerCase() === target ||
          [...message.toRecipients, ...message.ccRecipients].some(
            (p) => p.email.toLowerCase() === target,
          ),
      ),
  );
}
export function plainMailHtml(text: string) {
  return text
    .split(/\r?\n/)
    .map(
      (line) =>
        `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;") || "<br>"}</p>`,
    )
    .join("");
}
export function useContactThreads(clientId: string, email: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["contact-mail", clientId, email],
    enabled: Boolean(email),
    queryFn: async ({ signal }) =>
      threadsForRecipient(
        await api.request(
          "core",
          `engagement/mail-threads?clientId=${clientId}&recipientEmails=${encodeURIComponent(email ?? "")}`,
          z.array(threadSchema),
          { signal },
        ),
        email ?? "",
      ),
  });
}
export function useMailThread(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["mail-thread", id],
    enabled: Boolean(id),
    queryFn: ({ signal }) =>
      api.request("core", `engagement/mail-threads/${id}`, threadSchema, {
        signal,
      }),
  });
}
export function useSignature() {
  const api = useApi();
  return useQuery({
    queryKey: ["email-signature"],
    queryFn: ({ signal }) =>
      api.request(
        "core",
        "me/email-signature",
        z.object({ html: z.string().nullable(), enabled: z.boolean() }),
        { signal },
      ),
  });
}
export type MailContact = {
  personId?: string;
  name: string;
  title: string | null;
  email: string | null;
};
export function useSendMail(clientId?: string) {
  const api = useApi();
  const cache = useQueryClient();
  const authority = useMailAuthority(clientId);
  const pending = useRef(false);
  const uncertain = useRef(false);
  return useMutation({
    retry: false,
    mutationFn: async (body: SendInput) => {
      if (
        pending.current ||
        uncertain.current ||
        (clientId && body.clientId !== clientId)
      )
        throw new MailSendError(
          "This email attempt is pending, uncertain, or belongs to another client.",
          uncertain.current,
        );
      pending.current = true;
      try {
        return await sendReviewedMail(api, body, authority.capture());
      } catch (error) {
        if (error instanceof MailSendError && error.uncertain)
          uncertain.current = true;
        throw error;
      } finally {
        pending.current = false;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["contact-mail"] }),
        cache.invalidateQueries({ queryKey: ["mail-thread"] }),
        cache.invalidateQueries({ queryKey: ["client-profile"] }),
      ]);
    },
  });
}
export function useRewriteMail() {
  const api = useApi();
  return useMutation({
    mutationFn: (body: {
      rawText: string;
      recipientName: string;
      recipientTitle?: string;
    }) =>
      api.request(
        "core",
        "engagement/mail/rewrite",
        z.object({ bodyHtml: z.string(), verified: z.boolean() }),
        { method: "POST", body },
      ),
  });
}
