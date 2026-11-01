// Generated selected-tab receiving boundary; no account authority.
// artifacts-0.2/artifact-formats.mjs
var ARTIFACT_MIME_TYPES = Object.freeze({ docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain; charset=utf-8", xml: "application/xml; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", zip: "application/zip" });

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
async function digest(bytes) {
  const result = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, "0")).join("");
}

// selected-tab-application/receive.mjs
var SELECTED_TAB_SCHEMA = "meri.selected-tab/1";
var SELECTED_TAB_LIMITS = Object.freeze({ textBytes: 262144, messageBytes: 524288, pairingMs: 6e5, captureMs: 6e4 });
var admitted = /* @__PURE__ */ new WeakSet();
var encoder = new TextEncoder();
var uuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
var documentId = (v) => uuid(v) || typeof v === "string" && /^[0-9A-Fa-f]{32}$/u.test(v);
var integer = (v) => Number.isSafeInteger(v) && v >= 0;
var fail2 = () => {
  throw Error("INVALID_SELECTED_TAB_MESSAGE");
};
function closed(v, keys) {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== keys.length || keys.some((k) => !Object.hasOwn(v, k))) fail2();
}
function label(v, max) {
  if (typeof v !== "string" || !v.trim() || v.length > max || /[\u0000-\u001f\u007f]/u.test(v)) fail2();
}
function binding(v) {
  closed(v, ["tenantId", "actorId", "conversationId", "clientId"]);
  if (!uuid(v.tenantId) || !uuid(v.actorId) || !uuid(v.conversationId) || v.clientId !== null && !uuid(v.clientId)) fail2();
}
function source(v) {
  label(v.title, 256);
  let url;
  try {
    url = new URL(v.url);
  } catch {
    fail2();
  }
  if (typeof v.url !== "string" || v.url.length > 4096 || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.href !== v.url) fail2();
  if (typeof v.text !== "string" || !v.text.trim() || !v.text.isWellFormed() || v.text.includes("\0") || encoder.encode(v.text).byteLength > SELECTED_TAB_LIMITS.textBytes) fail2();
}
var original = (v) => encoder.encode(`Selected tab: ${v.title}
Source: ${v.url}

${v.text}
`);
function selectedTabOriginal(value) {
  if (!admitted.has(value) || value.type !== "share") fail2();
  return original(value);
}
function sameSelectedTabBinding(a, b) {
  return ["tenantId", "actorId", "conversationId", "clientId"].every((k) => a[k] === b[k]);
}
async function receiveSelectedTabMessage(direction, text) {
  if (typeof text !== "string" || text.length > SELECTED_TAB_LIMITS.messageBytes) fail2();
  const v = parseBytes(encoder.encode(text), SELECTED_TAB_LIMITS.messageBytes);
  if (v?.schema !== SELECTED_TAB_SCHEMA || !uuid(v.pairingId)) fail2();
  if (direction === "application") {
    if (v.type === "pair") {
      closed(v, ["schema", "type", "pairingId", "binding", "labels", "expiresAtMs"]);
      binding(v.binding);
      closed(v.labels, ["account", "conversation"]);
      label(v.labels.account, 128);
      label(v.labels.conversation, 256);
      if (!integer(v.expiresAtMs) || v.expiresAtMs === 0) fail2();
    } else if (["pause", "revoke"].includes(v.type)) closed(v, ["schema", "type", "pairingId"]);
    else if (v.type === "outcome") {
      closed(v, ["schema", "type", "pairingId", "selectionId", "state", "requestId"]);
      if (!uuid(v.selectionId) || !["stored", "unknown", "refused"].includes(v.state) || v.requestId !== null && !uuid(v.requestId) || v.state === "stored" && v.requestId === null) fail2();
    } else fail2();
  } else if (direction === "extension") {
    if (v.type === "status") {
      closed(v, ["schema", "type", "pairingId", "deviceId", "state"]);
      if (!uuid(v.deviceId) || !["connected", "active", "paused", "expired", "revoked", "disconnected"].includes(v.state)) fail2();
    } else if (v.type === "share") {
      closed(v, ["schema", "type", "pairingId", "deviceId", "selectionId", "binding", "tabId", "documentId", "url", "title", "capturedAtMs", "text", "bytes", "sha256"]);
      binding(v.binding);
      source(v);
      if (!uuid(v.deviceId) || !uuid(v.selectionId) || !documentId(v.documentId) || !integer(v.tabId) || !integer(v.capturedAtMs) || !integer(v.bytes) || v.bytes > SELECTED_TAB_LIMITS.textBytes + 8192 || typeof v.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(v.sha256)) fail2();
      const bytes = original(v);
      if (bytes.byteLength !== v.bytes || await digest(bytes) !== v.sha256) fail2();
    } else fail2();
  } else fail2();
  admitted.add(v);
  return v;
}
async function createSelectedTabShare(input) {
  source(input);
  const bytes = original(input);
  return receiveSelectedTabMessage("extension", JSON.stringify({ ...input, bytes: bytes.byteLength, sha256: await digest(bytes) }));
}
export {
  SELECTED_TAB_LIMITS,
  SELECTED_TAB_SCHEMA,
  createSelectedTabShare,
  receiveSelectedTabMessage,
  sameSelectedTabBinding,
  selectedTabOriginal
};
