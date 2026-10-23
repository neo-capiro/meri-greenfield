// Prints a chat-safe summary of a Core membership response file: status, role, counts, times and match booleans only.
// It never prints a tenant, actor or client id, or the revision value.
//   node membership-summary.mjs <membership.json> [--min-seconds N] [--max-age-seconds N]
//     --min-seconds N       the receipt must still be valid at least N seconds from now (default 0). Use the time you need before the render finishes.
//     --max-age-seconds N   checkedAtMs must be at most N seconds old (default 900): "current" means fresh, not just unexpired.
//   Optional environment, read locally and never printed (set them in your own shell from your private records):
//     MERI_EXPECT_TENANT, MERI_EXPECT_ACTOR, MERI_EXPECT_CLIENT -> prints only true/false for "equals the receipt's tenant / actor" and
//     "is one of the receipt's clientIds".
// Exit 0 = exact receipt shape, active, admitted role, client ids are UUIDs, fresh, valid for the margin, and every provided expectation matches;
// 1 = refused; 2 = usage/read error.
import {readFileSync} from 'node:fs';

const args = process.argv.slice(2);
const file = args[0];
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = Number(args[i + 1]);
  if (!Number.isFinite(v) || v < 0) { console.error(`${name} needs a non-negative number`); process.exit(2); }
  return v;
};
if (!file || file.startsWith('--')) { console.error('usage: node membership-summary.mjs <membership.json> [--min-seconds N] [--max-age-seconds N]'); process.exit(2); }
const minSeconds = flag('--min-seconds', 0);
const maxAge = flag('--max-age-seconds', 900);
let m;
try { m = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error('cannot read/parse: ' + (e.code ?? 'not JSON')); process.exit(2); }
const keys = ['tenantId', 'actorId', 'status', 'role', 'permissions', 'clientIds', 'membershipRevision', 'checkedAtMs', 'expiresAtMs'];
const shapeOk = m !== null && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).sort().join() === [...keys].sort().join();
if (!shapeOk) { console.log(JSON.stringify({shapeOk: false})); process.exit(1); }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const now = Date.now();
const summary = {
  shapeOk: true,
  status: m.status,
  role: m.role,
  admittedRole: ['standard_user', 'user_admin', 'capiro_admin'].includes(m.role),
  permissionCount: Array.isArray(m.permissions) ? m.permissions.length : null,
  clientCount: Array.isArray(m.clientIds) ? m.clientIds.length : null,
  clientIdsAreUuids: Array.isArray(m.clientIds) && m.clientIds.every(id => uuid.test(id)),
  checkedAt: new Date(m.checkedAtMs).toISOString(),
  checkedSecondsAgo: Math.floor((now - m.checkedAtMs) / 1000),
  expiresAt: new Date(m.expiresAtMs).toISOString(),
  secondsRemaining: Math.floor((m.expiresAtMs - now) / 1000),
  checkedInTheFuture: m.checkedAtMs > now + 300000,
};
let expectationsOk = true;
const expect = (envName, outName, test) => {
  const v = process.env[envName];
  if (v === undefined || v === '') return;
  summary[outName] = test(v);
  if (summary[outName] !== true) expectationsOk = false;
};
expect('MERI_EXPECT_TENANT', 'expectedTenantMatches', v => m.tenantId === v);
expect('MERI_EXPECT_ACTOR', 'expectedActorMatches', v => m.actorId === v);
expect('MERI_EXPECT_CLIENT', 'expectedClientInMembership', v => Array.isArray(m.clientIds) && m.clientIds.includes(v));
const fresh = summary.checkedSecondsAgo <= maxAge && !summary.checkedInTheFuture;
const valid = summary.secondsRemaining > minSeconds;
summary.fresh = fresh;
summary.validForMargin = valid;
console.log(JSON.stringify(summary, null, 1));
process.exit(m.status === 'active' && summary.admittedRole && summary.clientIdsAreUuids && fresh && valid && expectationsOk ? 0 : 1);
