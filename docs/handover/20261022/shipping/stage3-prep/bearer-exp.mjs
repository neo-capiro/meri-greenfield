// Local-only bearer check. Reads one file that holds the Core identity bearer and prints ONLY: byte length, whether it has the shape
// Meri accepts, whether it looks like a JWT, and (for a JWT) the iat/exp/nbf timestamps and the time left. It never prints the token or any
// other claim, and it makes no network call.
//   node bearer-exp.mjs <path to the bearer file>
// Exit 0 = shape ok and (if a JWT) not expired with at least 10 minutes left; 1 = expired, expiring or bad shape; 2 = usage/read error.
import {readFileSync, statSync} from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node bearer-exp.mjs <bearer file>'); process.exit(2); }
let raw, stat;
try { raw = readFileSync(file, 'utf8').replace(/[\r\n]+$/u, ''); stat = statSync(file); } catch (e) { console.error('cannot read file: ' + (e.code ?? 'error')); process.exit(2); }
const out = {bytes: Buffer.byteLength(raw), fileModified: stat.mtime.toISOString(), shapeOk: /^[A-Za-z0-9._~+/-]{1,8192}={0,2}$/u.test(raw), kind: 'opaque'};
let code = out.shapeOk ? 0 : 1;
const parts = raw.split('.');
if (parts.length === 3) {
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    out.kind = 'jwt';
    const iso = v => (Number.isFinite(v) ? new Date(v * 1000).toISOString() : null);
    out.issuedAt = iso(p.iat);
    out.notBefore = iso(p.nbf);
    out.expiresAt = iso(p.exp);
    if (Number.isFinite(p.exp)) {
      out.secondsRemaining = Math.floor(p.exp - Date.now() / 1000);
      if (out.secondsRemaining < 600) code = 1;
    } else out.expiry = 'no exp claim';
  } catch { out.kind = 'dotted but not a decodable JWT'; }
}
console.log(JSON.stringify(out, null, 1));
process.exit(code);
