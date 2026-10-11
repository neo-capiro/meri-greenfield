import { describe, expect, it, vi } from "vitest";
import {
  fileValidation,
  MAX_BYTES,
  contentType,
  signedUrl,
  filterFiles,
  attachmentSchema,
} from "../src/features/files/contracts";
import { uploadFile, type UploadAttempt } from "../src/features/files/upload";
import { createApiClient } from "../src/shared/api/http";
const id = "10000000-0000-4000-8000-000000000001";
const record = attachmentSchema.parse({
  id,
  clientId: id,
  fileName: "test.txt",
  contentType: "text/plain",
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
});
describe("file validation and visibility", () => {
  it("rejects empty, oversized, unknown and scriptable SVG files before presigning", () => {
    for (const file of [
      { name: "a.txt", type: "text/plain", size: 0 },
      { name: "a.pdf", type: "application/pdf", size: MAX_BYTES + 1 },
      { name: "a.bin", type: "application/octet-stream", size: 1 },
      { name: "a.svg", type: "image/svg+xml;charset=utf-8", size: 1 },
    ])
      expect(fileValidation(file)).toBeTruthy();
    expect(contentType({ name: "report.DOCX", type: "" })).toContain(
      "wordprocessingml",
    );
    expect(
      fileValidation({ name: "a.txt", type: "text/plain", size: MAX_BYTES }),
    ).toBeNull();
  });
  it("rejects credential-bearing and non-HTTPS signed destinations", () => {
    expect(signedUrl("javascript:alert(1)")).toBeUndefined();
    expect(signedUrl("https://user:pass@example.test")).toBeUndefined();
    expect(signedUrl("https://example.test/file?signature=test")).toContain(
      "signature=test",
    );
  });
  it("filters real folder/source metadata without inferring a smart link", () => {
    expect(filterFiles([record], "test", "", "manual", "created")).toEqual([
      record,
    ]);
    expect(filterFiles([record], "", "Strategy", "", "name")).toEqual([]);
  });
});
describe("upload orchestration", () => {
  it("retries only confirmation after storage succeeded; keeps client/source association", async () => {
    const methods: string[] = [];
    let confirms = 0;
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url, init) => {
        methods.push(String(url));
        const body = JSON.parse(String(init?.body));
        expect(body.clientId).toBe(id);
        if (String(url).endsWith("upload-url"))
          return Response.json({
            url: "https://storage.example.test",
            fields: { key: "test-key" },
            s3Key: "test-key",
          });
        expect(body.source).toBe(`capability:${id}`);
        confirms++;
        return confirms === 1
          ? Response.json({ message: "Service unavailable" }, { status: 503 })
          : Response.json(record);
      });
    const storage = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const api = createApiClient(request);
    const attempt: UploadAttempt = {};
    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    await expect(
      uploadFile(api, id, file, attempt, () => {}, `capability:${id}`, storage),
    ).rejects.toThrow();
    expect(attempt.bytesUploaded).toBe(true);
    await expect(
      uploadFile(api, id, file, attempt, () => {}, `capability:${id}`, storage),
    ).resolves.toMatchObject({ id });
    expect(storage).toHaveBeenCalledTimes(1);
    expect(methods.filter((url) => url.endsWith("upload-url"))).toHaveLength(1);
    expect(storage.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit",
      redirect: "error",
    });
  });
  it("does not confirm a failed storage write", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        url: "https://storage.example.test",
        fields: {},
        s3Key: "key",
      }),
    );
    const storage = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 403 }));
    await expect(
      uploadFile(
        createApiClient(request),
        id,
        new File(["hello"], "a.txt", { type: "text/plain" }),
        {},
        () => {},
        "manual",
        storage,
      ),
    ).rejects.toThrow("Storage upload failed");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
