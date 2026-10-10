// W02-18 bounded regular-file reader.
//
// This module performs NO filesystem work on import: every syscall happens only
// when readBoundedRegularFile is invoked. It is the only module in this task that
// touches the filesystem; binding/request modules stay pure and the CLI merely
// orchestrates. Reads never write, create, temp or overwrite anything.
//
// Repair F3: every IO/close path yields a bounded, content-free refusal; the handle
// is closed on every branch and a close failure can never become success or erase an
// earlier refusal; initial path / initial descriptor / final descriptor / final path
// observations are compared consistently (identity, type, hard-link policy, size,
// total bytes and available timestamps).
//
// Honest limits: on Windows, O_NOFOLLOW is undefined so it is omitted, and junction /
// reparse ancestors are only detectable when lstat reports them as symbolic links.
// Timestamp comparison catches same-size writes only when the filesystem exposes
// microsecond mtime/ctime resolution; a same-user actor can still race the checkout.
// This is an offline trusted-checkout bound, not an atomic hostile-filesystem
// execution boundary.

import * as nodeFs from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, dirname } from 'node:path';

export const CHUNK_BYTES = 64 * 1024;
export const LINK_LIMIT = 1;

const MESSAGES = Object.freeze({
  'path-not-absolute': 'file path must be absolute',
  'bad-max-bytes': 'internal byte bound is invalid',
  'ancestor-link': 'a visible ancestor path is a symlink/junction',
  'ancestor-missing': 'a visible ancestor path is missing',
  missing: 'input file is missing',
  symlink: 'input file is a symlink/junction',
  'not-regular': 'input is not a regular file',
  'multiple-hard-links': 'input has multiple hard links',
  unreadable: 'input file cannot be opened',
  'identity-mismatch': 'path and descriptor identity differ',
  'too-large': 'input exceeds the byte bound',
  'changed-during-read': 'input changed during the read',
  'io-error': 'input file read failed',
  'close-failed': 'input handle could not be closed',
});

const defaultOps = Object.freeze({
  lstat: (p) => nodeFs.lstatSync(p, { throwIfNoEntry: false }),
  open: (p, flags) => nodeFs.openSync(p, flags),
  fstat: (fd) => nodeFs.fstatSync(fd),
  read: (fd, buf, off, len, pos) => nodeFs.readSync(fd, buf, off, len, pos),
  close: (fd) => nodeFs.closeSync(fd),
});

const readFlags = () => nodeFs.constants.O_RDONLY | (nodeFs.constants.O_NOFOLLOW || 0);

// Bounded wrapper: any thrown IO error becomes the constant code, never a message.
function call(fn, code) {
  try {
    return { ok: true, value: fn() };
  } catch {
    return { ok: false, code };
  }
}

function refused(code, handleClosed, closeFailed) {
  const result = { ok: false, error: { code, message: MESSAGES[code] || 'read refused' }, handleClosed: Boolean(handleClosed) };
  if (closeFailed) result.closeFailed = true;
  return result;
}

const sameIdentity = (a, b) => a.dev === b.dev && a.ino === b.ino;
const overLinkLimit = (st) => typeof st.nlink === 'number' && st.nlink > LINK_LIMIT;
function sameTimestamps(a, b) {
  for (const key of ['mtimeMs', 'ctimeMs']) {
    if (typeof a[key] === 'number' && typeof b[key] === 'number' && a[key] !== b[key]) return false;
  }
  return true;
}

function checkAncestors(absPath, ops) {
  let dir = dirname(absPath);
  for (;;) {
    const r = call(() => ops.lstat(dir), 'io-error');
    if (!r.ok) return r;
    const st = r.value;
    if (!st) return { ok: false, code: 'ancestor-missing' };
    if (typeof st.isSymbolicLink === 'function' && st.isSymbolicLink()) return { ok: false, code: 'ancestor-link' };
    const parent = dirname(dir);
    if (parent === dir) return { ok: true };
    dir = parent;
  }
}

function observe(absPath, maxBytes, ops, setFd) {
  const ancestors = checkAncestors(absPath, ops);
  if (!ancestors.ok) return ancestors;

  const l1 = call(() => ops.lstat(absPath), 'io-error');
  if (!l1.ok) return l1;
  const before = l1.value;
  if (!before) return { ok: false, code: 'missing' };
  if (typeof before.isSymbolicLink === 'function' && before.isSymbolicLink()) return { ok: false, code: 'symlink' };
  if (typeof before.isFile !== 'function' || !before.isFile()) return { ok: false, code: 'not-regular' };
  if (overLinkLimit(before)) return { ok: false, code: 'multiple-hard-links' };

  const opened = call(() => ops.open(absPath, readFlags()), 'unreadable');
  if (!opened.ok) return opened;
  setFd(opened.value);

  const f1 = call(() => ops.fstat(opened.value), 'io-error');
  if (!f1.ok) return f1;
  const firstFd = f1.value;
  if (!firstFd || typeof firstFd.isFile !== 'function' || !firstFd.isFile()) return { ok: false, code: 'not-regular' };
  if (!sameIdentity(before, firstFd)) return { ok: false, code: 'identity-mismatch' };
  if (overLinkLimit(firstFd)) return { ok: false, code: 'multiple-hard-links' };
  if (firstFd.size > maxBytes) return { ok: false, code: 'too-large' };

  const parts = [];
  let total = 0;
  const buf = Buffer.allocUnsafe(CHUNK_BYTES);
  for (;;) {
    const r = call(() => ops.read(opened.value, buf, 0, CHUNK_BYTES, total), 'io-error');
    if (!r.ok) return r;
    const n = r.value;
    if (!Number.isSafeInteger(n) || n < 0 || n > CHUNK_BYTES) return { ok: false, code: 'io-error' };
    if (n === 0) break;
    total += n;
    if (total > maxBytes) return { ok: false, code: 'too-large' };
    parts.push(Buffer.from(buf.subarray(0, n)));
  }

  const f2 = call(() => ops.fstat(opened.value), 'io-error');
  if (!f2.ok) return f2;
  const finalFd = f2.value;
  if (!finalFd || typeof finalFd.isFile !== 'function' || !finalFd.isFile()) return { ok: false, code: 'not-regular' };
  if (overLinkLimit(finalFd)) return { ok: false, code: 'multiple-hard-links' };

  const l2 = call(() => ops.lstat(absPath), 'io-error');
  if (!l2.ok) return l2;
  const after = l2.value;
  if (!after) return { ok: false, code: 'changed-during-read' };
  if (typeof after.isSymbolicLink === 'function' && after.isSymbolicLink()) return { ok: false, code: 'changed-during-read' };
  if (typeof after.isFile !== 'function' || !after.isFile()) return { ok: false, code: 'changed-during-read' };
  if (overLinkLimit(after)) return { ok: false, code: 'changed-during-read' };

  if (!sameIdentity(before, firstFd) || !sameIdentity(before, finalFd) || !sameIdentity(before, after)) return { ok: false, code: 'changed-during-read' };
  if (before.size !== total || firstFd.size !== total || finalFd.size !== total || after.size !== total) return { ok: false, code: 'changed-during-read' };
  if (!sameTimestamps(before, after) || !sameTimestamps(firstFd, finalFd)) return { ok: false, code: 'changed-during-read' };

  const bytes = Buffer.concat(parts, total);
  return { ok: true, bytes, byteLength: total, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/**
 * Read a bounded regular file with identity checks. Never allocates the file before
 * the size bound, never follows a link, never writes, and closes every opened handle.
 *
 * @returns {{ok: true, bytes: Buffer, byteLength: number, sha256: string, handleClosed: boolean}
 *          | {ok: false, error: {code: string, message: string}, handleClosed: boolean, closeFailed?: boolean}}
 */
export function readBoundedRegularFile(absPath, options = {}) {
  const { maxBytes, ops = defaultOps } = options;
  if (typeof absPath !== 'string' || !isAbsolute(absPath)) return refused('path-not-absolute', false, false);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return refused('bad-max-bytes', false, false);

  let fd = null;
  let outcome;
  try {
    outcome = observe(absPath, maxBytes, ops, (handle) => { fd = handle; });
  } catch {
    outcome = { ok: false, code: 'io-error' };
  }

  let closed = false;
  let closeFailed = false;
  if (fd !== null) {
    try {
      ops.close(fd);
      closed = true;
    } catch {
      closeFailed = true;
    }
  }

  if (!outcome.ok) return refused(outcome.code, closed, closeFailed);
  if (closeFailed) return refused('close-failed', closed, true);
  return { ok: true, bytes: outcome.bytes, byteLength: outcome.byteLength, sha256: outcome.sha256, handleClosed: closed };
}
