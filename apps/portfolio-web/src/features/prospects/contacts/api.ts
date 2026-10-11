import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import {
  contactBody,
  contactSchema,
  pageSchema,
  type ContactInput,
  type ProspectContact,
} from "./contracts";
const path = (id: string) =>
  `business-development/prospects/${encodeURIComponent(id)}/contacts`;
export async function readContacts(
  api: ApiClient,
  prospectId: string,
  signal?: AbortSignal,
) {
  const contacts = new Map<string, ProspectContact>();
  const cursors = new Set<string>();
  let after: string | null = null;
  let readOnly = false;
  do {
    const page: z.infer<ReturnType<typeof pageSchema>> = await api.request(
      "core",
      `${path(prospectId)}${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      pageSchema(prospectId),
      { signal },
    );
    readOnly ||= page.readOnly;
    for (const contact of page.contacts) contacts.set(contact.id, contact);
    after = page.nextCursor;
    if (after && cursors.has(after))
      throw new ApiError(
        502,
        "The contact service returned a repeated page. Please retry.",
      );
    if (after) cursors.add(after);
  } while (after);
  return {
    readOnly,
    contacts: [...contacts.values()].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    ),
  };
}
export function saveContact(
  api: ApiClient,
  prospectId: string,
  input: ContactInput,
  requestId: string,
  initial?: ProspectContact,
) {
  const receipt = contactSchema.refine(
    (row) =>
      row.prospectId === prospectId &&
      (initial
        ? row.id === initial.id && row.version === initial.version + 1
        : row.requestId === requestId),
  );
  return api.request(
    "core",
    `${path(prospectId)}${initial ? `/${encodeURIComponent(initial.id)}` : ""}`,
    receipt,
    {
      method: initial ? "PATCH" : "POST",
      body: {
        ...contactBody(input),
        ...(initial ? { expectedVersion: initial.version } : { requestId }),
      },
    },
  );
}
export function removeContact(
  api: ApiClient,
  prospectId: string,
  contact: ProspectContact,
) {
  return api.request(
    "core",
    `${path(prospectId)}/${encodeURIComponent(contact.id)}`,
    z.object({
      id: z.literal(contact.id),
      prospectId: z.literal(prospectId),
      removed: z.literal(true),
      version: z.literal(contact.version + 1),
    }),
    { method: "DELETE", body: { expectedVersion: contact.version } },
  );
}
