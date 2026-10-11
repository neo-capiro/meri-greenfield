import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  readContacts,
  removeContact,
  saveContact,
} from "../src/features/prospects/contacts/api";
import {
  contactInput,
  contactValues,
  contactBody,
} from "../src/features/prospects/contacts/contracts";
const prospectId = "70000000-0000-4000-8000-000000000001";
const id = "80000000-0000-4000-8000-000000000001";
const secondId = "80000000-0000-4000-8000-000000000002";
const requestId = "90000000-0000-4000-8000-000000000001";
const contact = {
  id,
  prospectId,
  requestId,
  name: "Priya Nair",
  title: "VP Government Affairs",
  email: "priya@example.test",
  phone: null,
  notes: null,
  version: 1,
  createdAt: "2026-10-10T12:00:00Z",
  updatedAt: "2026-10-10T12:00:00Z",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("prospect contact boundary", () => {
  it("validates required name, email and bounds, and normalizes optional clears", () => {
    expect(
      contactInput.safeParse({ ...contactValues(), name: "   " }).success,
    ).toBe(false);
    expect(
      contactInput.safeParse({ ...contactValues(contact), email: "bad" })
        .success,
    ).toBe(false);
    expect(
      contactInput.parse({
        ...contactValues(contact),
        email: "  priya@example.test  ",
      }).email,
    ).toBe("priya@example.test");
    expect(
      contactInput.safeParse({
        ...contactValues(contact),
        notes: "x".repeat(4001),
      }).success,
    ).toBe(false);
    expect(
      contactBody(contactInput.parse({ ...contactValues(), name: " Test " })),
    ).toEqual({
      name: "Test",
      title: null,
      email: null,
      phone: null,
      notes: null,
    });
  });
  it("reads every page from BD core only, preserves distinct IDs and combines read-only state", async () => {
    const paths: string[] = [];
    const api = createApiClient(async (url) => {
      paths.push(String(url));
      return reply({
        prospectId,
        readOnly: paths.length === 2,
        contacts: [paths.length === 1 ? contact : { ...contact, id: secondId }],
        nextCursor: paths.length === 1 ? id : null,
      });
    });
    expect(await readContacts(api, prospectId)).toMatchObject({
      readOnly: true,
      contacts: [{ id }, { id: secondId }],
    });
    expect(paths).toEqual([
      `/api/backend/core/business-development/prospects/${prospectId}/contacts`,
      `/api/backend/core/business-development/prospects/${prospectId}/contacts?after=${id}`,
    ]);
  });
  it("rejects cross-prospect list data and repeating pages rather than silently accepting partial results", async () => {
    await expect(
      readContacts(
        createApiClient(async () =>
          reply({
            prospectId,
            readOnly: false,
            contacts: [{ ...contact, prospectId: secondId }],
            nextCursor: null,
          }),
        ),
        prospectId,
      ),
    ).rejects.toMatchObject({ status: 502 });
    await expect(
      readContacts(
        createApiClient(async () =>
          reply({
            prospectId,
            readOnly: false,
            contacts: [contact],
            nextCursor: id,
          }),
        ),
        prospectId,
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("creates with stable request identity and validates generated receipt scope", async () => {
    let body: unknown;
    const api = createApiClient(async (_url, options) => {
      body = JSON.parse(String(options?.body));
      return reply(contact);
    });
    await expect(
      saveContact(api, prospectId, contactValues(contact), requestId),
    ).resolves.toEqual(contact);
    expect(body).toMatchObject({ requestId, name: "Priya Nair" });
    await expect(
      saveContact(
        createApiClient(async () => reply({ ...contact, requestId: secondId })),
        prospectId,
        contactValues(contact),
        requestId,
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("version-bound edits reject wrong contact, wrong prospect and unchanged version receipts", async () => {
    for (const receipt of [
      { ...contact, id: secondId, version: 2 },
      { ...contact, prospectId: secondId, version: 2 },
      contact,
    ])
      await expect(
        saveContact(
          createApiClient(async () => reply(receipt)),
          prospectId,
          contactValues(contact),
          requestId,
          contact,
        ),
      ).rejects.toMatchObject({ status: 502 });
    const api = createApiClient(async (_url, options) => {
      expect(options?.method).toBe("PATCH");
      expect(JSON.parse(String(options?.body))).toHaveProperty(
        "expectedVersion",
        1,
      );
      return reply({ ...contact, version: 2 });
    });
    await expect(
      saveContact(api, prospectId, contactValues(contact), requestId, contact),
    ).resolves.toHaveProperty("version", 2);
  });
  it("requires real scoped removal and preserves409 as conflict", async () => {
    for (const receipt of [
      { id, prospectId, removed: false, version: 2 },
      { id: secondId, prospectId, removed: true, version: 2 },
      { id, prospectId, removed: true, version: 1 },
    ])
      await expect(
        removeContact(
          createApiClient(async () => reply(receipt)),
          prospectId,
          contact,
        ),
      ).rejects.toMatchObject({ status: 502 });
    await expect(
      removeContact(
        createApiClient(async () => reply({ message: "Contact changed" }, 409)),
        prospectId,
        contact,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      removeContact(
        createApiClient(async () =>
          reply({ id, prospectId, removed: true, version: 2 }),
        ),
        prospectId,
        contact,
      ),
    ).resolves.toHaveProperty("removed", true);
  });
});
