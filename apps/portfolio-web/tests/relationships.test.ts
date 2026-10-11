import { describe, expect, it } from "vitest";
import { createApiClient, ApiError } from "../src/shared/api/http";
import {
  canManageContacts,
  readPeople,
  writePerson,
} from "../src/features/relationships/contact-api";
import { contactInput } from "../src/features/relationships/contracts";
const clientId = "10000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
const otherId = "20000000-0000-4000-8000-000000000002";
const person = {
  id,
  clientId,
  name: "Taylor Test",
  title: "Director",
  email: "taylor@example.test",
  phone: "",
  role: "",
  notes: "Dated source",
  hierarchyLevel: "leadership",
  reportsToPersonId: null,
  placementSource: "manual",
  reviewRequired: false,
  createdAt: "2026-10-01T12:00:00Z",
};
const body = {
  name: person.name,
  title: person.title,
  email: person.email,
  phone: "",
  role: "",
  notes: person.notes,
};
const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
describe("organization contact API boundary", () => {
  it("reads only the requested core roster and passes cancellation", async () => {
    const signal = new AbortController().signal;
    const api = createApiClient(async (url, options) => {
      expect(url).toBe(`/api/backend/core/clients/${clientId}/people`);
      expect(options?.signal).toBe(signal);
      return reply([person]);
    });
    expect(await readPeople(api, clientId, signal)).toEqual([person]);
  });
  it.each([
    { rows: [{ ...person, clientId: otherId }] },
    { rows: [person, person] },
    { rows: [{ ...person, id: "bad" }] },
  ])(
    "refuses foreign, duplicate or malformed roster data",
    async ({ rows }) => {
      await expect(
        readPeople(
          createApiClient(async () => reply(rows)),
          clientId,
        ),
      ).rejects.toMatchObject({ status: 502 });
    },
  );
  it("creates and updates through the core route with an explicit nullable email clear", async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    const api = createApiClient(async (url, options) => {
      const sent = JSON.parse(String(options?.body));
      calls.push({
        url: String(url),
        method: String(options?.method),
        body: sent,
      });
      return reply({ ...person, ...sent });
    });
    await writePerson(api, clientId, {
      kind: "save",
      body: { ...body, name: "  New contact  ", email: null },
    });
    await writePerson(api, clientId, {
      kind: "save",
      id,
      body: { ...body, email: "  taylor@example.test  " },
    });
    expect(calls).toEqual([
      {
        url: `/api/backend/core/clients/${clientId}/people`,
        method: "POST",
        body: { ...body, name: "New contact", email: null },
      },
      {
        url: `/api/backend/core/clients/${clientId}/people/${id}`,
        method: "PATCH",
        body,
      },
    ]);
  });
  it.each([
    { ...person, clientId: otherId },
    { ...person, id: otherId },
    { ...person, name: "Previous value" },
  ])("rejects a wrong association or stale save receipt", async (receipt) => {
    await expect(
      writePerson(
        createApiClient(async () => reply(receipt)),
        clientId,
        { kind: "save", id, body },
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
  it.each([{}, { deleted: false }, null, { success: true }])(
    "requires the actual deleted:true receipt",
    async (receipt) => {
      await expect(
        writePerson(
          createApiClient(async () => reply(receipt)),
          clientId,
          { kind: "delete", id },
        ),
      ).rejects.toMatchObject({ status: 502 });
    },
  );
  it("accepts a verified deletion at the exact scoped route", async () => {
    await writePerson(
      createApiClient(async (url, options) => {
        expect(url).toBe(`/api/backend/core/clients/${clientId}/people/${id}`);
        expect(options?.method).toBe("DELETE");
        return reply({ deleted: true });
      }),
      clientId,
      { kind: "delete", id },
    );
  });
  it("preserves hierarchy separation and verifies explicit placement/reset receipts", async () => {
    await writePerson(
      createApiClient(async (url, options) => {
        expect(url).toBe(
          `/api/backend/core/clients/${clientId}/people/${id}/hierarchy`,
        );
        expect(JSON.parse(String(options?.body))).toEqual({
          hierarchyLevel: "team",
          reportsToPersonId: otherId,
          reviewRequired: true,
        });
        return reply({
          ...person,
          hierarchyLevel: "team",
          reportsToPersonId: otherId,
          reviewRequired: true,
        });
      }),
      clientId,
      {
        kind: "hierarchy",
        id,
        body: {
          hierarchyLevel: "team",
          reportsToPersonId: otherId,
          reviewRequired: true,
        },
      },
    );
    await expect(
      writePerson(
        createApiClient(async () => reply(person)),
        clientId,
        { kind: "hierarchy", id, body: { resetToAutomatic: true } },
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
  it.each([401, 403, 404, 409, 503])(
    "keeps HTTP %i as an error and never retries a mutation",
    async (status) => {
      let requests = 0;
      await expect(
        writePerson(
          createApiClient(async () => {
            requests++;
            return reply({ message: "Contact rejected" }, status);
          }),
          clientId,
          { kind: "save", id, body },
        ),
      ).rejects.toBeInstanceOf(ApiError);
      expect(requests).toBe(1);
    },
  );
  it("rejects malformed association IDs before any request", async () => {
    let requests = 0;
    const api = createApiClient(async () => {
      requests++;
      return reply(person);
    });
    await expect(
      writePerson(api, clientId, { kind: "delete", id: "bad" }),
    ).rejects.toThrow();
    expect(() => readPeople(api, "bad")).toThrow();
    expect(requests).toBe(0);
  });
  it.each(["standard_user", "user_admin", "capiro_admin"])(
    "allows known backend role %s",
    (role) => expect(canManageContacts(role)).toBe(true),
  );
  it.each([null, undefined, "unknown", "guest", "viewer"])(
    "refuses role %s",
    (role) => expect(canManageContacts(role)).toBe(false),
  );
  it("reuses canonical field bounds and required name validation", () => {
    expect(contactInput.safeParse({ ...body, name: "  " }).success).toBe(false);
    expect(contactInput.safeParse({ ...body, email: "bad" }).success).toBe(
      false,
    );
    expect(
      contactInput.safeParse({ ...body, notes: "x".repeat(20001) }).success,
    ).toBe(false);
  });
});
