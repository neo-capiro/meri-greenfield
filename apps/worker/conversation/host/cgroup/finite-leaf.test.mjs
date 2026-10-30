/** Inert tests for the finite cgroup leaf placement owner. Synthetic filesystem only: no cgroup, child, PID or mount. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFiniteLimits, bindingDigest, createFiniteCgroupLeaf, parseUnifiedCgroup, verifyProcessingHierarchy,
  FINITE_CGROUP_SCHEMA, HIERARCHY_SCHEMA,
} from './finite-leaf.mjs';

const binding = Object.freeze({
  tenantId: '00000000-0000-4000-8000-000000000001', actorId: '00000000-0000-4000-8000-000000000002',
  conversationId: '00000000-0000-4000-8000-000000000003', runId: '00000000-0000-4000-8000-000000000004',
  attemptId: '00000000-0000-4000-8000-000000000005', workerId: '00000000-0000-4000-8000-000000000006', writerFence: 1,
});
const allocation = Object.freeze({
  schema: 'meri-conversation-host-allocation/1', tenantId: binding.tenantId, conversationId: binding.conversationId,
  generation: 1, hostMode: 'browser-only', hostId: '00000000-0000-4000-8000-000000000002',
  imageDigest: `sha256:${'a'.repeat(64)}`, leaseDeadlineMs: 1793345158000,
});
const digest = bindingDigest(binding);
const parent = `/sys/fs/cgroup/meri/hosts/${allocation.hostId}-${allocation.generation}/${digest}`;
const leafPath = `${parent}/processing`;
const LIMITS = Object.freeze({cpuQuotaUs: 50000, periodUs: 100000, memoryBytes: 268435456, pidsMax: 32});

function memoryFs(entries = {}) {
  const map = new Map(Object.entries(entries));
  const reads = [];
  return {
    map, reads,
    readFileSync(path) { reads.push(path); if (!map.has(path)) { const error = Error('ENOENT'); error.code = 'ENOENT'; throw error; } return map.get(path); },
    writeFileSync(path, value) { map.set(path, String(value)); },
    mkdirSync(path) { map.set(path, ''); map.set(`${path}/cgroup.procs`, ''); },
  };
}

const delegating = () => memoryFs({
  [`${parent}/cgroup.controllers`]: 'cpu memory pids\n',
  [`${parent}/cgroup.subtree_control`]: '+cpu +memory +pids\n',
});
const root = () => ({uid: 0, euid: 0});

test('limits must be finite integers; max, zero and missing values refuse', () => {
  assert.deepEqual(assertFiniteLimits(LIMITS), {...LIMITS});
  for (const bad of [{}, {...LIMITS, cpuQuotaUs: 0}, {...LIMITS, memoryBytes: 0}, {...LIMITS, pidsMax: 0},
    {...LIMITS, cpuQuotaUs: 'max'}, {...LIMITS, memoryBytes: undefined}, {...LIMITS, pidsMax: 4097}, {...LIMITS, cpuQuotaUs: 999}]) {
    assert.throws(() => assertFiniteLimits(bad), error => error?.code === 'HOST_CGROUP_LIMIT_REFUSED', JSON.stringify(bad));
  }
});

test('a non-root caller refuses before touching the hierarchy', () => {
  const fs = delegating();
  assert.throws(() => createFiniteCgroupLeaf({allocation, binding, limits: LIMITS, fs, identity: () => ({uid: 1000, euid: 1000})}),
    error => error?.code === 'HOST_CGROUP_CONFIGURATION');
  assert.equal(fs.reads.length, 0);
});

test('missing controller or missing delegation refuses instead of guessing a bound', () => {
  const noPids = memoryFs({[`${parent}/cgroup.controllers`]: 'cpu memory\n', [`${parent}/cgroup.subtree_control`]: '+cpu +memory\n'});
  assert.throws(() => createFiniteCgroupLeaf({allocation, binding, limits: LIMITS, fs: noPids, identity: root}),
    error => error?.code === 'HOST_CGROUP_DELEGATION_REFUSED');
  const notDelegated = memoryFs({[`${parent}/cgroup.controllers`]: 'cpu memory pids\n', [`${parent}/cgroup.subtree_control`]: '+cpu +memory\n'});
  assert.throws(() => createFiniteCgroupLeaf({allocation, binding, limits: LIMITS, fs: notDelegated, identity: root}),
    error => error?.code === 'HOST_CGROUP_DELEGATION_REFUSED');
  const noMount = memoryFs({});
  assert.throws(() => createFiniteCgroupLeaf({allocation, binding, limits: LIMITS, fs: noMount, identity: root}),
    error => error?.code === 'HOST_CGROUP_DELEGATION_REFUSED');
});

test('the created leaf carries finite cpu/memory/pids readback at the canonical launcher path', () => {
  const fs = delegating();
  const receipt = createFiniteCgroupLeaf({allocation, binding, limits: LIMITS, fs, identity: root, now: () => 1793345158000});
  assert.equal(receipt.schema, FINITE_CGROUP_SCHEMA);
  assert.equal(receipt.relativePath, `/meri/hosts/${allocation.hostId}-1/${digest}/processing`);
  assert.equal(receipt.absolutePath, leafPath);
  assert.equal(receipt.created, true);
  assert.deepEqual(receipt.limits, {cpuMax: '50000 100000', memoryMax: '268435456', pidsMax: '32'});
  assert.equal(typeof receipt.allocationSha256, 'string');
  assert.match(receipt.allocationSha256, /^[0-9a-f]{64}$/u);
  assert.equal(receipt.bindingSha256, digest);
  assert.equal(fs.map.get(`${leafPath}/cpu.max`), '50000 100000');
  assert.equal(fs.map.get(`${leafPath}/memory.max`), '268435456');
  assert.equal(fs.map.get(`${leafPath}/pids.max`), '32');
  assert.equal(fs.map.get(`${leafPath}/cgroup.procs`), '');
});

test('an ignored or unlimited write is a readback refusal, never a silent bound', () => {
  const fs = delegating();
  fs.writeFileSync = (path, value) => { fs.map.set(path, path.endsWith('memory.max') ? 'max' : String(value)); };
  assert.throws(() => createFiniteCgroupLeaf({allocation, binding, limits: LIMITS, fs, identity: root}),
    error => error?.code === 'HOST_CGROUP_READBACK_REFUSED');
});

test('a leaf that already holds members refuses the placement readback', () => {
  const fs = delegating();
  fs.mkdirSync = path => { fs.map.set(path, ''); fs.map.set(`${path}/cgroup.procs`, '4242\n'); };
  assert.throws(() => createFiniteCgroupLeaf({allocation, binding, limits: LIMITS, fs, identity: root}),
    error => error?.code === 'HOST_CGROUP_READBACK_REFUSED');
});

function leafFixture() {
  const fs = delegating();
  const leaf = createFiniteCgroupLeaf({allocation, binding, limits: LIMITS, fs, identity: root, now: () => 1793345158000});
  fs.reads.length = 0;
  return {fs, leaf};
}

test('the actual processing PID must be a member of the finite leaf (not the diagnostic PID)', () => {
  const {fs, leaf} = leafFixture();
  fs.map.set('/proc/4242/cgroup', `0::${leaf.relativePath}\n`);
  const receipt = verifyProcessingHierarchy({leaf, pid: 4242, fs, now: () => 1793345158001});
  assert.equal(receipt.schema, HIERARCHY_SCHEMA);
  assert.equal(receipt.relativePath, leaf.relativePath);
  assert.deepEqual(receipt.limits, leaf.limits);
  assert.equal(receipt.stable, true);

  fs.map.set('/proc/4343/cgroup', `0::/meri/hosts/${allocation.hostId}-1/${digest}/browser\n`);
  assert.throws(() => verifyProcessingHierarchy({leaf, pid: 4343, fs}), error => error?.code === 'HOST_CGROUP_MEMBERSHIP_REFUSED');
  fs.map.set('/proc/4444/cgroup', '0::/system.slice/agentcore\n');
  assert.throws(() => verifyProcessingHierarchy({leaf, pid: 4444, fs}), error => error?.code === 'HOST_CGROUP_MEMBERSHIP_REFUSED');
  assert.throws(() => verifyProcessingHierarchy({leaf, pid: 0, fs}), error => error?.code === 'HOST_CGROUP_MEMBERSHIP_REFUSED');
});

test('membership changing between the bracketing reads refuses the hierarchy join', () => {
  const {fs, leaf} = leafFixture();
  let calls = 0;
  const original = fs.readFileSync.bind(fs);
  fs.readFileSync = path => {
    if (path === '/proc/4242/cgroup') { calls += 1; return calls === 1 ? `0::${leafPath}\n` : `0::${parent}/browser\n`; }
    return original(path);
  };
  assert.throws(() => verifyProcessingHierarchy({leaf, pid: 4242, fs}), error => error?.code === 'HOST_CGROUP_MEMBERSHIP_REFUSED');
});

test('the unified cgroup parser refuses v1, CRLF, relative and traversal forms', () => {
  assert.equal(parseUnifiedCgroup('0::/meri/hosts/x\n'), '/meri/hosts/x');
  for (const bad of ['', '0::/a\r\n', '12:cpu:/a\n0::/b\n', '0::a\n', '0::/a/../b\n', '0::/a\0\n', null,
    '0::/meri/hosts/x/processing/']) {
    assert.equal(parseUnifiedCgroup(bad), bad === '0::/meri/hosts/x/processing/' ? bad.slice(3) : null, String(bad));
  }
});
