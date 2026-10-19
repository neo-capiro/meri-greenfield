// Reads ONLY the non-secret parts of a render output (<role>/expected.json and summary.json), never bundle.json or config.json. It proves that every
// role is bound to the expected images and source, that summary.json and each expected.json describe the SAME render (the cross-check stage3-bindings.mjs
// performs), and that the summary's validity window is well formed. Every compared value must be PRESENT and correctly shaped: an absent value never
// "matches" another absent value. Output is safe to share (role names, digest and commit prefixes, validity dates).
//
//   node verify-rendered.mjs <rendered-dir> <node digest, 64 hex> <proxy digest, 64 hex> <node source commit, 40 hex> <proxy source commit, 40 hex>
//
// Exit 0 = every check passed for all five roles; 1 = a mismatch, a malformed or missing value, or a missing/unreadable file; 2 = usage error.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir, node, proxy, nodeSource, proxySource] = process.argv.slice(2);
const HEX = n => new RegExp(`^[a-f0-9]{${n}}$`, 'u');
const is = (re, v) => typeof v === 'string' && re.test(v);
if (!dir || !is(HEX(64), node) || !is(HEX(64), proxy) || !is(HEX(40), nodeSource) || !is(HEX(40), proxySource)) {
  console.error('usage: node verify-rendered.mjs <rendered-dir> <node digest 64 hex> <proxy digest 64 hex> <node source commit 40 hex> <proxy source commit 40 hex>');
  process.exit(2);
}
const ROLES = [['control', node, nodeSource], ['temporal-worker', node, nodeSource], ['temporal-issuer', node, nodeSource], ['model-owner', node, nodeSource], ['model-proxy', proxy, proxySource]];
const read = (...parts) => { try { return JSON.parse(readFileSync(join(dir, ...parts), 'utf8')); } catch { return null; } };
const IMAGE = /^sha256:[a-f0-9]{64}$/u;
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hashMap = m => isObject(m) && Object.keys(m).length > 0 && Object.values(m).every(v => is(HEX(64), v));
const sameMap = (a, b) => { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]); };

const summary = read('summary.json');
const failures = [];
if (summary === null) failures.push('summary.json is missing or unreadable');
else if (summary.schemaVersion !== 1 || !isObject(summary.roles)) failures.push('summary.json is not a render summary (schemaVersion 1 with roles)');

// Validity fields: all present and well formed, consistent with each other, and the window must still be open.
if (isObject(summary)) {
  const v = summary.validity;
  const date = s => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(s) && !Number.isNaN(Date.parse(s)) ? Date.parse(s) : null);
  if (!isObject(v)) failures.push('summary.validity is absent');
  else {
    const na = date(v.notAfter), ec = date(v.earliestCertificateNotAfter);
    if (!Number.isFinite(v.validityDays) || v.validityDays <= 0) failures.push('summary.validity.validityDays is absent or not a positive number');
    if (!Number.isSafeInteger(v.notAfterMs)) failures.push('summary.validity.notAfterMs is absent or not an integer');
    if (na === null) failures.push('summary.validity.notAfter is absent or not an ISO-8601 UTC date');
    if (ec === null) failures.push('summary.validity.earliestCertificateNotAfter is absent or not an ISO-8601 UTC date');
    if (na !== null && Number.isSafeInteger(v.notAfterMs) && na !== v.notAfterMs) failures.push('summary.validity.notAfter does not equal notAfterMs');
    if (na !== null && ec !== null && na >= ec) failures.push('the validity window does not end before the earliest certificate notAfter');
    if (na !== null && na <= Date.now()) failures.push('the validity window has already ended');
    if (Number.isSafeInteger(summary.generatedAtMs) && Number.isSafeInteger(v.notAfterMs) && Number.isFinite(v.validityDays)
      && Math.abs(v.notAfterMs - summary.generatedAtMs - v.validityDays * 86400000) > 60000) failures.push('notAfterMs is not generatedAtMs plus validityDays');
    if (!Number.isSafeInteger(summary.generatedAtMs)) failures.push('summary.generatedAtMs is absent or not an integer');
  }
}

let bad = 0;
for (const [role, wantDigest, wantSource] of ROLES) {
  const e = read(role, 'expected.json');
  const r = isObject(summary?.roles) ? summary.roles[role] : undefined;
  const problems = [];
  if (e === null) problems.push('expected.json missing or unreadable');
  else if (!isObject(e)) problems.push('expected.json is not a JSON object (an array or a scalar is never a valid record)');
  if (!isObject(r)) problems.push('role absent from summary.json');
  if (isObject(e)) {
    if (e.role !== role) problems.push('expected.json names another role');
    if (!is(IMAGE, e.imageDigest)) problems.push('expected.imageDigest is absent or malformed');
    else if (e.imageDigest !== `sha256:${wantDigest}`) problems.push('image digest differs from the expected one');
    if (!is(HEX(40), e.sourceCommit)) problems.push('expected.sourceCommit is absent or not a full 40-hex SHA');
    else if (e.sourceCommit !== wantSource) problems.push('source commit differs from the expected full SHA');
    if (!is(HEX(64), e.materialContractSha256)) problems.push('expected.materialContractSha256 is absent or malformed');
    if (!hashMap(e.sha256ByPath)) problems.push('expected.sha256ByPath is absent, empty or holds a malformed hash');
  }
  if (isObject(r)) {
    if (!is(IMAGE, r.imageDigest)) problems.push('summary imageDigest is absent or malformed');
    if (!is(HEX(40), r.sourceCommit)) problems.push('summary sourceCommit is absent or not a full 40-hex SHA');
    if (!is(HEX(64), r.materialContractSha256)) problems.push('summary materialContractSha256 is absent or malformed');
    if (!hashMap(r.sha256ByPath)) problems.push('summary sha256ByPath is absent, empty or holds a malformed hash');
    if (typeof r.configPath !== 'string' || r.configPath === '') problems.push('summary configPath is absent');
    if (!is(HEX(64), r.configSha256)) problems.push('summary configSha256 is absent or malformed');
  }
  if (isObject(e) && isObject(r) && !problems.length) {
    if (e.imageDigest !== r.imageDigest) problems.push('imageDigest differs between expected.json and summary.json');
    if (e.sourceCommit !== r.sourceCommit) problems.push('sourceCommit differs between expected.json and summary.json');
    if (e.materialContractSha256 !== r.materialContractSha256) problems.push('materialContractSha256 differs between expected.json and summary.json');
    if (!sameMap(e.sha256ByPath, r.sha256ByPath)) problems.push('sha256ByPath differs between expected.json and summary.json');
    if (e.sha256ByPath[r.configPath] !== r.configSha256) problems.push('config pin: expected.sha256ByPath[configPath] differs from summary configSha256');
  }
  if (problems.length) bad++;
  console.log(`${problems.length ? 'MISMATCH' : 'ok      '} ${role.padEnd(16)} digest ${String(e?.imageDigest ?? '').replace(/^sha256:/u, '').slice(0, 12)}…  source ${String(e?.sourceCommit ?? '').slice(0, 12)}${problems.length ? '  <- ' + problems.join('; ') : ''}`);
}
for (const f of failures) console.log('FAIL     ' + f);
if (!failures.length && !bad) console.log('validity:', JSON.stringify({notAfter: summary.validity.notAfter, earliestCertificateNotAfter: summary.validity.earliestCertificateNotAfter, validityDays: summary.validity.validityDays}));
process.exit(failures.length || bad ? 1 : 0);
