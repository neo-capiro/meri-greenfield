// W02-21 pinned sibling asset reads and the exactSources byte/hash checks.
// readSibling anchors on the parent directory so the app stays beside its
// assets while this module lives in the sibling js/ package; reads are
// cwd-independent. Importing performs no read.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PINS } from './config.mjs';

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
const readSibling = (name) => readFileSync(new URL(name, new URL('../', import.meta.url)));
function exactSources() {
  return [
    { name: 'bootstrap.sh', target: 'bootstrap.sh', bytes: readSibling('bootstrap.sh') },
    { name: 'host-evidence.py', target: 'host-evidence.py', bytes: readSibling('host-evidence.py') },
    { name: 'seccomp.chromium-155-amd64.json', target: 'seccomp.json', bytes: readSibling('seccomp.chromium-155-amd64.json') },
  ].map((source) => {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(source.bytes);
    if (!source.bytes.equals(Buffer.from(text, 'utf8')) || !text.endsWith('\n') || text.includes('\0') || text.includes('\r')) {
      throw new Error(`Exact UTF-8/LF-only source required (must match the reviewed Git archive): ${source.name}`);
    }
    if (source.target === 'seccomp.json' && (source.bytes.length !== PINS.seccompDerivedBytes || sha256(source.bytes) !== PINS.seccompDerivedSha256)) {
      throw new Error('Pinned derived seccomp bytes/hash changed');
    }
    return source;
  });
}

// Cross-module access without touching the frozen declaration spans.
export { exactSources };
