// Certificate expiry check. Reads ONLY public certificate PEMs (<name>.pem; every *.key.pem is skipped) in one directory and
// prints dates. It never opens a private key and never prints any certificate bytes.
//   node cert-expiry.mjs <pki-dir> [minimum days remaining, default 14]
// Exit 0 = every certificate the render uses has at least that many days left; 1 = one is short; 2 = usage/read error.
// The render refuses unless (now + validity-days, default 7) is earlier than the earliest notAfter of these certificates.
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {X509Certificate} from 'node:crypto';

const RENDER_CERTS = ['server-ca', 'issuer-server', 'proxy-server', 'control-private', 'issuer-client-ca', 'runner-ca', 'owner-bridge-ca',
  'owner-server', 'proxy-owner-client', 'temporal-frontend-ca', 'temporal-client-ca', 'temporal-client-control', 'temporal-client-worker'];
const [dir, minArg] = process.argv.slice(2);
const minimum = minArg === undefined ? 14 : Number(minArg);
if (!dir || !Number.isFinite(minimum) || minimum < 0) {
  console.error('usage: node cert-expiry.mjs <pki-dir> [minimum days remaining]');
  process.exit(2);
}
const now = Date.now();
const rows = [];
let names;
try { names = readdirSync(dir).filter(n => n.endsWith('.pem') && !n.endsWith('.key.pem')).sort(); } catch (e) { console.error('cannot read directory: ' + (e.code ?? 'error')); process.exit(2); }
for (const name of names) {
  let cert;
  try { cert = new X509Certificate(readFileSync(join(dir, name))); } catch { continue; }
  const end = Date.parse(cert.validTo);
  rows.push({stem: name.slice(0, -4), notAfter: new Date(end).toISOString(), daysLeft: Math.floor((end - now) / 864e5), usedByRender: RENDER_CERTS.includes(name.slice(0, -4))});
}
const missing = RENDER_CERTS.filter(s => !rows.some(r => r.stem === s));
for (const r of rows) console.log(`${r.usedByRender ? 'render' : 'other '}  ${r.stem.padEnd(26)} notAfter ${r.notAfter}  daysLeft ${String(r.daysLeft).padStart(4)}`);
if (missing.length) console.log('MISSING or unreadable certificates the render needs: ' + missing.join(', '));
const used = rows.filter(r => r.usedByRender);
const earliest = used.reduce((a, r) => (a === null || Date.parse(r.notAfter) < Date.parse(a.notAfter) ? r : a), null);
if (earliest) console.log(`earliest render certificate: ${earliest.stem} notAfter ${earliest.notAfter} (${earliest.daysLeft} days left); required minimum ${minimum}; render needs more than 7 days (the default --validity-days)`);
const short = used.filter(r => r.daysLeft < minimum);
process.exit(missing.length || short.length ? 1 : 0);
