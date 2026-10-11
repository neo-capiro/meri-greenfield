import { describe, expect, it, vi } from "vitest";
import { proxyRequest } from "../src/shared/api/proxy";
import { readConfig } from "../src/shared/config/config";

const config = readConfig({
  CORE_API_BASE_URL: "https://core.example.test/api",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_c3ludGhldGljJA==",
  CLERK_SECRET_KEY: "sk_test_synthetic",
});

describe("Core billing proxy boundary", () => {
  it.each(["state", "summary"])(
    "forwards only the configured authenticated %s read",
    async (leaf) => {
      const token = vi.fn(async () => "synthetic-token");
      const fetcher = vi.fn(async () => Response.json({ ok: true }));
      const response = await proxyRequest(
        new Request(`http://localhost:5190/api/backend/core/billing/${leaf}`, {
          headers: { "x-tenant-id": "untrusted", Cookie: "untrusted" },
        }),
        "core",
        ["billing", leaf],
        config,
        token,
        fetcher,
      );
      expect(response.status).toBe(200);
      expect(token).toHaveBeenCalledOnce();
      expect(fetcher).toHaveBeenCalledWith(
        new URL(`https://core.example.test/api/billing/${leaf}`),
        expect.objectContaining({
          method: "GET",
          headers: {
            Authorization: "Bearer synthetic-token",
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          cache: "no-store",
          redirect: "error",
        }),
      );
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );

  it.each([
    [["billing"], "GET", 400],
    [["billing", "checkout"], "POST", 400],
    [["billing", "portal"], "POST", 400],
    [["billing", "comp"], "POST", 400],
    [["billing", "summary", "other"], "GET", 400],
    [["billing", "state"], "POST", 405],
    [["billing", "state"], "DELETE", 405],
    [["billing", "summary"], "PATCH", 405],
    [["billing", "summary"], "HEAD", 405],
    [["billing", "summary"], "OPTIONS", 405],
  ] as const)(
    "rejects unapproved billing path/method %j %s before credentials",
    async (path, method, status) => {
      const token = vi.fn(async () => "synthetic-token");
      const fetcher = vi.fn(async () => Response.json({ ok: true }));
      const response = await proxyRequest(
        new Request("http://localhost:5190/api/backend/core/billing/state", {
          method,
          headers: { origin: "http://localhost:5190" },
        }),
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

  it("requires a current session for billing reads", async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    const response = await proxyRequest(
      new Request("http://localhost:5190/api/backend/core/billing/state"),
      "core",
      ["billing", "state"],
      config,
      async () => null,
      fetcher,
    );
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves the service authorization refusal without provider headers", async () => {
    const response = await proxyRequest(
      new Request("http://localhost:5190/api/backend/core/billing/summary"),
      "core",
      ["billing", "summary"],
      config,
      async () => "synthetic-token",
      async () =>
        Response.json(
          { message: "Billing permission required." },
          { status: 403, headers: { "Set-Cookie": "untrusted" } },
        ),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: "Billing permission required.",
    });
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });
});
