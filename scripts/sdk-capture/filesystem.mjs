// Trusted-local confined filesystem primitives for the SDK raw-capture decoder:
// symlink/junction-safe ancestor checks, bounded fatal-UTF-8 identity-continuous
// file reads and exclusive destination inspection.
//
// Depends only on the protocol leaf module. Importing it performs no filesystem
// or network work; realIo is the shared default IO surface. The io.fs argument
// on the read/destination functions is injectable for race tests.

import * as nodeFs from 'node:fs';
import { TextDecoder } from 'node:util';
import { dirname, resolve, sep, relative, isAbsolute } from 'node:path';

import { MAX_INPUT_BYTES, errMsg } from './protocol.mjs';

export const realIo = Object.freeze({ fs: nodeFs });

function sameIdentity(a, b) {
  // dev/ino/size only; hardlink membership is enforced separately by explicit
  // nlink===1 gates on BOTH the path and descriptor observations, before AND
  // after the read (a hardlink swap that keeps dev/ino/size is still caught).
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size;
}
function sameTimestamps(a, b) {
  return a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

/** Check `dir` AND every ancestor up to the root are real, non-symlink dirs. */
export function assertSafeAncestors(fs, dir) {
  let cur = resolve(dir);
  const seen = new Set();
  while (true) {
    if (seen.has(cur)) break;
    seen.add(cur);
    let st;
    try { st = fs.lstatSync(cur); } catch { throw new Error(`directory is missing: ${cur}`); }
    if (st.isSymbolicLink()) throw new Error(`directory is a symlink/junction: ${cur}`);
    if (!st.isDirectory()) throw new Error(`path component is not a directory: ${cur}`);
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
}

/**
 * Read the full bounded original file bytes with strict fatal UTF-8 and
 * descriptor/path identity continuity. io is injectable for race tests.
 */
export function readCaptureFile(filePath, io = realIo) {
  const fs = io.fs;
  if (typeof filePath !== 'string' || filePath.length === 0) throw new Error('input path required');
  const abs = resolve(filePath);
  assertSafeAncestors(fs, dirname(abs)); // immediate parent AND all ancestors
  let pre;
  try { pre = fs.lstatSync(abs); } catch { throw new Error('cannot stat input'); }
  if (pre.isSymbolicLink()) throw new Error('input is a symlink/junction');
  if (!pre.isFile()) throw new Error('input is not a regular file');
  if (pre.nlink !== 1) throw new Error('input has multiple hard links');
  if (pre.size > MAX_INPUT_BYTES) throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes`);
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(abs, flags);
  let buf;
  let fstBefore;
  let fstAfter;
  try {
    fstBefore = fs.fstatSync(fd);
    if (!fstBefore.isFile()) throw new Error('input is not a regular file');
    if (fstBefore.nlink !== 1) throw new Error('input has multiple hard links');
    if (fstBefore.size > MAX_INPUT_BYTES) throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes`);
    if (!sameIdentity(pre, fstBefore)) throw new Error('input identity mismatch (path vs descriptor)');
    buf = Buffer.allocUnsafe(fstBefore.size);
    let read = 0;
    while (read < fstBefore.size) {
      const n = fs.readSync(fd, buf, read, fstBefore.size - read, read);
      if (n <= 0) break;
      read += n;
    }
    if (read !== fstBefore.size) throw new Error(`short read ${read}/${fstBefore.size}`);
    fstAfter = fs.fstatSync(fd);
  } finally { fs.closeSync(fd); }
  if (!sameIdentity(fstBefore, fstAfter) || !sameTimestamps(fstBefore, fstAfter)) throw new Error('input changed during read');
  if (fstAfter.nlink !== 1) throw new Error('input has multiple hard links');
  let post;
  try { post = fs.lstatSync(abs); } catch { throw new Error('input vanished after read'); }
  if (post.nlink !== 1) throw new Error('input has multiple hard links');
  if (!sameIdentity(pre, post) || !sameTimestamps(pre, post)) throw new Error('input path changed during read');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf); } catch { throw new Error('input is not valid UTF-8'); }
  return { buffer: buf, text, path: abs };
}

export function checkDestination(outDir, io = realIo) {
  const fs = io.fs;
  const reasons = [];
  if (typeof outDir !== 'string' || outDir.length === 0) return { ok: false, reasons: ['destination path required'], abs: null };
  if (outDir.includes('\0')) return { ok: false, reasons: ['destination path is invalid'], abs: null };
  if (outDir.split(/[\\/]+/).includes('..')) return { ok: false, reasons: ['destination must not contain .. traversal'], abs: null };
  const abs = resolve(outDir);
  if (abs === dirname(abs)) return { ok: false, reasons: ['destination must not be the filesystem root'], abs: null };
  try { assertSafeAncestors(fs, dirname(abs)); } catch (error) { reasons.push(errMsg(error)); }
  if (fs.existsSync(abs)) reasons.push(`destination already exists: ${abs}`);
  return { ok: reasons.length === 0, reasons, abs };
}

export function pathedContained(root, child) {
  const rel = relative(resolve(root), resolve(child));
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}