import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  uploadParentFile,
  type UploadAttempt,
} from "../src/features/files/upload";
const clientId = "10000000-0000-4000-8000-000000000001";
const meetingId = "90000000-0000-4000-8000-000000000001";
const id = "80000000-0000-4000-8000-000000000001";
const file = new File(["hello"], "source.txt", { type: "text/plain" });
const ticket = {
  url: "https://storage.example.test",
  fields: { key: "test-key" },
  s3Key: "test-key",
};
const receipt = {
  id,
  clientId,
  meetingId,
  s3Key: ticket.s3Key,
  fileName: file.name,
  contentType: file.type,
  byteSize: 5,
  source: "manual",
  folder: null,
  viewerMode: "all",
  viewerUserIds: [],
  uploadedByUserId: null,
  createdAt: "2026-10-01T12:00:00Z",
  lifecycleStatus: "quarantined",
  scanStatus: "pending",
  extractionStatus: "pending",
  indexedAt: null,
};
describe("canonical uploader meeting extension", () => {
  it("rechecks after ticket and storage replies before dispatching more writes", async () => {
    for (const blockAt of [2, 3]) {
      let checks = 0;
      const guard = () => {
        if (++checks === blockAt) throw new Error("scope changed");
      };
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(ticket));
      const storage = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 204 }));
      const attempt: UploadAttempt = {};
      await expect(
        uploadParentFile(
          createApiClient(request),
          { meetingId, clientId },
          file,
          attempt,
          () => {},
          "manual",
          storage,
          guard,
        ),
      ).rejects.toThrow("scope changed");
      expect(request).toHaveBeenCalledOnce();
      expect(storage).toHaveBeenCalledTimes(blockAt === 2 ? 0 : 1);
      expect(attempt.ticket?.s3Key).toBe(ticket.s3Key);
      expect(attempt.storageUnknown).toBeUndefined();
    }
  });
  it("binds both parents and preserves actual quarantine without inventing approval", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        Response.json(String(url).endsWith("upload-url") ? ticket : receipt),
      );
    const storage = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      uploadParentFile(
        createApiClient(request),
        { meetingId, clientId },
        file,
        {},
        () => {},
        "manual",
        storage,
      ),
    ).resolves.toMatchObject({
      id,
      lifecycleStatus: "quarantined",
      scanStatus: "pending",
    });
    for (const [, init] of request.mock.calls)
      expect(JSON.parse(String(init?.body))).toMatchObject({
        meetingId,
        clientId,
        fileName: file.name,
      });
    expect(storage.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit",
      redirect: "error",
    });
    expect(storage.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it("retains same ticket and only confirms after lost storage reply", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(ticket))
      .mockResolvedValueOnce(Response.json(receipt));
    const storage = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("lost reply"));
    const attempt: UploadAttempt = {};
    const api = createApiClient(request);
    await expect(
      uploadParentFile(
        api,
        { meetingId, clientId },
        file,
        attempt,
        () => {},
        "manual",
        storage,
      ),
    ).rejects.toThrow("completion is unknown");
    await expect(
      uploadParentFile(
        api,
        { meetingId, clientId },
        file,
        attempt,
        () => {},
        "manual",
        storage,
      ),
    ).resolves.toMatchObject({ id });
    expect(storage).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body)).s3Key).toBe(
      ticket.s3Key,
    );
  });
  it("refuses receipt for another parent/key/file", async () => {
    for (const invalid of [
      { ...receipt, meetingId: clientId },
      { ...receipt, clientId: null },
      { ...receipt, s3Key: "other" },
      { ...receipt, fileName: "other.txt" },
    ]) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(ticket))
        .mockResolvedValueOnce(Response.json(invalid));
      await expect(
        uploadParentFile(
          createApiClient(request),
          { meetingId, clientId },
          file,
          {},
          () => {},
          "manual",
          async () => new Response(null, { status: 204 }),
        ),
      ).rejects.toMatchObject({ status: 502 });
      expect(request).toHaveBeenCalledTimes(2);
    }
  });
  it("prevents reusing an attempt with another file or client", async () => {
    const api = createApiClient(async (url) =>
      Response.json(String(url).endsWith("upload-url") ? ticket : receipt),
    );
    const attempt: UploadAttempt = {};
    await uploadParentFile(
      api,
      { meetingId, clientId },
      file,
      attempt,
      () => {},
      "manual",
      async () => new Response(null, { status: 204 }),
    );
    await expect(
      uploadParentFile(
        api,
        { meetingId, clientId: null },
        file,
        attempt,
        () => {},
      ),
    ).rejects.toThrow("another file or parent");
    await expect(
      uploadParentFile(
        api,
        { meetingId, clientId },
        new File(["different"], file.name, { type: file.type }),
        attempt,
        () => {},
      ),
    ).rejects.toThrow("another file or parent");
  });
});
