import { ApiError, type ApiClient } from "@/shared/api/http";
import type { ClientWriter } from "@/features/client-profile/quick-log/public";
import { memberDetailSchema } from "../directory-contracts";
import {
  memberReferenceSchema,
  memberNoteInputSchema,
  memberNoteReceiptSchema,
  type MemberReference,
} from "./contracts";

export async function createMemberNote(
  api: ApiClient,
  member: MemberReference,
  actor: ClientWriter,
  text: string,
  guard: () => void,
  signal: AbortSignal,
  dispatched: () => void,
) {
  const selected = memberReferenceSchema.parse(member);
  const body = memberNoteInputSchema.parse({
    body: text,
    directoryContactName: selected.name,
  });
  guard();
  signal.throwIfAborted();
  const id = encodeURIComponent(selected.id);
  // The create endpoint itself accepts arbitrary contact strings. Check the
  // current canonical member before writing; this is not server authorization.
  await api.request(
    "core",
    `directory/members/${id}`,
    memberDetailSchema.refine(
      (value) => value.id === selected.id,
      "Member identity mismatch",
    ),
    { signal },
  );
  guard();
  signal.throwIfAborted();
  dispatched();
  const receipt = await api.request(
    "core",
    `directory/contacts/${id}/notes`,
    memberNoteReceiptSchema,
    { method: "POST", body, signal },
  );
  guard();
  if (
    receipt.directoryContactId !== selected.id ||
    receipt.directoryContactName !== body.directoryContactName ||
    receipt.body !== body.body ||
    receipt.createdBy.id !== actor.userId
  )
    throw new ApiError(
      502,
      "The saved note receipt does not match this member, author or text. Check Directory notes before saving again.",
    );
  return receipt;
}
