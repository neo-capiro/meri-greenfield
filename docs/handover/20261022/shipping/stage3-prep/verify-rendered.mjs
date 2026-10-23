// Reads ONLY the non-secret parts of a render output (<role>/expected.json and summary.json), never bundle.json or config.json, and
// proves every role is bound to the accepted image digests.
//   node verify-rendered.mjs <rendered-dir> <accepted node digest (64 hex)> <accepted proxy digest (64 hex)>
// Exit 0 = every role matches; 1 = a mismatch; 2 = usage/read error.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir, node, proxy] = process.argv.slice(2);
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
if (!dir || !hex(node) || !hex(proxy)) { console.error('usage: node verify-rendered.mjs <rendered-dir> <node sha256 hex> <proxy sha256 hex>'); process.exit(2); }
const ROLES = [['control', node], ['temporal-worker', node], ['temporal-issuer', node], ['model-owner', node], ['model-proxy', proxy]];
let bad = 0;
for (const [role, want] of ROLES) {
  let e;
  try { e = JSON.parse(readFileSync(join(dir, role, 'expected.json'), 'utf8')); } catch (err) { console.error(`${role}: cannot read expected.json (${err.code ?? 'error'})`); process.exit(2); }
  const got = String(e.imageDigest ?? '').replace(/^sha256:/u, '');
  const ok = got === want && e.role === role;
  if (!ok) bad++;
  console.log(`${ok ? 'ok      ' : 'MISMATCH'} ${role.padEnd(16)} digest ${got.slice(0, 12)}… (want ${want.slice(0, 12)}…)  sourceCommit ${String(e.sourceCommit ?? '').slice(0, 12)}`);
}
try {
  const s = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
  console.log('validity:', JSON.stringify({notAfter: s.validity?.notAfter, earliestCertificateNotAfter: s.validity?.earliestCertificateNotAfter, validityDays: s.validity?.validityDays}));
} catch { console.log('validity: summary.json not readable'); }
process.exit(bad ? 1 : 0);
