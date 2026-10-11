import type { RuntimeConfig, Service } from "../config/config";
const permittedRoots: Record<Service, readonly string[]> = {
  core: [
    "clients",
    "client-account-owners",
    "engagement",
    "me",
    "tenant-members",
    "legiwatch",
    "federal-register",
    "funding-opportunities",
    "business-development",
    "intelligence",
    "directory",
    "explorer",
    "firm",
    "billing",
  ],
  strategy: ["planner", "strategies"],
  workspace: ["drafts", "documents", "artifacts", "templates"],
  intelligence: ["clients", "legiwatch", "opportunities", "tracker"],
  meri: [],
};
const jsonError = (status: number, message: string) =>
  Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export async function proxyRequest(
  request: Request,
  service: string,
  path: string[],
  config: RuntimeConfig,
  getToken: () => Promise<string | null>,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (!Object.hasOwn(permittedRoots, service))
    return jsonError(404, "Unknown service.");
  const selected = service as Service;
  // OpenStates uses an opaque ocd-person/<UUID> as one route parameter. Accept
  // that exact identity shape only at the verified state-legislator detail path.
  const statePersonId =
    selected === "core" &&
    path.length === 3 &&
    path[0] === "explorer" &&
    path[1] === "state-legislators" &&
    /^ocd-person\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      path[2] ?? "",
    );
  if (
    !path.length ||
    !permittedRoots[selected].includes(path[0] ?? "") ||
    path.some(
      (segment, index) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        /[\\%?#\x00-\x1f]/.test(segment) ||
        (segment.includes("/") && !(index === 2 && statePersonId)),
    )
  ) {
    return jsonError(400, "Invalid service path.");
  }
  if (selected === "workspace" && path[0] === "templates") {
    // Portfolio reads the existing tenant-visible library and a single preview.
    // Template authoring and other catalog operations remain in Workspace.
    if (path.length !== 2)
      return jsonError(400, "Invalid template catalog path.");
    if (request.method !== "GET")
      return jsonError(405, "Template catalog access is read-only.");
  }
  if (selected === "core" && path[0] === "firm") {
    const methods: Readonly<Record<string, readonly string[]>> = {
      "lda-registrants": ["GET"],
      registrant: ["GET", "PUT"],
      "import-candidates": ["GET"],
      import: ["POST"],
    };
    const allowed = path.length === 2 ? methods[path[1] ?? ""] : undefined;
    if (!allowed) return jsonError(400, "Invalid firm intake path.");
    if (!allowed.includes(request.method))
      return jsonError(405, "Method not allowed for firm intake.");
  }
  if (selected === "core" && path[0] === "billing") {
    // Core owns these two read contracts. Payment mutations belong to
    // Onboard and require a separately reviewed service configuration.
    if (path.length !== 2 || !["state", "summary"].includes(path[1] ?? ""))
      return jsonError(400, "Invalid billing read path.");
    if (request.method !== "GET")
      return jsonError(405, "Billing access is read-only.");
  }
  const base = config.services[selected];
  if (!base || !config.authConfigured || config.issues.length)
    return jsonError(503, "Portfolio service configuration is incomplete.");
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method))
    return jsonError(405, "Method not allowed.");
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return jsonError(403, "Request origin is not allowed.");
  let token: string | null;
  try {
    token = await getToken();
  } catch {
    return jsonError(401, "Your session could not be verified. Sign in again.");
  }
  if (!token) return jsonError(401, "Sign in to continue.");
  const url = new URL(`${base}/${path.map(encodeURIComponent).join("/")}`);
  url.search = new URL(request.url).search;
  try {
    const body = request.method === "GET" ? undefined : await request.text();
    if (body && new TextEncoder().encode(body).length > 2_000_000)
      return jsonError(413, "Request is too large.");
    const response = await fetcher(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    });
    // Forward no cookies, redirects, server diagnostics or provider headers.
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      let message =
        response.status >= 500
          ? "The service is unavailable. Please retry."
          : "The operation was rejected.";
      if (
        response.status < 500 &&
        payload &&
        typeof payload === "object" &&
        "message" in payload
      ) {
        const detail = payload.message;
        if (typeof detail === "string") message = detail.slice(0, 1000);
        else if (
          Array.isArray(detail) &&
          detail.every((v) => typeof v === "string")
        )
          message = detail.join(" ").slice(0, 1000);
      }
      return jsonError(response.status, message);
    }
    return new Response(response.status === 204 ? null : response.body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError(502, "The service could not be reached. Please retry.");
  }
}
