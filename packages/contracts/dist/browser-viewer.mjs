// Generated browser viewer receiving boundary; no account authority.
// artifacts-0.2/artifact-formats.mjs
var ARTIFACT_MIME_TYPES = Object.freeze({ docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", zip: "application/zip" });

// document-application/boundary.mjs
var errors = /* @__PURE__ */ new WeakSet();
var DocumentResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "DocumentResponseError";
    this.code = code;
    errors.add(this);
  }
};
var isFailure = (error) => errors.has(error);
var fail = (code) => {
  throw new DocumentResponseError(code);
};
var typed = Object.getPrototypeOf(Uint8Array.prototype);
var get = (name) => Object.getOwnPropertyDescriptor(typed, name).get;
var tag = Object.getOwnPropertyDescriptor(typed, Symbol.toStringTag).get;
var length = get("byteLength");
var offset = get("byteOffset");
var buffer = get("buffer");
var ordinaryBuffer = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
function copyBytes(value, cap) {
  try {
    if (tag.call(value) !== "Uint8Array") fail("INVALID_BYTES");
    const n = length.call(value), b = buffer.call(value), o = offset.call(value);
    ordinaryBuffer.call(b);
    if (n > cap) fail("BYTE_LIMIT");
    const copy = new Uint8Array(n);
    Uint8Array.prototype.set.call(copy, new Uint8Array(b, o, n));
    return copy;
  } catch (error) {
    if (isFailure(error)) throw error;
    fail("INVALID_BYTES");
  }
}
function parseBytes(value, cap) {
  const bytes = copyBytes(value, cap);
  let text, data;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    data = JSON.parse(text);
  } catch {
    fail("INVALID_JSON_UTF8");
  }
  const stack = [[data, 0]], objects = [];
  let nodes = 0;
  while (stack.length) {
    const [v, depth] = stack.pop();
    if (++nodes > 1e5 || depth > 64) fail("JSON_LIMIT");
    if (typeof v === "number" && !Number.isFinite(v)) fail("INVALID_NUMBER");
    if (typeof v === "string" && !v.isWellFormed()) fail("INVALID_UNICODE");
    if (v && typeof v === "object") {
      objects.push(v);
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(k)) fail("DANGEROUS_KEY");
        stack.push([x, depth + 1]);
      }
    }
  }
  for (const v of objects) Object.freeze(v);
  return data;
}

// browser-viewer/receive.mjs
var BROWSER_VIEWER_SCHEMA = "meri.browser-viewer/1";
var BROWSER_VIEWER_ROUTES = Object.freeze(["read", "ticket", "connect", "frame", "input", "release"]);
var BROWSER_VIEWER_LIMITS = Object.freeze({ requestBytes: 32768, responseBytes: 12 * 1024 * 1024, pngBytes: 8 * 1024 * 1024, ticketMs: 6e4, maxPages: 32 });
var BROWSER_VIEWER_ERRORS = Object.freeze({
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  EXPIRED: 410,
  TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNAVAILABLE: 503,
  REFUSED: 502
});
var requests = /* @__PURE__ */ new WeakMap();
var frames = /* @__PURE__ */ new WeakMap();
var reads = /* @__PURE__ */ new WeakMap();
var uuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
var opaque = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/u.test(v);
var integer = (v, min = 1, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && v >= min && v <= max;
var fail2 = () => {
  throw Error("INVALID_BROWSER_VIEWER_MESSAGE");
};
function closed(v, keys) {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== keys.length || keys.some((k) => !Object.hasOwn(v, k))) fail2();
}
function context(v) {
  closed(v, ["tenantId", "actorId", "conversationId", "runId", "selectedClientId"]);
  if (!["tenantId", "actorId", "conversationId", "runId"].every((k) => uuid(v[k])) || v.selectedClientId !== null && !uuid(v.selectedClientId)) fail2();
}
function sameBrowserViewerContext(a, b) {
  return ["tenantId", "actorId", "conversationId", "runId", "selectedClientId"].every((k) => a[k] === b[k]);
}
var namedKeys = ["Enter", "Tab", "Backspace", "Delete", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Shift", "Space"];
function event(v) {
  if (!v || typeof v !== "object") fail2();
  if (v.type === "mouse") {
    closed(v, v.action === "move" ? ["type", "action", "x", "y"] : ["type", "action", "x", "y", "button"]);
    if (!["move", "down", "up"].includes(v.action) || v.action !== "move" && !["left", "middle", "right"].includes(v.button)) fail2();
  } else if (v.type === "wheel") {
    closed(v, ["type", "x", "y", "deltaX", "deltaY"]);
    if (![v.deltaX, v.deltaY].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e4)) fail2();
  } else if (v.type === "key") {
    closed(v, ["type", "action", "key", "shift"]);
    if (!["down", "up"].includes(v.action) || typeof v.shift !== "boolean" || typeof v.key !== "string" || !namedKeys.includes(v.key) && !/^[^\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]$/u.test(v.key)) fail2();
  } else if (v.type === "text") {
    closed(v, ["type", "text"]);
    if (typeof v.text !== "string" || ![...v.text].length || [...v.text].length > 256 || !/^[^\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]*$/u.test(v.text)) fail2();
  } else fail2();
  if (["mouse", "wheel"].includes(v.type) && ![v.x, v.y].every((n) => Number.isFinite(n) && n >= 0 && n < 4096)) fail2();
}
function receiveBrowserViewerRequest(route, bytes) {
  if (!BROWSER_VIEWER_ROUTES.includes(route)) fail2();
  const q = parseBytes(bytes, BROWSER_VIEWER_LIMITS.requestBytes), keys = ["schema"];
  if (route !== "read") keys.push("requestId");
  if (route === "connect") keys.push("ticket");
  else if (!["read", "ticket"].includes(route)) keys.push("ownerId");
  if (["frame", "input", "release"].includes(route)) keys.push("viewerId", "leaseEpoch");
  if (["frame", "input"].includes(route)) keys.push("pageId");
  if (route === "input") keys.push("frameId", "events");
  closed(q, keys);
  if (q.schema !== BROWSER_VIEWER_SCHEMA || route !== "read" && !uuid(q.requestId) || q.ownerId !== void 0 && !uuid(q.ownerId) || q.ticket !== void 0 && !opaque(q.ticket) || q.viewerId !== void 0 && !uuid(q.viewerId) || q.pageId !== void 0 && !uuid(q.pageId) || q.leaseEpoch !== void 0 && !integer(q.leaseEpoch) || q.frameId !== void 0 && !opaque(q.frameId)) fail2();
  if (route === "input") {
    if (!Array.isArray(q.events) || !q.events.length || q.events.length > 64) fail2();
    q.events.forEach(event);
  }
  requests.set(q, route);
  return q;
}
function lease(v) {
  if (v === null) return;
  closed(v, ["viewerId", "leaseEpoch", "expiresAtMs", "connectRequestId"]);
  if (!uuid(v.viewerId) || !integer(v.leaseEpoch) || !integer(v.expiresAtMs) || !uuid(v.connectRequestId)) fail2();
}
function page(v) {
  closed(v, ["pageId", "origin"]);
  let origin;
  try {
    origin = new URL(v.origin);
  } catch {
    fail2();
  }
  if (!uuid(v.pageId) || typeof v.origin !== "string" || origin.origin !== v.origin || !["https:", "http:"].includes(origin.protocol)) fail2();
}
function runBinding(v, c) {
  closed(v, ["tenantId", "actorId", "conversationId", "runId", "attemptId", "workerId", "writerFence"]);
  if (!["tenantId", "actorId", "conversationId", "runId"].every((k) => v[k] === c[k]) || !uuid(v.attemptId) || !uuid(v.workerId) || !integer(v.writerFence)) fail2();
}
function checkpoint(v, c) {
  if (v === null) return;
  closed(v, ["checkpointId", "checkpointSha256"]);
  if (v.checkpointId !== c.runId || typeof v.checkpointSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(v.checkpointSha256)) fail2();
}
function frame(v, q) {
  closed(v, ["frameId", "pageId", "width", "height", "image"]);
  closed(v.image, ["mimeType", "data"]);
  if (!opaque(v.frameId) || v.pageId !== q.pageId || !integer(v.width, 1, 4096) || !integer(v.height, 1, 4096) || v.image.mimeType !== "image/png" || typeof v.image.data !== "string" || v.image.data.length > Math.ceil(BROWSER_VIEWER_LIMITS.pngBytes / 3) * 4 || v.image.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(v.image.data)) fail2();
  let raw;
  try {
    raw = atob(v.image.data);
  } catch {
    fail2();
  }
  if (raw.length < 33 || raw.length > BROWSER_VIEWER_LIMITS.pngBytes || btoa(raw) !== v.image.data) fail2();
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0)), header = [137, 80, 78, 71, 13, 10, 26, 10];
  const data = new DataView(bytes.buffer);
  if (!header.every((n, i) => bytes[i] === n) || raw.slice(12, 16) !== "IHDR" || data.getUint32(16) !== v.width || data.getUint32(20) !== v.height) fail2();
  frames.set(v, bytes);
}
function receiveBrowserViewerResponse(route, status, bytes, q, expected) {
  if (requests.get(q) !== route) fail2();
  context(expected);
  const r = parseBytes(bytes, BROWSER_VIEWER_LIMITS.responseBytes);
  if (status !== 200) {
    closed(r, ["schema", "error"]);
    closed(r.error, ["code", "outcome"]);
    if (r.schema !== BROWSER_VIEWER_SCHEMA || typeof r.error.code !== "string" || !Object.hasOwn(BROWSER_VIEWER_ERRORS, r.error.code) || BROWSER_VIEWER_ERRORS[r.error.code] !== status || !["NOT_DISPATCHED", "UNKNOWN", "READ_UNAVAILABLE"].includes(r.error.outcome)) fail2();
    return r;
  }
  const base = ["schema", "context", "ownerId"];
  if (route === "read") {
    closed(r, [...base, "binding", "checkpoint", "state", "lease", "pages"]);
    context(r.context);
    lease(r.lease);
    runBinding(r.binding, r.context);
    checkpoint(r.checkpoint, r.context);
    if (!["unavailable", "agent", "taking", "user", "returning", "ended"].includes(r.state) || r.ownerId !== null && !uuid(r.ownerId) || !Array.isArray(r.pages) || r.pages.length > BROWSER_VIEWER_LIMITS.maxPages || new Set(r.pages.map((p) => p.pageId)).size !== r.pages.length) fail2();
    r.pages.forEach(page);
    if (r.state === "user" !== (r.lease !== null) || r.ownerId === null && (["user", "returning"].includes(r.state) || r.pages.length) || r.state !== "user" && r.pages.length) fail2();
  } else if (route === "ticket") {
    closed(r, [...base, "requestId", "ticket", "expiresAtMs"]);
    context(r.context);
    if (!uuid(r.ownerId) || !opaque(r.ticket) || !integer(r.expiresAtMs)) fail2();
  } else if (route === "connect") {
    closed(r, [...base, "requestId", "state", "lease"]);
    context(r.context);
    lease(r.lease);
    if (!uuid(r.ownerId) || r.state !== "user" || !r.lease || r.lease.connectRequestId !== q.requestId) fail2();
  } else {
    closed(r, [...base, "requestId", "viewerId", "leaseEpoch", route === "frame" ? "frame" : route === "input" ? "accepted" : "state"]);
    context(r.context);
    if (r.viewerId !== q.viewerId || r.leaseEpoch !== q.leaseEpoch) fail2();
    if (route === "frame") frame(r.frame, q);
    if (route === "input" && r.accepted !== true || route === "release" && r.state !== "returning") fail2();
  }
  if (r.schema !== BROWSER_VIEWER_SCHEMA || !sameBrowserViewerContext(r.context, expected) || route !== "read" && r.requestId !== q.requestId || q.ownerId !== void 0 && r.ownerId !== q.ownerId) fail2();
  if (route === "read") reads.set(r, r.binding);
  return r;
}
function browserViewerPng(value) {
  const bytes = frames.get(value);
  if (!bytes) fail2();
  return bytes.slice();
}
function browserTakeoverBinding(value) {
  const binding = reads.get(value);
  if (!binding) fail2();
  return binding;
}
export {
  BROWSER_VIEWER_ERRORS,
  BROWSER_VIEWER_LIMITS,
  BROWSER_VIEWER_ROUTES,
  BROWSER_VIEWER_SCHEMA,
  browserTakeoverBinding,
  browserViewerPng,
  receiveBrowserViewerRequest,
  receiveBrowserViewerResponse,
  sameBrowserViewerContext
};
