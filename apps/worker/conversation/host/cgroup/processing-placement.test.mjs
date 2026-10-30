/** Inert placement tests: real supervisor/placement owners, synthetic spawn and filesystem. No child, cgroup or mount. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable,Writable} from 'node:stream';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createProcessingPlacement} from './processing-placement.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = Object.freeze({tenantId: uuid(1), actorId: uuid(2), conversationId: uuid(3), runId: uuid(4),
  attemptId: uuid(5), workerId: uuid(6), writerFence: 1});
const LEASE = Date.now() + 3_600_000;
const allocation = Object.freeze({schema: HOST_ALLOCATION_SCHEMA, tenantId: binding.tenantId,
  conversationId: binding.conversationId, generation: 2, hostId: uuid(7), imageDigest: `sha256:${'a'.repeat(64)}`,
  leaseDeadlineMs: LEASE});
const hostIdentity = Object.freeze({schema: D005_HOST_IDENTITY_SCHEMA, instanceId: 'i-0123456789abcdef0',
  bootId: uuid(8), conversationId: binding.conversationId, hostId: allocation.hostId});
const policy = Object.freeze({policySha256: 'c'.repeat(64), maxFreshMs: 5000,
  readCurrent: async () => ({allocation, binding, policySha256: 'c'.repeat(64), phase: 'active',
    checkedAtMs: Date.now(), currentUntilMs: Date.now() + 2000})});
const LIMITS = Object.freeze({cpuQuotaUs: 50000, periodUs: 100000, memoryBytes: 268435456, pidsMax: 16});
const digest = canonicalSha256(binding);
const parent = `/sys/fs/cgroup/meri/hosts/${allocation.hostId}-2/${digest}`;
const leafPath = `${parent}/processing`;
const leafRelative = `/meri/hosts/${allocation.hostId}-2/${digest}/processing`;
const networkProof = Object.freeze({verified: true, kind: 'processing', allocationSha256: canonicalSha256(allocation),
  bindingSha256: digest, namespacePath: '/run/netns/meri-processing-1', namespaceDev: 11, namespaceIno: 12});
const command = Object.freeze({command: '/usr/lib/meri/scan-extract', args: Object.freeze(['--fixed']), cwd: '/run/meri/processing'});

function memoryFs(entries = {}) {
  const map = new Map(Object.entries(entries));
  const writes = [];
  return {map, writes,
    readFileSync(path) { if (!map.has(path)) { const error = Error('ENOENT'); error.code = 'ENOENT'; throw error; } return map.get(path); },
    writeFileSync(path, value) { writes.push(path); map.set(path, String(value)); },
    mkdirSync(path) { if (map.has(path)) { const error = Error('EEXIST'); error.code = 'EEXIST'; throw error; } map.set(path, ''); map.set(`${path}/cgroup.procs`, ''); },
    rmdirSync(path) { map.delete(path); map.delete(`${path}/cgroup.procs`); }};
}
const delegating = () => memoryFs({[`${parent}/cgroup.controllers`]: 'cpu memory pids\n', [`${parent}/cgroup.subtree_control`]: 'cpu memory pids\n'});

/** Synthetic C-launcher child: emits READY, records GO, supports kill/exit. */
function fakeChild({pid = 4242, ready = 'R\n', onGo, behavior = 'normal'} = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.killed = false;
  const readyStream = Readable.from([ready]);
  const gate = new Writable({write(chunk, _encoding, callback) { onGo?.(String(chunk)); callback(); }});
  child.stdio = [undefined, undefined, undefined, readyStream, gate];
  child.kill = () => { child.killed = true; child.exitCode = null; child.signalCode = 'SIGKILL'; child.emit('exit', null, 'SIGKILL'); return true; };
  return child;
}

const base = overrides => ({allocation, binding, hostIdentity, policy, limits: LIMITS,
  helperPath: '/usr/lib/meri/meri-host-launcher', networkProof, command: command.command, args: command.args,
  cwd: command.cwd, uid: 20001, gid: 20001, readyMs: 1000, stopMs: 200, identity: () => ({uid: 0, euid: 0}), ...overrides});

test('a real placement joins the LEADER PID before GO, then releases the empty leaf on close', async () => {
  const fs = delegating();
  fs.map.set('/proc/4242/cgroup', `0::${leafRelative}
`);
  const order = [];
  let child;
  const spawnNative = () => { order.push('spawn'); child = fakeChild({onGo: () => order.push('go')}); return child; };
  const placement = await createProcessingPlacement(base({fs, spawnNative,
    // The child lands in the finite leaf before READY, exactly like the C attach_cgroup path.
    onSpawnHook: undefined,
  }));
  assert.equal(placement.schema, 'meri-d005-processing-placement/1');
  assert.deepEqual(order, ['spawn', 'go']);
  assert.equal(placement.hierarchy.pid, 4242);
  assert.equal(placement.hierarchy.membershipReads, 2);
  const closed = await placement.close();
  assert.deepEqual(closed, {closed: true, released: true});
});

test('hierarchy mismatch refuses before GO, kills the owned child and releases the leaf', async () => {
  const fs = delegating();
  const order = [];
  let child;
  const spawnNative = () => { child = fakeChild({onGo: () => order.push('go')}); return child; };
  // No /proc/<pid>/cgroup entry: the leader never proves membership.
  await assert.rejects(createProcessingPlacement(base({fs, spawnNative})),
    error => error?.code === 'HOST_CGROUP_MEMBERSHIP_REFUSED');
  assert.deepEqual(order, []);
  assert.equal(child.killed, true);
  assert.equal(fs.map.has(leafPath), false, 'empty leaf released after the refused placement');
});

test('an occupied leaf refuses BEFORE any launcher spawn', async () => {
  const fs = delegating();
  fs.mkdirSync(leafPath);
  fs.map.set(`${leafPath}/cgroup.procs`, '99\n');
  let spawns = 0;
  await assert.rejects(createProcessingPlacement(base({fs, spawnNative: () => { spawns += 1; return fakeChild(); }})),
    error => error?.code === 'HOST_CGROUP_OCCUPIED');
  assert.equal(spawns, 0);
  assert.equal(fs.map.get(`${leafPath}/cgroup.procs`), '99\n', 'foreign membership untouched');
});

test('an unproven release is reported as unknown, never as cleaned', async () => {
  const fs = delegating();
  fs.map.set('/proc/4242/cgroup', `0::${leafRelative}\n`);
  const spawnNative = () => fakeChild();
  const placement = await createProcessingPlacement(base({fs, spawnNative}));
  fs.rmdirSync = () => { throw Error('busy'); };
  assert.deepEqual(await placement.close(), {closed: false, released: false, code: 'HOST_CGROUP_CLEANUP_UNKNOWN'});
});
