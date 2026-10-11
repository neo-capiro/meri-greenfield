import { describe, expect, it } from "vitest";
import { createApiClient, ApiError } from "../src/shared/api/http";
import {
  copiedRecipients,
  recipients,
} from "../src/features/relationships/email/recipients";
import {
  mailFileValidation,
  readMailAttachments,
  attachmentRefusal,
} from "../src/features/relationships/email/attachments";
import {
  sendReviewedMail,
  type SendInput,
} from "../src/features/relationships/email/send";
import { guardedMailApi } from "../src/features/relationships/email/authority";
const clientId = "10000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";
const file = {
  id,
  clientId,
  fileName: "brief.pdf",
  contentType: "application/pdf",
  byteSize: 240,
  source: "email-compose",
  folder: null,
  viewerMode: "all",
  viewerUserIds: [],
  uploadedByUserId: null,
  createdAt: "2026-10-11T00:00:00Z",
  lifecycleStatus: "ready",
  scanStatus: "clean",
  extractionStatus: "pending",
  indexedAt: null,
  usable: true,
};
const input: SendInput = {
  clientId,
  to: [{ email: "taylor@example.test", name: "Taylor", personId: id }],
  cc: [{ email: "copied@example.test" }],
  bcc: [{ email: "blind@example.test" }],
  subject: "Review",
  bodyHtml: "<p>Draft</p>",
  appendSignature: false,
  attachmentIds: [id],
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("email recipients and attachments", () => {
  it("normalizes separators and preserves CC/BCC distinct arrays", () => {
    expect(
      copiedRecipients(
        "COPY@example.test; second@example.test\nthird@example.test",
      ).map((r) => r.email),
    ).toEqual([
      "copy@example.test",
      "second@example.test",
      "third@example.test",
    ]);
    expect(
      recipients(input.to, "cc@example.test", "bcc@example.test").bcc[0]?.email,
    ).toBe("bcc@example.test");
  });
  it.each(["bad", "a@example.test,", "one@example.test,ONE@example.test"])(
    "refuses invalid or duplicate copied addresses %s",
    (value) => {
      expect(() => recipients(input.to, value, "")).toThrow();
    },
  );
  it("refuses cross-field duplicates and recipient count excess", () => {
    expect(() => recipients(input.to, "TAYLOR@example.test", "")).toThrow(
      /only once/,
    );
    expect(() => recipients([], "", "")).toThrow();
    expect(() =>
      recipients(
        input.to,
        Array.from({ length: 11 }, (_, i) => `copy${i}@example.test`).join(","),
        "",
      ),
    ).toThrow();
  });
  it("uses the email3MiB ceiling and canonical type/zero-size guard", () => {
    expect(
      mailFileValidation({
        name: "brief.pdf",
        type: "application/pdf",
        size: 3 * 1024 * 1024,
      }),
    ).toBeNull();
    expect(
      mailFileValidation({
        name: "brief.pdf",
        type: "application/pdf",
        size: 3 * 1024 * 1024 + 1,
      }),
    ).toMatch(/3 MiB/);
    expect(
      mailFileValidation({
        name: "brief.svg",
        type: "image/svg+xml",
        size: 12,
      }),
    ).toMatch(/Unsupported/);
    expect(
      mailFileValidation({
        name: "empty.pdf",
        type: "application/pdf",
        size: 0,
      }),
    ).toMatch(/Empty/);
  });
  it.each([
    { usable: false, blockedReason: "Still scanning" },
    { usable: undefined },
    { byteSize: null },
    { byteSize: 4 * 1024 * 1024 },
  ])("requires canonical readiness and verified size", (change) => {
    expect(
      attachmentRefusal({ ...file, ...change, viewerMode: "all" }),
    ).toBeTruthy();
  });
  it.each([
    { rows: [{ ...file, clientId: other }] },
    { rows: [file, file] },
    { rows: [] },
  ])(
    "refuses wrong-scope, duplicate and missing selected attachments",
    async ({ rows }) => {
      await expect(
        readMailAttachments(
          createApiClient(async () => response(rows)),
          clientId,
          [id],
        ),
      ).rejects.toThrow();
    },
  );
});
describe("explicit send dispatch", () => {
  it("actor change after actual POST is uncertain even with a valid receipt", async () => {
    let active = true;
    await expect(
      sendReviewedMail(
        createApiClient(async (_url, options) => {
          if (options?.method !== "POST") return response([file]);
          active = false;
          return response({ ok: true, threadId: other, messageId: id });
        }),
        input,
        () => {
          if (!active) throw new ApiError(409, "Actor changed");
        },
      ),
    ).rejects.toMatchObject({ uncertain: true });
  });
  it("reads canonical readiness then sends complete recipients/IDs and exact receipt", async () => {
    const calls: string[] = [];
    const result = await sendReviewedMail(
      createApiClient(async (url, options) => {
        calls.push(String(url));
        if (options?.method !== "POST") return response([file]);
        expect(JSON.parse(String(options.body))).toMatchObject({
          to: [{ email: "taylor@example.test", name: "Taylor" }],
          cc: input.cc,
          bcc: input.bcc,
          attachmentIds: [id],
        });
        expect(JSON.parse(String(options.body)).to[0]).not.toHaveProperty(
          "personId",
        );
        return response({ ok: true, threadId: other, messageId: id });
      }),
      input,
      () => {},
    );
    expect(result.messageId).toBe(id);
    expect(calls).toEqual([
      `/api/backend/core/engagement/attachments?clientId=${clientId}`,
      "/api/backend/core/engagement/mail/send",
    ]);
  });
  it("changed actor after asynchronous preflight causes zero POST and safe refusal", async () => {
    let current = true;
    let posts = 0;
    await expect(
      sendReviewedMail(
        createApiClient(async (_url, options) => {
          if (options?.method === "POST") posts++;
          current = false;
          return response([file]);
        }),
        input,
        () => {
          if (!current) throw new Error("Actor changed");
        },
      ),
    ).rejects.toMatchObject({ uncertain: false });
    expect(posts).toBe(0);
  });
  it.each([false, undefined])(
    "unready attachment never dispatches",
    async (usable) => {
      let posts = 0;
      await expect(
        sendReviewedMail(
          createApiClient(async (_url, options) => {
            if (options?.method === "POST") posts++;
            return response([{ ...file, usable }]);
          }),
          input,
          () => {},
        ),
      ).rejects.toMatchObject({ uncertain: false });
      expect(posts).toBe(0);
    },
  );
  it("foreign-client reply preflight is a safe rejection before provider", async () => {
    let posts = 0;
    await expect(
      sendReviewedMail(
        createApiClient(async (_url, options) => {
          if (options?.method === "POST") posts++;
          return response({ id, clientId: other });
        }),
        { ...input, threadId: id },
        () => {},
      ),
    ).rejects.toMatchObject({ uncertain: false });
    expect(posts).toBe(0);
  });
  it.each([400, 404, 500, 502, 503])(
    "HTTP%i after POST remains uncertain with no retry",
    async (status) => {
      let posts = 0;
      await expect(
        sendReviewedMail(
          createApiClient(async (_url, options) => {
            if (options?.method !== "POST") return response([file]);
            posts++;
            return response({ message: "Unconfirmed" }, status);
          }),
          input,
          () => {},
        ),
      ).rejects.toMatchObject({ uncertain: true });
      expect(posts).toBe(1);
    },
  );
  it("a malformed or wrong-thread success receipt is uncertain", async () => {
    await expect(
      sendReviewedMail(
        createApiClient(async (_url, options) =>
          options?.method === "POST"
            ? response({ ok: true })
            : response([file]),
        ),
        input,
        () => {},
      ),
    ).rejects.toMatchObject({ uncertain: true });
  });
  it("known forbidden response retains its reason as a safe error", async () => {
    await expect(
      sendReviewedMail(
        createApiClient(async (_url, options) =>
          options?.method === "POST"
            ? response({ message: "Mailbox forbidden" }, 403)
            : response([file]),
        ),
        input,
        () => {},
      ),
    ).rejects.toMatchObject({ uncertain: false, message: "Mailbox forbidden" });
  });
  it("upload wrapper refuses resumed dispatch after lifetime revocation", async () => {
    let active = true;
    let calls = 0;
    const guarded = guardedMailApi(
      createApiClient(async () => {
        calls++;
        active = false;
        return response({});
      }),
      () => {
        if (!active) throw new ApiError(409, "Inactive");
      },
    );
    await expect(
      guarded.request(
        "core",
        "engagement/attachments/upload-url",
        (await import("zod")).z.unknown(),
        { method: "POST" },
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      guarded.request(
        "core",
        "engagement/attachments/confirm",
        (await import("zod")).z.unknown(),
        { method: "POST" },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(calls).toBe(1);
  });
});
