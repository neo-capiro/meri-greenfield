import { describe, expect, it } from "vitest";
import { clientSchema } from "../src/features/portfolio/contracts";
import {
  clientToIntake,
  intakePayload,
  validateIntake,
} from "../src/features/client-intake/form";
import {
  certifications,
  organizationTypes,
} from "../src/features/client-intake/catalog";
import { createApiClient } from "../src/shared/api/http";
import {
  archiveClient,
  saveClientProfile,
} from "../src/features/client-intake/profile-api";
import {
  maxLogoBytes,
  uploadClientLogo,
  validateLogo,
  type LogoAttempt,
} from "../src/features/client-intake/logo";
const client = clientSchema.parse({
  id: "10000000-0000-4000-8000-000000000001",
  name: "Test Engineering",
  website: "example.test",
  description: "Test description",
  profileStatus: "ACTIVE",
  status: "active",
  sectorTag: "DEFENSE",
  primaryContactEmail: "test@example.test",
  naicsCodes: ["541330"],
  setAsideCertifications: ["LEGACY_CODE"],
  applicantTypes: ["Legacy identity"],
  intakeData: {
    ein: "123456789",
    profileNotes: "Retain",
    privateIntegration: { revision: 1 },
    sectors: ["DEFENSE"],
    sbClassification: { sb: true, unknownLegacyFlag: true },
  },
});
describe("client intake domain", () => {
  it("requires Figma company fields, checks only real dates and bounds priorities", () => {
    const empty = clientToIntake();
    expect(validateIntake(empty)).toMatchObject({
      name: expect.any(String),
      website: expect.any(String),
      description: expect.any(String),
    });
    const valid = clientToIntake(client);
    expect(validateIntake(valid)).toEqual({});
    expect(
      validateIntake({
        ...valid,
        samExpirationDate: "2026-02-30",
        fundingPriorities: Array(21).fill("Priority"),
      }),
    ).toMatchObject({
      samExpirationDate: expect.any(String),
      fundingPriorities: expect.any(String),
    });
    expect(
      validateIntake({
        ...valid,
        description: "x".repeat(601),
        internalNotes: "x".repeat(2001),
        ein: "123456",
      }),
    ).toMatchObject({
      description: expect.any(String),
      internalNotes: expect.any(String),
      ein: expect.any(String),
    });
  });
  it("preserves unchanged legacy field values but rejects a newly invalid EIN", () => {
    const legacy = clientToIntake(
      clientSchema.parse({
        ...client,
        description: "x".repeat(900),
        intakeData: { ein: "OLD" },
      }),
    );
    expect(validateIntake(legacy, legacy)).toEqual({});
    expect(validateIntake({ ...legacy, ein: "NEW" }, legacy).ein).toBeDefined();
  });
  it("merges only dirty intake keys over the latest record and leaves remote company changes alone", () => {
    const initial = clientToIntake(client);
    const latest = clientSchema.parse({
      ...client,
      name: "Remote rename",
      primaryContactEmail: "remote@example.test",
      intakeData: {
        ...client.intakeData,
        profileNotes: "Remote notes",
        privateIntegration: { revision: 2 },
        newSibling: "Fresh",
      },
    });
    const body = intakePayload(
      { ...initial, internalNotes: "Updated local note" },
      initial,
      latest,
    );
    expect(body).toEqual({
      intakeData: { ...latest.intakeData, internalNotes: "Updated local note" },
    });
    expect(body).not.toHaveProperty("name");
    expect(body).not.toHaveProperty("primaryContactEmail");
    expect(latest.intakeData?.profileNotes).toBe("Remote notes");
  });
  it("supports explicit clears without wiping sibling intake fields", () => {
    const initial = clientToIntake(client);
    const body = intakePayload(
      {
        ...initial,
        primaryContactEmail: "",
        ein: "",
        sectors: [],
        naicsCodes: [],
      },
      initial,
      client,
    );
    expect(body).toMatchObject({
      primaryContactEmail: null,
      sectorTag: null,
      naicsCodes: [],
    });
    expect(body.intakeData).not.toHaveProperty("ein");
    expect(body.intakeData).not.toHaveProperty("sectors");
    expect(body.intakeData?.privateIntegration).toEqual({ revision: 1 });
  });
  it("preserves unknown business classification keys when a known flag changes", () => {
    const initial = clientToIntake(client);
    const body = intakePayload(
      {
        ...initial,
        sbClassification: {
          ...initial.sbClassification,
          sb: false,
          wosb: true,
        },
      },
      initial,
      client,
    );
    expect(body.intakeData?.sbClassification).toMatchObject({
      wosb: true,
      unknownLegacyFlag: true,
    });
    expect(body.intakeData?.sbClassification).not.toHaveProperty("sb");
  });
  it("merges only dirty business flags and retains concurrent known and unknown flags", () => {
    const initial = clientToIntake(client);
    const latest = clientSchema.parse({
      ...client,
      intakeData: {
        ...client.intakeData,
        sbClassification: {
          sb: true,
          wosb: true,
          hubzone: true,
          unknownLegacyFlag: "remote",
        },
      },
    });
    const body = intakePayload(
      {
        ...initial,
        sbClassification: { ...initial.sbClassification, sb: false },
      },
      initial,
      latest,
    );
    expect(body.intakeData?.sbClassification).toEqual({
      wosb: true,
      hubzone: true,
      unknownLegacyFlag: "remote",
    });
    expect(latest.intakeData?.sbClassification).toEqual({
      sb: true,
      wosb: true,
      hubzone: true,
      unknownLegacyFlag: "remote",
    });
  });
  it("normalizes canonical codes, primary sector and EIN while retaining exact organization identifiers", () => {
    const values = {
      ...clientToIntake(client),
      naicsCodes: ["541330", "541330", " 541512 "],
      pscCodes: ["r425"],
      ein: "12-3456789",
      sectors: ["ENERGY", "DEFENSE"],
    };
    const body = intakePayload(values);
    expect(body).toMatchObject({
      profileType: "CLIENT",
      profileStatus: "ACTIVE",
      sectorTag: "ENERGY",
      naicsCodes: ["541330", "541512"],
      pscCodes: ["R425"],
      applicantTypes: ["Legacy identity"],
      setAsideCertifications: ["LEGACY_CODE"],
    });
    expect(body.intakeData?.ein).toBe("123456789");
    expect(intakePayload(values, values, client)).toEqual({});
    expect(
      organizationTypes.some(
        ([value]) =>
          value === "For profit organizations other than small businesses",
      ),
    ).toBe(true);
    expect(certifications).not.toContain("SBA");
  });
});
describe("client mutation receipts", () => {
  const other = { ...client, id: "20000000-0000-4000-8000-000000000002" };
  it("rejects a wrong-client fresh read before issuing PUT", async () => {
    const methods: string[] = [];
    const api = createApiClient(async (_path, options) => {
      methods.push(options?.method ?? "GET");
      return Response.json(other);
    });
    const initial = clientToIntake(client);
    await expect(
      saveClientProfile(api, { ...initial, name: "Edited" }, initial, client),
    ).rejects.toThrow("unexpected response");
    expect(methods).toEqual(["GET"]);
  });
  it("rejects a successful PUT receipt for another client", async () => {
    const api = createApiClient(async (_path, options) =>
      Response.json(options?.method === "PUT" ? other : client),
    );
    const initial = clientToIntake(client);
    await expect(
      saveClientProfile(api, { ...initial, name: "Edited" }, initial, client),
    ).rejects.toThrow("unexpected response");
  });
  it.each([other, client])(
    "rejects archive receipts without matching identity and archived status",
    async (receipt) => {
      const api = createApiClient(async () =>
        Response.json({
          ...receipt,
          status: receipt === other ? "archived" : "active",
        }),
      );
      await expect(archiveClient(api, client.id)).rejects.toThrow(
        "unexpected response",
      );
    },
  );
  it("accepts only the requested archived client", async () => {
    const api = createApiClient(async () =>
      Response.json({ ...client, status: "archived" }),
    );
    await expect(archiveClient(api, client.id)).resolves.toMatchObject({
      id: client.id,
      status: "archived",
    });
  });
  it("rejects logo confirmation for another client", async () => {
    const api = createApiClient(async () => Response.json(other));
    const attempt: LogoAttempt = {
      file: new File(["x"], "logo.png", { type: "image/png" }),
      bytesUploaded: true,
      ticket: {
        url: "https://storage.example.test/upload",
        fields: { key: "stage/key" },
        s3Key: "stage/key",
      },
    };
    await expect(uploadClientLogo(api, client.id, attempt)).rejects.toThrow(
      "unexpected response",
    );
  });
});
describe("client logo contract", () => {
  it("enforces supported MIME and the signed endpoint's 2 MiB bound", () => {
    expect(
      validateLogo({ type: "image/svg+xml", size: maxLogoBytes }),
    ).toBeUndefined();
    expect(validateLogo({ type: "image/png", size: 0 })).toBeDefined();
    expect(
      validateLogo({ type: "image/png", size: maxLogoBytes + 1 }),
    ).toBeDefined();
    expect(validateLogo({ type: "text/html", size: 1 })).toBeDefined();
  });
  it("posts signed multipart without credentials and retries confirmation without uploading again", async () => {
    const calls: { path: string; body: unknown }[] = [];
    let confirmations = 0;
    const api = createApiClient(async (path, options) => {
      calls.push({
        path: String(path),
        body: JSON.parse(String(options?.body)),
      });
      if (String(path).endsWith("upload-url"))
        return Response.json({
          url: "https://storage.example.test/upload",
          fields: { key: "stage/key", policy: "synthetic" },
          s3Key: "stage/key",
        });
      confirmations++;
      return confirmations === 1
        ? Response.json(
            { message: "Confirmation temporarily unavailable" },
            { status: 503 },
          )
        : Response.json(client);
    });
    let transfers = 0;
    const transport: typeof fetch = async (_url, options) => {
      transfers++;
      expect(options).toMatchObject({
        method: "POST",
        credentials: "omit",
        redirect: "error",
      });
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(options?.body).toBeInstanceOf(FormData);
      expect((options?.body as FormData).get("key")).toBe("stage/key");
      return new Response(null, { status: 204 });
    };
    const attempt: LogoAttempt = {
      file: new File(["synthetic"], "logo.png", { type: "image/png" }),
    };
    await expect(
      uploadClientLogo(api, client.id, attempt, transport),
    ).rejects.toThrow("temporarily unavailable");
    await expect(
      uploadClientLogo(api, client.id, attempt, transport),
    ).resolves.toEqual(client);
    expect(transfers).toBe(1);
    expect(calls).toHaveLength(3);
    expect(calls[0]?.body).toEqual({
      contentType: "image/png",
      contentLength: 9,
    });
    expect(calls[2]?.body).toEqual({
      s3Key: "stage/key",
      contentType: "image/png",
    });
  });
  it("rejects a signed ticket with mismatched key before sending bytes", async () => {
    const api = createApiClient(async () =>
      Response.json({
        url: "https://storage.example.test/upload",
        fields: { key: "wrong" },
        s3Key: "stage/key",
      }),
    );
    let transfers = 0;
    await expect(
      uploadClientLogo(
        api,
        client.id,
        { file: new File(["x"], "logo.png", { type: "image/png" }) },
        async () => {
          transfers++;
          return new Response();
        },
      ),
    ).rejects.toThrow("unexpected response");
    expect(transfers).toBe(0);
  });
});
