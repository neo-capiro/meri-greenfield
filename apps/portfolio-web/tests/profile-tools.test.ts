import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createApiClient, ApiError } from "../src/shared/api/http";
import {
  parseClientCsv,
  defaultMapping,
  mapClientCsv,
  csvRowSchema,
} from "../src/features/intake/csv/model";
import {
  importCsvClients,
  verifyCsvReceipt,
} from "../src/features/intake/csv/api";
import {
  addFocusTag,
  assertTagWriter,
  focusTags,
} from "../src/features/client-profile/tags/actions";
import { prepareProfileExport } from "../src/features/client-profile/export/actions";
const clientId = "10000000-0000-4000-8000-000000000001";
const tenantId = "10000000-0000-4000-8000-000000000002";
const actor = { userId: "user-test", tenantId };
const client = {
  id: clientId,
  tenantId,
  name: "Test organization",
  status: "active",
  profileStatus: "ACTIVE",
  intakeData: {
    tags: ["Existing"],
    profileNotes: "Saved notes",
    nested: { preserve: true },
  },
  arbitrarySavedField: "preserved",
};
const intelligence = {
  client: {
    id: clientId,
    name: client.name,
    description: null,
    sectorTag: null,
    submissionTracks: [],
    capabilities: [],
  },
  mappings: [
    { source: "contracting", confirmed: false, externalId: "test-source" },
  ],
  lda: { matched: false, totalSpending: null },
  contracting: { matched: true, totalContracts: 12.34 },
  lobbyIntel: { matched: false },
  relevantBills: [],
  activeRegulations: [],
  competitors: [],
  aiSummary: null,
  lastUpdated: "2026-10-11T00:00:00Z",
};
const signal = () => new AbortController().signal;
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const row = (name: string) =>
  csvRowSchema.parse({ name, profileType: "CLIENT", profileStatus: "ACTIVE" });
describe("CSV validation and real partial receipt", () => {
  it("parses BOM, escaped quotes, commas and multiline values with physical line evidence", () => {
    const parsed = parseClientCsv(
      '\uFEFFname,description\r\n"Acme, Inc.","line 1\nline ""2"""\r\nBeta,plain\r\n',
    );
    expect(parsed).toEqual([
      { line: 1, cells: ["name", "description"] },
      { line: 2, cells: ["Acme, Inc.", 'line 1\nline "2"'] },
      { line: 4, cells: ["Beta", "plain"] },
    ]);
  });
  it.each([
    'name\n"unfinished',
    'name\nA"bad',
    'name\n"A"trailing',
    "name,website\nOnly-one",
  ])("rejects malformed CSV before import: %s", (input) =>
    expect(() => parseClientCsv(input)).toThrow(),
  );
  it("enforces payload and row bounds rather than silently truncating", () => {
    expect(() => parseClientCsv(`name\n${"a".repeat(1_048_576)}`)).toThrow(
      "1 MB",
    );
    expect(() =>
      parseClientCsv(
        `name\n${Array.from({ length: 501 }, (_, i) => `Client ${i}`).join("\n")}`,
      ),
    ).toThrow("500");
  });
  it("requires mapped name, unique fields and valid email without dropping invalid records", () => {
    const records = parseClientCsv(
      "name,email\nAlpha,invalid\n,person@example.test",
    );
    expect(() => mapClientCsv(records, ["", "primaryContactEmail"])).toThrow(
      "name",
    );
    expect(() => mapClientCsv(records, ["name", "name"])).toThrow("once");
    const mapped = mapClientCsv(records, ["name", "primaryContactEmail"]);
    expect(mapped).toHaveLength(2);
    expect(mapped.every((value) => !value.row && value.error)).toBe(true);
    expect(
      defaultMapping(["Name", "name", "Primary Contact Email", "unknown"]),
    ).toEqual(["name", "", "primaryContactEmail", ""]);
  });
  it("accepts exact per-row outcomes and rejects missing, duplicate or wrong-name receipts", () => {
    const rows = [row("Alpha"), row("Beta")];
    const receipt = {
      created: 1,
      total: 2,
      errors: [{ row: 1, message: "Slot limit" }],
      items: [{ id: clientId, name: "Alpha" }],
    };
    expect(verifyCsvReceipt(receipt, rows)).toBe(true);
    expect(verifyCsvReceipt({ ...receipt, errors: [] }, rows)).toBe(false);
    expect(
      verifyCsvReceipt(
        { ...receipt, errors: [{ row: 2, message: "Bad" }] },
        rows,
      ),
    ).toBe(false);
    expect(
      verifyCsvReceipt(
        { ...receipt, items: [{ id: clientId, name: "Other" }] },
        rows,
      ),
    ).toBe(false);
  });
  it("dispatches only the reviewed rows once and refuses malformed successful responses", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      response({ created: 0, total: 1, errors: [], items: [] }),
    );
    const dispatch = vi.fn();
    await expect(
      importCsvClients(
        createApiClient(fetcher),
        [row("Alpha")],
        () => {},
        signal(),
        dispatch,
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      rows: [row("Alpha")],
    });
  });
  it("refuses a changed actor before any CSV request", async () => {
    const fetcher = vi.fn();
    await expect(
      importCsvClients(
        createApiClient(fetcher),
        [row("A")],
        () => {
          throw new Error("Actor changed");
        },
        signal(),
        () => {},
      ),
    ).rejects.toThrow("Actor changed");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe("focus tag append", () => {
  it("refuses the verified lowercase archived status before any tag write", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ ...client, status: "archived" }));
    await expect(
      addFocusTag(
        createApiClient(fetcher),
        clientId,
        actor,
        "New",
        () => {},
        signal(),
        () => {},
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("preserves current intake fields and existing tags from a fresh scoped read", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(client))
      .mockResolvedValueOnce(
        response({
          ...client,
          intakeData: { ...client.intakeData, tags: ["Existing", "New"] },
        }),
      );
    await addFocusTag(
      createApiClient(fetcher),
      clientId,
      actor,
      " New ",
      () => {},
      signal(),
      () => {},
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      intakeData: { ...client.intakeData, tags: ["Existing", "New"] },
    });
  });
  it("never PUTs after a held preflight loses its lifetime", async () => {
    let active = true;
    const fetcher = vi.fn<typeof fetch>(async () => {
      active = false;
      return response(client);
    });
    const dispatch = vi.fn();
    await expect(
      addFocusTag(
        createApiClient(fetcher),
        clientId,
        actor,
        "New",
        () => {
          if (!active) throw new Error("Closed");
        },
        signal(),
        dispatch,
      ),
    ).rejects.toThrow("Closed");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("rejects wrong tenant or wrong saved tag receipt", async () => {
    const wrongTenant = createApiClient(async () =>
      response({ ...client, tenantId: clientId }),
    );
    await expect(
      addFocusTag(
        wrongTenant,
        clientId,
        actor,
        "New",
        () => {},
        signal(),
        () => {},
      ),
    ).rejects.toMatchObject({ status: 502 });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(client))
      .mockResolvedValueOnce(response(client));
    await expect(
      addFocusTag(
        createApiClient(fetcher),
        clientId,
        actor,
        "New",
        () => {},
        signal(),
        () => {},
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("rejects duplicate visible focus tags and malformed existing tags without sending a write", async () => {
    expect(
      focusTags({ portfolio: ["A"], sectors: ["B"], tags: ["A", 1] }),
    ).toEqual(["A", "B"]);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(client));
    await expect(
      addFocusTag(
        createApiClient(fetcher),
        clientId,
        actor,
        "existing",
        () => {},
        signal(),
        () => {},
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("requires fresh error-free idle administrator identity and matching tenant", async () => {
    const cache = new QueryClient();
    cache.setQueryData(["identity"], {
      user: { id: actor.userId, email: null },
      tenant: { id: tenantId, name: "Test" },
      role: "user_admin",
    });
    expect(() => assertTagWriter(cache, actor)).not.toThrow();
    await cache.invalidateQueries({
      queryKey: ["identity"],
      refetchType: "none",
    });
    expect(() => assertTagWriter(cache, actor)).toThrow();
    cache.setQueryData(["identity"], {
      user: { id: actor.userId, email: null },
      tenant: { id: tenantId, name: "Test" },
      role: "standard_user",
    });
    expect(() => assertTagWriter(cache, actor)).toThrow("administrator");
    cache.clear();
  });
});
describe("profile JSON source composition", () => {
  it.each(["id", "tenantId"])(
    "refuses a client source with mismatched %s before requesting intelligence",
    async (field) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        response({
          ...client,
          [field]: "10000000-0000-4000-8000-000000000009",
        }),
      );
      await expect(
        prepareProfileExport(
          createApiClient(fetcher),
          clientId,
          actor,
          () => {},
          signal(),
        ),
      ).rejects.toMatchObject({ status: 502 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("preserves source amounts, attribution and extensible saved intake with a deterministic timestamp", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(client))
      .mockResolvedValueOnce(response(intelligence));
    const result = await prepareProfileExport(
      createApiClient(fetcher),
      clientId,
      actor,
      () => {},
      signal(),
      () => new Date("2026-10-11T00:00:00Z"),
    );
    expect(result.complete).toBe(true);
    expect(result.client).toEqual(client);
    expect(result.intelligence).toEqual(intelligence);
    expect(result.exportedAt).toBe("2026-10-11T00:00:00.000Z");
  });
  it("records a source failure as explicit partial JSON", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(client))
      .mockResolvedValueOnce(response({ message: "Unavailable" }, 503));
    const result = await prepareProfileExport(
      createApiClient(fetcher),
      clientId,
      actor,
      () => {},
      signal(),
    );
    expect(result.complete).toBe(false);
    expect(result.intelligence).toBeNull();
    expect(result.omittedSources).toEqual(["intelligence"]);
    expect(result.sources.intelligence.error).toEqual({
      code: "source_unavailable",
      httpStatus: 503,
    });
  });
  it.each([401, 403])(
    "refuses partial export on authorization failure %s",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response(client))
        .mockResolvedValueOnce(response({ message: "Denied" }, status));
      await expect(
        prepareProfileExport(
          createApiClient(fetcher),
          clientId,
          actor,
          () => {},
          signal(),
        ),
      ).rejects.toMatchObject({ status });
    },
  );
  it("refuses wrong profile intelligence and prevents changed actor after source loading", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(client))
      .mockResolvedValueOnce(
        response({
          ...intelligence,
          client: { ...intelligence.client, id: tenantId },
        }),
      );
    await expect(
      prepareProfileExport(
        createApiClient(fetcher),
        clientId,
        actor,
        () => {},
        signal(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    let calls = 0;
    const guard = () => {
      if (++calls > 2) throw new ApiError(403, "Actor changed");
    };
    const api = createApiClient(
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response(client))
        .mockResolvedValueOnce(response(intelligence)),
    );
    await expect(
      prepareProfileExport(api, clientId, actor, guard, signal()),
    ).rejects.toThrow("Actor changed");
  });
});
