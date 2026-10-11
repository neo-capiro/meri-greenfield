// Qualification candidate. The trusted transport, not this worker adapter,
// owns authentication, durable commits and atomic writerFence enforcement.
// Importing this module does not connect, spawn or read ambient credentials.
import { isDeepStrictEqual } from 'node:util';
import { validateShape } from '@capiro/meri-contracts/node';

const BATCH = Object.freeze({ bytes: 8 * 1024 * 1024, entries: 1000 });
const TRANSCRIPT = Object.freeze({ bytes: 32 * 1024 * 1024, entries: 100000 });
const MAX_PENDING = 128;
const fail = code => { throw Object.assign(new Error(code), { code }); };

function jsonCopy(value, maxBytes = BATCH.bytes) {
  try {
    const encoded = JSON.stringify(value);
    if (!encoded || Buffer.byteLength(encoded) > maxBytes) fail('SESSION_PAYLOAD_BOUND');
    const copy = JSON.parse(encoded);
    if (!isDeepStrictEqual(copy, value)) fail('SESSION_NOT_JSON_SAFE');
    return copy;
  } catch (error) {
    if (error?.code?.startsWith('SESSION_')) throw error;
    fail('SESSION_NOT_JSON_SAFE');
  }
}

function copyEntries(entries, limits) {
  if (!Array.isArray(entries) || entries.length > limits.entries) fail('SESSION_ENTRY_BOUND');
  const copy = jsonCopy(entries, limits.bytes);
  if (copy.some(e => !e || typeof e !== 'object' || Array.isArray(e) || typeof e.type !== 'string'))
    fail('SESSION_ENTRY_SHAPE');
  return copy;
}
export const copySessionEntries = entries => copyEntries(entries, BATCH);
export const copySessionTranscript = entries => copyEntries(entries, TRANSCRIPT);

export function scopedSessionKey(key, scope, mainOnly = false) {
  if (!scope || typeof scope.projectKey !== 'string' || !scope.projectKey || scope.projectKey.length > 256 ||
      typeof scope.sessionId !== 'string' || !scope.sessionId || scope.sessionId.length > 128 ||
      !key || typeof key !== 'object' || Object.keys(key).some(k => !['projectKey', 'sessionId', 'subpath'].includes(k)) ||
      key.projectKey !== scope.projectKey || key.sessionId !== scope.sessionId ||
      (key.subpath !== undefined && (mainOnly || typeof key.subpath !== 'string' || !key.subpath || key.subpath.length > 1024)))
    fail('SESSION_KEY_SCOPE');
  // subpath remains opaque. It is never resolved as a local filesystem path.
  return Object.freeze({ projectKey: key.projectKey, sessionId: key.sessionId,
    ...(key.subpath === undefined ? {} : { subpath: key.subpath }) });
}

/**
 * Implements the pinned SDK append/load/listSubkeys interface for ONE session.
 * transport.{append,load,listSubkeys} receive {binding,key,entries?,signal}.
 * They MUST validate current authority at execution/commit, not at enqueue time.
 * A fulfilled append is only a transport acknowledgement, not a checkpoint.
 * Only SESSION_WRITE_REJECTED denotes a confirmed refusal before commit.
 * Every other failed append is uncertain and prevents subsequent dispatch.
 */
export function createRunBoundSessionStore({ binding, sessionKey, transport, timeoutMs = 5000 }) {
  const ownedBinding = jsonCopy(binding);
  try { validateShape('RunBinding', ownedBinding); } catch { fail('SESSION_RUN_BINDING'); }
  Object.freeze(ownedBinding);
  if (!sessionKey || typeof sessionKey.projectKey !== 'string' || !sessionKey.projectKey ||
      sessionKey.projectKey.length > 256 || typeof sessionKey.sessionId !== 'string' || !sessionKey.sessionId ||
      sessionKey.sessionId.length > 128) fail('SESSION_KEY_SCOPE');
  const scope = scopedSessionKey(sessionKey, sessionKey, true);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) fail('SESSION_TIMEOUT_POLICY');
  if (!transport || ['append', 'load', 'listSubkeys'].some(name => typeof transport[name] !== 'function'))
    fail('SESSION_TRANSPORT_REQUIRED');
  let tail = Promise.resolve(), pending = 0, pendingBytes = 0, closed = false, uncertain = false;
  let appendFailures = 0, rejectedAppends = 0, mirrorErrors = 0;

  async function invoke(method, key, entries) {
    if (uncertain) fail('SESSION_TRANSPORT_UNCERTAIN');
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          // Aborting cannot undo an already dispatched remote write. Do not
          // let an SDK retry or a queued operation dispatch after this timeout.
          uncertain = true;
          controller.abort();
          reject(Object.assign(new Error('SESSION_TRANSPORT_UNCERTAIN'), { code: 'SESSION_TRANSPORT_UNCERTAIN' }));
        }, timeoutMs);
      });
      return await Promise.race([Promise.resolve().then(() => transport[method]({
        binding: ownedBinding, key, ...(entries === undefined ? {} : { entries }), signal: controller.signal,
      })), timeout]);
    } catch (error) {
      if (method === 'append' && error?.code !== 'SESSION_WRITE_REJECTED') uncertain = true;
      fail(uncertain ? 'SESSION_TRANSPORT_UNCERTAIN' : 'SESSION_TRANSPORT_FAILED');
    } finally { clearTimeout(timer); }
  }

  function enqueue(operation, bytes = 0) {
    if (pending >= MAX_PENDING || pendingBytes + bytes > TRANSCRIPT.bytes)
      return Promise.reject(Object.assign(new Error('SESSION_QUEUE_BOUND'), { code: 'SESSION_QUEUE_BOUND' }));
    pending++; pendingBytes += bytes;
    const next = tail.then(operation);
    tail = next.catch(() => {}).finally(() => { pending--; pendingBytes -= bytes; });
    return next;
  }

  /** @type {import('@anthropic-ai/claude-agent-sdk').SessionStore} */
  const store = Object.freeze({
    async append(key, entries) {
      if (closed) { rejectedAppends++; fail('SESSION_MIRROR_CLOSED'); }
      const ownedKey = scopedSessionKey(key, scope), ownedEntries = copySessionEntries(entries);
      try { await enqueue(() => invoke('append', ownedKey, ownedEntries), Buffer.byteLength(JSON.stringify(ownedEntries))); }
      catch (error) { appendFailures++; throw error; }
    },
    async load(key) {
      const ownedKey = scopedSessionKey(key, scope);
      const result = await enqueue(() => invoke('load', ownedKey));
      return result === null ? null : copySessionTranscript(result);
    },
    async listSubkeys(key) {
      const ownedKey = scopedSessionKey(key, scope, true);
      const result = await enqueue(() => invoke('listSubkeys', ownedKey));
      if (!Array.isArray(result) || result.length > 255 || new Set(result).size !== result.length)
        fail('SESSION_SUBKEY_SHAPE');
      for (const subpath of result) scopedSessionKey({ ...scope, subpath }, scope);
      return [...result];
    },
  });
  return Object.freeze({
    store,
    closeMirror() { closed = true; },
    recordMirrorError(message) {
      if (message?.type === 'system' && message.subtype === 'mirror_error') mirrorErrors++;
    },
    // Only calls ALREADY observed by this adapter. This is deliberately not an
    // SDK flush barrier, quiescence proof, or a durable checkpoint receipt.
    async settleObservedCalls() { await tail; return { pending, closed, uncertain, appendFailures, rejectedAppends, mirrorErrors }; },
  });
}
