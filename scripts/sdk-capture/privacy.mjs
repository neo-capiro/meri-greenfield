// Privacy / confidentiality primitives for the SDK raw-capture decoder.
//
// Independent credential-key/value/header-sensitive predicates and scrubbing,
// equivalent in semantics to the accepted producer but re-implemented here so
// the decoder never trusts a producer boolean. Leaf module: imports NO other
// decoder module; performs no filesystem or network work on import.

const SECRET_VALUE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{6,}/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{10,}\b/g,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g,
  /Bearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi,
];

/** Redact secret-like substrings from arbitrary text (producer-equivalent). */
export function scrubSecrets(text) {
  let out = String(text ?? '');
  for (const re of SECRET_VALUE_PATTERNS) out = out.replace(re, '<redacted>');
  out = out.replace(
    /([\"']?[A-Za-z0-9_.-]*(?:key|token|secret|password|credential|authorization)[A-Za-z0-9_.-]*[\"']?\s*[:=]\s*)(\"[^\"]*\"|'[^']*'|[^\s,;}]+)/gi,
    '$1<redacted>',
  );
  return out;
}

/** True when the text appears to contain secret-like material. */
export function looksLikeSecret(text) {
  const s = String(text ?? '');
  return SECRET_VALUE_PATTERNS.some((re) => { re.lastIndex = 0; return re.test(s); });
}

// Credential NAMES are SEMANTIC. A key is credential-named only when one of its
// delimiter/camelCase/acronym-separated segments is a credential word. Plural
// accounting fields (max_tokens/input_tokens/output_tokens -> "tokens") are NOT
// credential names.
const CRED_KEY_SEGMENTS = new Set(['key', 'apikey', 'token', 'secret', 'password', 'passwd', 'passphrase', 'credential', 'credentials', 'authorization', 'bearer', 'cookie']);
export function isCredentialKey(k) {
  return String(k)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((seg) => seg && CRED_KEY_SEGMENTS.has(seg));
}

/** Recursive, depth/seen-bounded credential detection (depth>12 fails closed). */
export function hasSensitiveBody(value, depth = 0, seen = new Set()) {
  if (depth > 12) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return looksLikeSecret(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((v) => hasSensitiveBody(v, depth + 1, seen));
  for (const [k, v] of Object.entries(value)) {
    if (isCredentialKey(k) && v !== null && v !== undefined) return true;
    if (hasSensitiveBody(v, depth + 1, seen)) return true;
  }
  return false;
}

export const SENSITIVE_HEADER_NAME = /authorization|cookie|api[-_]?key|auth|token|secret|credential|password|passwd|bearer/i;