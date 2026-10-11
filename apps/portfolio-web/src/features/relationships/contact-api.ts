import { z } from "zod";
import type { ApiClient } from "@/shared/api/http";
import { canAdminister } from "@/shared/auth/identity";
import { contactInput, personSchema, type Person } from "./contracts";

type HierarchyInput = {
  hierarchyLevel?: Person["hierarchyLevel"];
  reportsToPersonId?: string | null;
  resetToAutomatic?: boolean;
  reviewRequired?: boolean;
};
export type ContactValues = z.infer<typeof contactInput>;
export type PersonChange =
  | {
      kind: "save";
      id?: string;
      body: Omit<ContactValues, "email"> & { email: string | null };
    }
  | { kind: "hierarchy"; id: string; body: HierarchyInput }
  | { kind: "delete"; id: string };

export const canManageContacts = (role: string | null | undefined) =>
  role === "standard_user" || canAdminister(role);
const root = (clientId: string) => `clients/${z.uuid().parse(clientId)}/people`;
const scopedPerson = (clientId: string, id?: string) =>
  personSchema.refine(
    (person) => person.clientId === clientId && (!id || person.id === id),
    "Contact association mismatch",
  );

export function readPeople(
  api: ApiClient,
  clientId: string,
  signal?: AbortSignal,
) {
  return api.request(
    "core",
    root(clientId),
    z
      .array(scopedPerson(clientId))
      .refine(
        (people) =>
          new Set(people.map((person) => person.id)).size === people.length,
        "Duplicate contact identity",
      ),
    { signal },
  );
}

/** Uses current ClientPeople receipts; no invented version/idempotency guarantees. */
export async function writePerson(
  api: ApiClient,
  clientId: string,
  change: PersonChange,
) {
  const base = root(clientId);
  const id =
    change.kind !== "save" || change.id !== undefined
      ? z.uuid().parse(change.id)
      : undefined;
  if (change.kind === "delete") {
    await api.request(
      "core",
      `${base}/${id}`,
      z.object({ deleted: z.literal(true) }),
      { method: "DELETE" },
    );
    return;
  }
  if (change.kind === "hierarchy") {
    const receipt = scopedPerson(clientId, id).refine(
      (person) =>
        person.placementSource ===
          (change.body.resetToAutomatic === true ? "auto_title" : "manual") &&
        (!Object.hasOwn(change.body, "reportsToPersonId") ||
          person.reportsToPersonId === change.body.reportsToPersonId) &&
        (!Object.hasOwn(change.body, "reviewRequired") ||
          change.body.resetToAutomatic === true ||
          person.reviewRequired === change.body.reviewRequired) &&
        (!Object.hasOwn(change.body, "hierarchyLevel") ||
          change.body.resetToAutomatic === true ||
          person.hierarchyLevel === change.body.hierarchyLevel),
      "Placement receipt mismatch",
    );
    return api.request("core", `${base}/${id}/hierarchy`, receipt, {
      method: "PATCH",
      body: change.body,
    });
  }
  const parsed = contactInput.parse({
    ...change.body,
    email: change.body.email?.trim() ?? "",
  });
  const body = { ...parsed, email: parsed.email || null };
  const receipt = scopedPerson(clientId, id).refine(
    (person) =>
      Object.entries(body).every(
        ([field, value]) => person[field as keyof typeof body] === value,
      ),
    "Saved contact details do not match the submitted change",
  );
  return api.request("core", `${base}${id ? `/${id}` : ""}`, receipt, {
    method: id ? "PATCH" : "POST",
    body,
  });
}
