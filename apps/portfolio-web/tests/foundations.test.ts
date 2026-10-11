import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { readConfig } from "../src/shared/config/config";
import { proxyRequest } from "../src/shared/api/proxy";
import { createApiClient } from "../src/shared/api/http";
const config = readConfig({
  CORE_API_BASE_URL: "https://core.example.test/api",
  STRATEGY_API_BASE_URL: "https://strategy.example.test/strategy-api",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_c3ludGhldGljJA==",
  CLERK_SECRET_KEY: "sk_test_synthetic",
});
describe("configuration and service boundary", () => {
  it("fails closed without configuration, without exposing values", () => {
    const result = readConfig({
      CORE_API_BASE_URL: "https://name:secret@example.test/api",
    });
    expect(result.services.core).toBeUndefined();
    expect(result.issues.join(" ")).not.toContain("secret");
    expect(result.authConfigured).toBe(false);
  });
  it("preserves each approved service prefix", () => {
    expect(config.issues).toEqual([]);
    expect(config.services.strategy).toBe(
      "https://strategy.example.test/strategy-api",
    );
    expect(config.services.core).toBe("https://core.example.test/api");
  });
  it.each([
    "http://remote.example.test/api",
    "https://api.example.test/api?key=private",
    "https://api.example.test/#x",
    "ftp://localhost/api",
  ])("rejects unsafe URL %s", (url) => {
    expect(
      readConfig({ CORE_API_BASE_URL: url }).services.core,
    ).toBeUndefined();
  });
  it("allows a separate loopback test origin", () => {
    expect(
      readConfig({ CORE_API_BASE_URL: "http://127.0.0.1:9191/api/" }).services
        .core,
    ).toBe("http://127.0.0.1:9191/api");
  });
  it("rejects mixed Clerk environments", () => {
    expect(
      readConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_c3ludGhldGljJA==",
        CLERK_SECRET_KEY: "sk_live_synthetic",
      }).authConfigured,
    ).toBe(false);
  });
  it("requires authentication before any backend request", async () => {
    const network = vi.fn();
    const response = await proxyRequest(
      new Request("http://localhost:5188/api/backend/core/clients"),
      "core",
      ["clients"],
      config,
      async () => null,
      network,
    );
    expect(response.status).toBe(401);
    expect(network).not.toHaveBeenCalled();
  });
  it.each([
    ["clients", "..", "me"],
    ["clients", "%2e%2e"],
    ["clients", "https://evil.test"],
    ["clients", "a/b"],
  ])("rejects traversal/absolute path %j", async (...path) => {
    const network = vi.fn();
    const result = await proxyRequest(
      new Request("http://localhost:5188/api/backend/core/clients"),
      "core",
      path,
      config,
      async () => "synthetic-token",
      network,
    );
    expect(result.status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });
  it("does not expose arbitrary backend services", async () => {
    const result = await proxyRequest(
      new Request("http://localhost:5188/api/backend/meri/admin"),
      "meri",
      ["admin"],
      config,
      async () => "token",
    );
    expect(result.status).toBe(400);
  });
  it("preserves an OpenStates identity as one encoded detail parameter", async () => {
    const id = "ocd-person/80000000-0000-4000-8000-000000000001";
    const network = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ id }));
    const result = await proxyRequest(
      new Request(
        "http://localhost:5188/api/backend/core/explorer/state-legislators/test",
      ),
      "core",
      ["explorer", "state-legislators", id],
      config,
      async () => "minted",
      network,
    );
    expect(result.status).toBe(200);
    expect(String(network.mock.calls[0]?.[0])).toBe(
      "https://core.example.test/api/explorer/state-legislators/ocd-person%2F80000000-0000-4000-8000-000000000001",
    );
  });
  it.each([
    ["explorer", "state-legislators", "ocd-person/../../me"],
    [
      "explorer",
      "state-legislators",
      "ocd-person%2F80000000-0000-4000-8000-000000000001",
    ],
    [
      "explorer",
      "state-legislators",
      "ocd-person/80000000-0000-4000-8000-000000000001",
      "me",
    ],
    ["directory", "members", "ocd-person/80000000-0000-4000-8000-000000000001"],
  ])("keeps the state identity exception bounded: %j", async (...path) => {
    const network = vi.fn();
    const result = await proxyRequest(
      new Request(
        "http://localhost:5188/api/backend/core/explorer/state-legislators/test",
      ),
      "core",
      path,
      config,
      async () => "minted",
      network,
    );
    expect(result.status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin mutation before minting a token", async () => {
    const token = vi.fn();
    const result = await proxyRequest(
      new Request("http://localhost:5188/api/backend/core/clients", {
        method: "POST",
        headers: { origin: "https://other.test" },
        body: "{}",
      }),
      "core",
      ["clients"],
      config,
      token,
    );
    expect(result.status).toBe(403);
    expect(token).not.toHaveBeenCalled();
  });
  it("uses the configured origin and minted token, strips incoming tenant credentials", async () => {
    const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));
    const result = await proxyRequest(
      new Request(
        "http://localhost:5188/api/backend/core/clients?profileStatus=ACTIVE",
        {
          headers: { Authorization: "Bearer attacker", "X-Tenant-ID": "other" },
        },
      ),
      "core",
      ["clients"],
      config,
      async () => "minted",
      network,
    );
    const [url, options] = network.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://core.example.test/api/clients?profileStatus=ACTIVE",
    );
    expect(options?.headers).toEqual({
      Authorization: "Bearer minted",
      "Content-Type": "application/json",
      Accept: "application/json",
    });
    expect(options?.redirect).toBe("error");
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });
  it("preserves validation errors but redacts server faults", async () => {
    const request = new Request(
      "http://localhost:5188/api/backend/core/clients",
    );
    const validation = await proxyRequest(
      request,
      "core",
      ["clients"],
      config,
      async () => "token",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: ["name is required"] }, { status: 400 }),
        ),
    );
    expect(await validation.json()).toEqual({ message: "name is required" });
    const fault = await proxyRequest(
      request,
      "core",
      ["clients"],
      config,
      async () => "token",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: "DB password private" }, { status: 500 }),
        ),
    );
    expect(JSON.stringify(await fault.json())).not.toContain("private");
  });
});
describe("HTTP boundary", () => {
  it("rejects an incompatible successful response", async () => {
    const api = createApiClient(
      vi.fn().mockResolvedValue(Response.json({ not: "clients" })),
    );
    await expect(
      api.request("core", "clients", z.array(z.object({ id: z.string() }))),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("surfaces session expiry as an error", async () => {
    const api = createApiClient(
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: "expired" }, { status: 401 }),
        ),
    );
    await expect(
      api.request("core", "clients", z.unknown()),
    ).rejects.toMatchObject({
      status: 401,
      message: "Your session expired. Sign in again.",
    });
  });
});

describe("Workspace template read boundary", () => {
  const workspaceConfig = {
    ...config,
    services: {
      ...config.services,
      workspace: "https://workspace.example.test/workspace-api",
    },
  };
  it.each(["library", "tenant-template-1"])(
    "reads the permitted %s with the configured tenant-authenticated service",
    async (id) => {
      const network = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json([]));
      const response = await proxyRequest(
        new Request(
          `http://localhost:5190/api/backend/workspace/templates/${id}`,
        ),
        "workspace",
        ["templates", id],
        workspaceConfig,
        async () => "minted",
        network,
      );
      expect(response.status).toBe(200);
      expect(String(network.mock.calls[0]?.[0])).toBe(
        `https://workspace.example.test/workspace-api/templates/${id}`,
      );
      expect(network.mock.calls[0]?.[1]?.cache).toBe("no-store");
    },
  );
  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "rejects %s before minting a token or dispatching a catalog write",
    async (method) => {
      const token = vi.fn();
      const network = vi.fn();
      const response = await proxyRequest(
        new Request(
          "http://localhost:5190/api/backend/workspace/templates/library",
          {
            method,
            headers: { origin: "http://localhost:5190" },
          },
        ),
        "workspace",
        ["templates", "library"],
        workspaceConfig,
        token,
        network,
      );
      expect(response.status).toBe(405);
      expect(token).not.toHaveBeenCalled();
      expect(network).not.toHaveBeenCalled();
    },
  );
  it.each([["templates"], ["templates", "tenant-template-1", "publish"]])(
    "does not expose additional template routes %j",
    async (...path) => {
      const token = vi.fn();
      const response = await proxyRequest(
        new Request("http://localhost:5190/api/backend/workspace/templates"),
        "workspace",
        path,
        workspaceConfig,
        token,
      );
      expect(response.status).toBe(400);
      expect(token).not.toHaveBeenCalled();
    },
  );
});
