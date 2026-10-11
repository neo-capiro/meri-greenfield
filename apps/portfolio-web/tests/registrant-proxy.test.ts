import { describe, expect, it, vi } from "vitest";
import { readConfig } from "../src/shared/config/config";
import { proxyRequest } from "../src/shared/api/proxy";

const config = readConfig({
  CORE_API_BASE_URL: "https://core.example.test/api",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_c3ludGhldGljJA==",
  CLERK_SECRET_KEY: "sk_test_synthetic",
});

describe("firm intake proxy boundary", () => {
  it.each([
    ["lda-registrants", "GET", "?q=Test%20firm"],
    ["registrant", "GET", ""],
    ["registrant", "PUT", ""],
    ["import-candidates", "GET", ""],
    ["import", "POST", ""],
  ])("forwards the approved %s %s contract", async (leaf, method, query) => {
    const token = vi.fn(async () => "synthetic-token");
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    const body = method === "GET" ? undefined : '{"synthetic":true}';
    const response = await proxyRequest(
      new Request(
        `http://localhost:5190/api/backend/core/firm/${leaf}${query}`,
        {
          method,
          body,
          headers: {
            origin: "http://localhost:5190",
            "x-tenant-id": "untrusted",
          },
        },
      ),
      "core",
      ["firm", leaf],
      config,
      token,
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(token).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      new URL(`https://core.example.test/api/firm/${leaf}${query}`),
      expect.objectContaining({
        method,
        body,
        headers: {
          Authorization: "Bearer synthetic-token",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }),
    );
  });

  it.each([
    [["firm", "billing"], "GET", 400],
    [["firm", "registrant", "delete"], "POST", 400],
    [["firm", "registrant"], "DELETE", 405],
    [["firm", "import-candidates"], "POST", 405],
    [["firm", "import"], "GET", 405],
  ] as const)(
    "refuses unapproved firm operations %j %s",
    async (path, method, status) => {
      const token = vi.fn(async () => "synthetic-token");
      const fetcher = vi.fn(async () => Response.json({ ok: true }));
      const response = await proxyRequest(
        new Request(
          `http://localhost:5190/api/backend/core/${path.join("/")}`,
          {
            method,
            headers: { origin: "http://localhost:5190" },
          },
        ),
        "core",
        [...path],
        config,
        token,
        fetcher,
      );
      expect(response.status).toBe(status);
      expect(token).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("retains the same-origin write fence before obtaining credentials", async () => {
    const token = vi.fn(async () => "synthetic-token");
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    const response = await proxyRequest(
      new Request("http://localhost:5190/api/backend/core/firm/import", {
        method: "POST",
        headers: { origin: "https://other.example.test" },
        body: '{"ldaClientIds":[1]}',
      }),
      "core",
      ["firm", "import"],
      config,
      token,
      fetcher,
    );
    expect(response.status).toBe(403);
    expect(token).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires a verified session for approved firm reads", async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    const response = await proxyRequest(
      new Request("http://localhost:5190/api/backend/core/firm/registrant"),
      "core",
      ["firm", "registrant"],
      config,
      async () => null,
      fetcher,
    );
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
