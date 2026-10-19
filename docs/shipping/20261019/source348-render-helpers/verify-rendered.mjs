// Reads ONLY the non-secret parts of a render output (<role>/expected.json and summary.json), never bundle.json or config.json, and proves that every
// role is bound to the expected images and source and that summary.json and each expected.json describe the SAME render (the same cross-check
// stage3-bindings.mjs performs). Output is safe to share (role names, digest and commit prefixes, validity dates).
//
//   node verify-rendered.mjs <rendered-dir> <node digest, 64 hex> <proxy digest, 64 hex> <node source commit, 40 hex> <proxy source commit, 40 hex>
//
// Exit 0 = every check passed for all five roles; 1 = a mismatch or a missing/unreadable file; 2 = usage error. A missing or unreadable summary.json,
// or any missing role in it, is a failure, never a pass.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir, node, proxy, nodeSource, proxySource] = process.argv.slice(2);
const hex = (v, n) => typeof v === 'string' && new RegExp(`^[a-f0-9]{${n}}$`, 'u').test(v);
if (!dir || !hex(node, 64) || !hex(proxy, 64) || !hex(nodeSource, 40) || !hex(proxySource, 40)) {
  console.error('usage: node verify-rendered.mjs <rendered-dir> <node digest 64 hex> <proxy digest 64 hex> <node source commit 40 hex> <proxy source commit 40 hex>');
  process.exit(2);
}
const ROLES = [['control', node, nodeSource], ['temporal-worker', node, nodeSource], ['temporal-issuer', node, nodeSource], ['model-owner', node, nodeSource], ['model-proxy', proxy, proxySource]];
const read = (...parts) => { try { return JSON.parse(readFileSync(join(dir, ...parts), 'utf8')); } catch { return null; } };
const same = (a, b) => JSON.stringify(a, Object.keys(a ?? {}).sort()) === JSON.stringify(b, Object.keys(b ?? {}).sort());
const digestOf = v => String(v ?? '').replace(/^sha256:/u, '');

const summary = read('summary.json');
const failures = [];
if (summary === null) failures.push('summary.json is missing or unreadable');
else if (summary.schemaVersion !== 1 || summary.roles === null || typeof summary.roles !== 'object') failures.push('summary.json is not a render summary (schemaVersion 1 with roles)');
let bad = 0;
for (const [role, wantDigest, wantSource] of ROLES) {
  const e = read(role, 'expected.json');
  const r = summary?.roles?.[role];
  const problems = [];
  if (e === null) problems.push('expected.json missing or unreadable');
  if (!r) problems.push('role absent from summary.json');
  if (e !== null) {
    if (e.role !== role) problems.push('expected.json names another role');
    if (digestOf(e.imageDigest) !== wantDigest) problems.push('image digest differs from the expected one');
    if (e.sourceCommit !== wantSource) problems.push('source commit differs from the expected full SHA');
  }
  if (e !== null && r) {
    if (e.materialContractSha256 !== r.materialContractSha256) problems.push('materialContractSha256 differs between expected.json and summary.json');
    if (!same(e.sha256ByPath, r.sha256ByPath)) problems.push('sha256ByPath differs between expected.json and summary.json');
    if (digestOf(e.imageDigest) !== digestOf(r.imageDigest)) problems.push('imageDigest differs between expected.json and summary.json');
    if (typeof r.configPath !== 'string' || e.sha256ByPath?.[r.configPath] !== r.configSha256) problems.push('config pin differs between expected.json and summary.json');
  }
  if (problems.length) bad++;
  console.log(`${problems.length ? 'MISMATCH' : 'ok      '} ${role.padEnd(16)} digest ${digestOf(e?.imageDigest).slice(0, 12)}…  source ${String(e?.sourceCommit ?? '').slice(0, 12)}${problems.length ? '  <- ' + problems.join('; ') : ''}`);
}
for (const f of failures) console.log('FAIL     ' + f);
if (!failures.length && !bad) console.log('validity:', JSON.stringify({notAfter: summary.validity?.notAfter, earliestCertificateNotAfter: summary.validity?.earliestCertificateNotAfter, validityDays: summary.validity?.validityDays}));
process.exit(failures.length || bad ? 1 : 0);
