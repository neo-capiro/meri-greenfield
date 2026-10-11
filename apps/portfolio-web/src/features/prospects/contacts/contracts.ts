import { z } from "zod";
export const contactInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(300),
  title: z.string().trim().max(300),
  email: z
    .string()
    .trim()
    .max(320)
    .pipe(z.union([z.literal(""), z.email()])),
  phone: z.string().trim().max(120),
  notes: z.string().trim().max(4000),
});
export type ContactInput = z.infer<typeof contactInput>;
export const contactSchema = z.object({
  id: z.uuid(),
  prospectId: z.uuid(),
  requestId: z.uuid(),
  name: z.string().min(1),
  title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type ProspectContact = z.infer<typeof contactSchema>;
export const contactValues = (contact?: ProspectContact): ContactInput => ({
  name: contact?.name ?? "",
  title: contact?.title ?? "",
  email: contact?.email ?? "",
  phone: contact?.phone ?? "",
  notes: contact?.notes ?? "",
});
export const contactBody = (input: ContactInput) => ({
  ...input,
  title: input.title || null,
  email: input.email || null,
  phone: input.phone || null,
  notes: input.notes || null,
});
export const pageSchema = (prospectId: string) =>
  z.object({
    prospectId: z.literal(prospectId),
    readOnly: z.boolean(),
    contacts: z.array(
      contactSchema.refine((contact) => contact.prospectId === prospectId),
    ),
    nextCursor: z.uuid().nullable(),
  });
