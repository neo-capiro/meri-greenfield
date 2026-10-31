/** Inert tests for the finite cgroup processing placement. Synthetic filesystem only: no cgroup, child, PID or mount. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {
  assertFiniteLimits, createFiniteCgroupLeaf, parseSubtreeControlRead, verifyProcessingHierarchy,
  releaseFiniteCgroupLeaf, FINITE_CGROUP_SCHEMA, HIERARCHY_SCHEMA,
} from './finite-leaf.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = Object.freeze({tenantId: uuid(1), actorId: uuid(2), conversationId: uuid(3), runId: uuid(4),
  attemptId: uuid(5), workerId: uuid(6), writerFence: 1});
const allocation = Object.freeze({
  schema: HOST_ALLOCATION_SCHEMA, tenantId: binding.tenantId, conversationId: binding.conversationId, generation: 1,
  hostId: uuid(7), imageDigest: `sha256:${'a'.repeat(64)}`, leaseDeadlineMs: 1793345218000,
});
const hostIdentity = Object.freeze({schema: D005_HOST_IDENTITY_SCHEMA, instanceId: 'i-0123456789abcdef0',
  bootId: uuid(8), conversationId: binding.conversationId, hostId: allocation.hostId});
const authority = Object.freeze({policySha256: 'c'.repeat(64), maxFreshMs: 1000,
  readCurrent: async () => ({allocation, binding, policySha256: 'c'.repeat(64), phase: 'active',
    checkedAtMs: 1793345158000, currentUntilMs: 1793345158999})});
const LIMITS = Object.freeze({cpuQuotaUs: 50000, periodUs: 100000, memoryBytes: 268435456, pidsMax: 32});
const digest = canonicalSha256(binding);
const parent = `/sys/fs/cgroup/meri/hosts/${allocation.hostId}-1/${digest}`;
const leafPath = `${parent}/processing`;
const root = () => ({uid: 0, euid: 0});
const now = () => 1793345158000;

function memoryFs(entries = {}) {
  const map = new Map(Object.entries(entries));
  const writes = [];
  return {
    map, writes,
    readFileSync(path) { if (!map.has(path)) { const error = Error('ENOENT'); error.code = 'ENOENT'; throw error; } return map.get(path); },
    writeFileSync(path, value) { writes.push(path); map.set(path, String(value)); },
    mkdirSync(path) { if (map.has(path)) { const error = Error('EEXIST'); error.code = 'EEXIST'; throw error; } map.set(path, ''); map.set(`${path}/cgroup.procs`, ''); },
    rmdirSync(path) { map.delete(path); map.delete(`${path}/cgroup.procs`); },
    // Faithful absence observer: the deleted leaf genuinely disappears, and a present path is an existing one.
    lstatSync(path) { if (!map.has(path)) { const e = Error('ENOENT'); e.code = 'ENOENT'; throw e; } return { path }; },
  };
}
const delegating = () => memoryFs({
  [`${parent}/cgroup.controllers`]: 'cpu memory pids\n',
  [`${parent}/cgroup.subtree_control`]: 'cpu memory pids\n',
});
const base = overrides => ({allocation, binding, hostIdentity, authority, limits: LIMITS, fs: delegating(), identity: root, now, ...overrides});

test('finite limits matrix rejects max/zero/out-of-range values', () => {
  assert.deepEqual(assertFiniteLimits(LIMITS), {...LIMITS});
  for (const bad of [{}, {...LIMITS, cpuQuotaUs: 0}, {...LIMITS, memoryBytes: 0}, {...LIMITS, pidsMax: 0},
    {...LIMITS, cpuQuotaUs: 'max'}, {...LIMITS, pidsMax: 4097}, {...LIMITS, cpuQuotaUs: 999}]) {
    assert.throws(() => assertFiniteLimits(bad), error => error?.code === 'HOST_CGROUP_LIMIT_REFUSED', JSON.stringify(bad));
  }
});

test('kernel subtree_control READ form is controller names; +/- forms are refused', () => {
  assert.deepEqual(parseSubtreeControlRead('cpu memory pids\n'), ['cpu', 'memory', 'pids']);
  assert.deepEqual(parseSubtreeControlRead(''), []);
  for (const bad of ['+cpu +memory +pids\n', 'cpu cpu\n', 'cpu memory\n', null, 'cpu 2\n']) {
    if (bad === 'cpu memory\n') { assert.deepEqual(parseSubtreeControlRead(bad), ['cpu', 'memory']); continue; }
    assert.equal(parseSubtreeControlRead(bad), null, String(bad));
  }
});

test('non-root, browser-only placement, cross-tenant binding, expired lease and bad authority refuse before writes', async () => {
  let fs = delegating();
  await assert.rejects(createFiniteCgroupLeaf(base({identity: () => ({uid: 1000, euid: 1000}), fs})),
    error => error?.code === 'HOST_CGROUP_CONFIGURATION');
  assert.equal(fs.writes.length, 0);
  fs = delegating();
  await assert.rejects(createFiniteCgroupLeaf(base({allocation: {...allocation, hostMode: 'browser-only'}, fs})),
    error => error?.code === 'HOST_CGROUP_PLACEMENT_REFUSED');
  assert.equal(fs.writes.length, 0);
  fs = delegating();
  await assert.rejects(createFiniteCgroupLeaf(base({binding: {...binding, tenantId: uuid(99)}, fs})),
    error => error?.code === 'HOST_CGROUP_BINDING_REFUSED');
  assert.equal(fs.writes.length, 0);
  fs = delegating();
  await assert.rejects(createFiniteCgroupLeaf(base({allocation: {...allocation, leaseDeadlineMs: now()}, fs})),
    error => error?.code === 'HOST_CGROUP_EXPIRED');
  assert.equal(fs.writes.length, 0);
  fs = delegating();
  await assert.rejects(createFiniteCgroupLeaf(base({authority: {policySha256: 'c'.repeat(64), readCurrent: async () => ({})}, fs})),
    error => error?.code === 'HOST_CGROUP_AUTHORITY_REFUSED');
  assert.equal(fs.writes.length, 0);
});

test('stale or failed canonical currentness refuses before any limit write', async () => {
  let fs = delegating();
  await assert.rejects(createFiniteCgroupLeaf(base({fs, authority: {policySha256: 'c'.repeat(64), maxFreshMs: 1000,
    readCurrent: async () => ({allocation, binding, policySha256: 'c'.repeat(64), phase: 'revoked', checkedAtMs: now(), currentUntilMs: now() + 1000})}})),
    error => error?.code === 'HOST_CGROUP_CURRENTNESS_REFUSED');
  assert.equal(fs.writes.length, 0);
  fs = delegating();
  await assert.rejects(createFiniteCgroupLeaf(base({fs, authority: {policySha256: 'c'.repeat(64), maxFreshMs: 1000,
    readCurrent: async () => { throw Error('authority down'); }}})), error => error?.code === 'HOST_CGROUP_CURRENTNESS_REFUSED');
  assert.equal(fs.writes.length, 0);
  fs = delegating();
  await assert.rejects(createFiniteCgroupLeaf(base({fs, allocation: {...allocation, hostMode: 'browser-only'}})),
    error => error?.code === 'HOST_CGROUP_PLACEMENT_REFUSED');
});

test('delegation must be readable in kernel form and contain all three controllers', async () => {
  const namesOnly = memoryFs({[`${parent}/cgroup.controllers`]: 'cpu memory pids\n', [`${parent}/cgroup.subtree_control`]: 'cpu memory pids\n'});
  const leaf = await createFiniteCgroupLeaf(base({fs: namesOnly}));
  assert.equal(leaf.schema, FINITE_CGROUP_SCHEMA);
  const plusForm = memoryFs({[`${parent}/cgroup.controllers`]: 'cpu memory pids\n', [`${parent}/cgroup.subtree_control`]: '+cpu +memory +pids\n'});
  await assert.rejects(createFiniteCgroupLeaf(base({fs: plusForm})), error => error?.code === 'HOST_CGROUP_DELEGATION_REFUSED');
  const missingPids = memoryFs({[`${parent}/cgroup.controllers`]: 'cpu memory\n', [`${parent}/cgroup.subtree_control`]: 'cpu memory\n'});
  await assert.rejects(createFiniteCgroupLeaf(base({fs: missingPids})), error => error?.code === 'HOST_CGROUP_DELEGATION_REFUSED');
});

test('a new leaf is created with exactly three finite writes and canonical digests', async () => {
  const fs = delegating();
  const leaf = await createFiniteCgroupLeaf(base({fs}));
  assert.equal(leaf.created, true);
  assert.equal(leaf.adopted, false);
  assert.deepEqual(fs.writes, [`${leafPath}/cpu.max`, `${leafPath}/memory.max`, `${leafPath}/pids.max`]);
  assert.equal(leaf.relativePath, `/meri/hosts/${allocation.hostId}-1/${digest}/processing`);
  assert.equal(leaf.bindingSha256, digest);
  assert.equal(leaf.allocationSha256, canonicalSha256(assertHostAllocation(allocation)));
  assert.equal(leaf.hostIdentitySha256, canonicalSha256(hostIdentity));
  assert.deepEqual(leaf.limits, {cpuMax: '50000 100000', memoryMax: '268435456', pidsMax: '32'});
});

test('occupied or foreign leaves are refused WITHOUT mutating them; identical empty leaves are adopted quietly', async () => {
  const occupied = delegating();
  occupied.mkdirSync(`${leafPath}`);
  occupied.map.set(`${leafPath}/cgroup.procs`, '4242\n');
  await assert.rejects(createFiniteCgroupLeaf(base({fs: occupied})), error => error?.code === 'HOST_CGROUP_OCCUPIED');
  assert.equal(occupied.writes.length, 0);

  const foreign = delegating();
  foreign.mkdirSync(`${leafPath}`);
  foreign.map.set(`${leafPath}/cpu.max`, 'max 100000');
  foreign.map.set(`${leafPath}/memory.max`, 'max');
  foreign.map.set(`${leafPath}/pids.max`, 'max');
  await assert.rejects(createFiniteCgroupLeaf(base({fs: foreign})), error => error?.code === 'HOST_CGROUP_FOREIGN');
  assert.equal(foreign.writes.length, 0);

  const adoptable = delegating();
  adoptable.mkdirSync(`${leafPath}`);
  adoptable.map.set(`${leafPath}/cpu.max`, '50000 100000');
  adoptable.map.set(`${leafPath}/memory.max`, '268435456');
  adoptable.map.set(`${leafPath}/pids.max`, '32');
  const adopted = await createFiniteCgroupLeaf(base({fs: adoptable}));
  assert.equal(adopted.created, false);
  assert.equal(adopted.adopted, true);
  assert.equal(adoptable.writes.length, 0);
});

test('an ignored or unlimited write is a readback refusal', async () => {
  const fs = delegating();
  fs.writeFileSync = (path, value) => { fs.writes.push(path); fs.map.set(path, path.endsWith('memory.max') ? 'max' : String(value)); };
  await assert.rejects(createFiniteCgroupLeaf(base({fs})), error => error?.code === 'HOST_CGROUP_READBACK_REFUSED');
});

test('the actual processing PID joins the leaf with two membership reads bracketing the limit readback', async () => {
  const fs = delegating();
  const leaf = await createFiniteCgroupLeaf(base({fs}));
  fs.map.set('/proc/4242/cgroup', `0::${leaf.relativePath}\n`);
  const receipt = verifyProcessingHierarchy({leaf, pid: 4242, fs, now});
  assert.equal(receipt.schema, HIERARCHY_SCHEMA);
  assert.equal(receipt.membershipReads, 2);
  assert.deepEqual(receipt.limits, leaf.limits);
  assert.equal(receipt.stable, true);

  fs.map.set('/proc/4343/cgroup', `0::/meri/hosts/${allocation.hostId}-1/${digest}/browser\n`);
  assert.throws(() => verifyProcessingHierarchy({leaf, pid: 4343, fs}), error => error?.code === 'HOST_CGROUP_MEMBERSHIP_REFUSED');
  assert.throws(() => verifyProcessingHierarchy({leaf, pid: 1, fs}), error => error?.code === 'HOST_CGROUP_MEMBERSHIP_REFUSED');
});

test('membership changing after a VALID first read and the limit reads refuses on the second observation', async () => {
  const fs = delegating();
  const leaf = await createFiniteCgroupLeaf(base({fs}));
  let membershipReads = 0;
  const original = fs.readFileSync.bind(fs);
  const between = [];
  fs.readFileSync = path => {
    if (path === '/proc/4242/cgroup') { membershipReads += 1; return membershipReads === 1 ? `0::${leaf.relativePath}\n` : `0::${parent}/browser\n`; }
    if (path.startsWith(`${leaf.absolutePath}/`)) between.push(path);
    return original(path);
  };
  assert.throws(() => verifyProcessingHierarchy({leaf, pid: 4242, fs}), error => error?.code === 'HOST_CGROUP_MEMBERSHIP_REFUSED');
  assert.equal(membershipReads, 2);
  assert.equal(between.length, 3, 'the limit readback happened between the two membership observations');
});

test('release removes only an empty owned leaf and reports honest unknowns otherwise', async () => {
  const fs = delegating();
  const leaf = await createFiniteCgroupLeaf(base({fs}));
  assert.deepEqual(releaseFiniteCgroupLeaf({leaf, fs}), {released: true, relativePath: leaf.relativePath});
  const occupied = delegating();
  const second = await createFiniteCgroupLeaf(base({fs: occupied}));
  occupied.map.set(`/proc/9/cgroup`, `0::${second.relativePath}\n`);
  occupied.map.set(`${leafPath}/cgroup.procs`, '9\n');
  assert.deepEqual(releaseFiniteCgroupLeaf({leaf: second, fs: occupied}), {released: false, code: 'HOST_CGROUP_OCCUPIED'});
  const failing = delegating();
  const third = await createFiniteCgroupLeaf(base({fs: failing}));
  failing.rmdirSync = () => { throw Error('busy'); };
  assert.deepEqual(releaseFiniteCgroupLeaf({leaf: third, fs: failing}), {released: false, code: 'HOST_CGROUP_CLEANUP_UNKNOWN'});
});

const leaf=()=>({schema:FINITE_CGROUP_SCHEMA,absolutePath:leafPath,relativePath:'processing'});
test('READBACK: rmdir acknowledgement with the exact leaf still present is not released',()=>{
 const fs=delegating();fs.map.set(leafPath,'');fs.map.set(`${leafPath}/cgroup.procs`,'');
 fs.rmdirSync=()=>{};                                  // ACK without deleting
 const result=releaseFiniteCgroupLeaf({leaf:leaf(),fs});
 assert.equal(result.released,false);assert.equal(result.code,'HOST_CGROUP_CLEANUP_UNKNOWN');
 assert.equal(fs.map.has(leafPath),true);
});
test('READBACK: a leaf recreated after deletion is not released',()=>{
 const fs=delegating();fs.map.set(leafPath,'');fs.map.set(`${leafPath}/cgroup.procs`,'');
 fs.rmdirSync=path=>{fs.map.delete(path);fs.map.delete(`${path}/cgroup.procs`);fs.map.set(path,{recreated:true});};
 const result=releaseFiniteCgroupLeaf({leaf:leaf(),fs});
 assert.equal(result.released,false);assert.equal(result.code,'HOST_CGROUP_CLEANUP_UNKNOWN');
});
test('READBACK: EACCES/EIO/missing observer stay unknown; an empty owned leaf is released',()=>{
 for(const code of ['EACCES','EIO']){
  const fs=delegating();fs.map.set(leafPath,'');fs.map.set(`${leafPath}/cgroup.procs`,'');
  fs.lstatSync=()=>{const e=Error(code);e.code=code;throw e;};
  const result=releaseFiniteCgroupLeaf({leaf:leaf(),fs});
  assert.equal(result.released,false);assert.equal(result.code,'HOST_CGROUP_CLEANUP_UNKNOWN',code);
 }
 const missing=delegating();missing.map.set(leafPath,'');missing.map.set(`${leafPath}/cgroup.procs`,'');
 delete missing.lstatSync;
 assert.equal(releaseFiniteCgroupLeaf({leaf:leaf(),fs:missing}).released,false);
 const ok=delegating();ok.map.set(leafPath,'');ok.map.set(`${leafPath}/cgroup.procs`,'');
 assert.deepEqual(releaseFiniteCgroupLeaf({leaf:leaf(),fs:ok}),{released:true,relativePath:'processing'});
 assert.equal(ok.map.has(leafPath),false,'the exact owned leaf is gone');
});

const nativeAllocation=Object.freeze({...allocation,hostMode:'native-processing'});
const nativeAuthority=(over={})=>({policySha256:'c'.repeat(64),maxFreshMs:1000,
 readCurrent:async()=>({allocation:nativeAllocation,binding,policySha256:'c'.repeat(64),phase:'active',
  checkedAtMs:now()-100,currentUntilMs:now()+500,...over})});

test('NATIVE: a real canonical native allocation + native currentness creates the leaf with exactly 3 finite writes',async()=>{
 const fs=delegating();
 const leaf=await createFiniteCgroupLeaf(base({allocation:nativeAllocation,authority:nativeAuthority(),fs}));
 assert.equal(leaf.schema,FINITE_CGROUP_SCHEMA);
 assert.equal(leaf.absolutePath,`${parent}/processing`);
 assert.deepEqual(fs.writes.slice().sort(),[
  `${parent}/processing/cpu.max`,`${parent}/processing/memory.max`,`${parent}/processing/pids.max`].sort(),
  'exactly the three finite limit writes');
});

test('NATIVE: stale, revoked, cross-mode and cross-run currentness are denied with ZERO writes',async()=>{
 const cases=[
  ['stale',nativeAuthority({currentUntilMs:now()-1})],
  ['revoked',nativeAuthority({phase:'revoked'})],
  ['cross-mode',{policySha256:'c'.repeat(64),maxFreshMs:1000,readCurrent:async()=>({allocation,binding,
   policySha256:'c'.repeat(64),phase:'active',checkedAtMs:now()-100,currentUntilMs:now()+500})}],
  ['cross-run',nativeAuthority({binding:{...binding,runId:uuid(44)}})],
 ];
 for(const [name,authority] of cases){
  const fs=delegating();
  await assert.rejects(createFiniteCgroupLeaf(base({allocation:nativeAllocation,authority,fs})),
   e=>e?.code==='HOST_CGROUP_CURRENTNESS_REFUSED',name);
  assert.equal(fs.writes.length,0,`no limit write for ${name}`);
 }
});
