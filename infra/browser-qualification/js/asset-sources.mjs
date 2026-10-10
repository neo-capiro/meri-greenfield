// Fixed raw-byte support closure. Import is inert; reads occur only on request.
import { lstatSync, openSync, fstatSync, readSync, closeSync, constants, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PINS } from './config.mjs';

export const SOURCE_FILES = Object.freeze([
  ['bootstrap.sh', 'bootstrap.sh'], ['host-evidence.py', 'host-evidence.py'],
  ['host_evidence/__init__.py', 'host_evidence/__init__.py'],
  ['host_evidence/admission.py', 'host_evidence/admission.py'],
  ['host_evidence/browser_capture.py', 'host_evidence/browser_capture.py'],
  ['host_evidence/classification.py', 'host_evidence/classification.py'],
  ['host_evidence/cli.py', 'host_evidence/cli.py'],
  ['host_evidence/collection.py', 'host_evidence/collection.py'],
  ['host_evidence/config.py', 'host_evidence/config.py'],
  ['host_evidence/evidence_io.py', 'host_evidence/evidence_io.py'],
  ['host_evidence/export_protocol.py', 'host_evidence/export_protocol.py'],
  ['host_evidence/poll.py', 'host_evidence/poll.py'],
  ['host_evidence/source_binding.py', 'host_evidence/source_binding.py'],
  ['seccomp.chromium-155-amd64.json', 'seccomp.json'],
].map(([name, target]) => Object.freeze({ name, target })));

export function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }
const sibling = (name) => new URL(name, new URL('../', import.meta.url));
const identity = (s) => [s.dev, s.ino, s.mode, s.nlink, s.size, s.mtimeMs, s.ctimeMs].join('|');
function readSource(name) {
  const path = sibling(name);
  const before = lstatSync(path);
  if (!before.isFile() || before.nlink !== 1 || before.size < 1 || before.size > 2097152) throw new Error('Unsafe source file');
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const opened = fstatSync(fd);
    if (identity(opened) !== identity(before)) throw new Error('Source changed before open');
    const bytes = Buffer.alloc(before.size + 1);
    let used = 0, count;
    while (used < bytes.length && (count = readSync(fd, bytes, used, bytes.length - used, null)) > 0) used += count;
    if (used !== before.size || identity(opened) !== identity(fstatSync(fd)) || identity(opened) !== identity(lstatSync(path))) throw new Error('Source changed during read');
    return bytes.subarray(0, used);
  } finally { if (fd !== undefined) closeSync(fd); }
}
export function sourceObject(sources) {
  if (!Array.isArray(sources) || sources.length !== 14 || sources.some((s, i) => s.target !== SOURCE_FILES[i].target || !Buffer.isBuffer(s.bytes) || s.bytes.length < 1 || s.bytes.length > 2097152)) throw new Error('Fixed fourteen sources required');
  return { assets: sources.map(({ target, bytes }) => ({ bytes: bytes.length, path: target, sha256: sha256(bytes) })), schema: 'meri-browser-source/2' };
}
export function sourceManifestBytes(sources) { return Buffer.from(JSON.stringify(sourceObject(sources)) + '\n', 'ascii'); }
export function exactSources() {
  const pins = JSON.parse(readFileSync(sibling('component-pins.json'), 'utf8')).browserAssets;
  const sources = SOURCE_FILES.map(({ name, target }) => ({ name, target, bytes: readSource(name) }));
  const actual = sourceObject(sources);
  if (pins?.schema !== actual.schema || JSON.stringify(pins.assets) !== JSON.stringify(actual.assets)) throw new Error('Reviewed fourteen-source inventory changed');
  const profile = sources[13].bytes;
  if (profile.length !== PINS.seccompDerivedBytes || sha256(profile) !== PINS.seccompDerivedSha256) throw new Error('Pinned derived seccomp changed');
  return sources;
}
