/** Inert placement tests: one finite lifetime through the real launcher and canonical runner. No child, cgroup or mount. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable,Writable,PassThrough} from 'node:stream';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createProcessingPlacement} from './processing-placement.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = Object.freeze({tenantId: uuid(1), actorId: uuid(2), conversationId: uuid(3), runId: uuid(4),
  attemptId: uuid(5), workerId: uuid(6), writerFence: 1});
const allocation = Object.freeze({schema: HOST_ALLOCATION_SCHEMA, tenantId: binding.tenantId,
  conversationId: binding.conversationId, generation: 6, hostId: uuid(7), imageDigest: `sha256:${'d'.repeat(64)}`,
  leaseDeadlineMs: Date.now() + 3_600_000});
const hostIdentity = Object.freeze({schema: D005_HOST_IDENTITY_SCHEMA, instanceId: 'i-0123456789abcdef0',
  bootId: uuid(8), conversationId: binding.conversationId, hostId: allocation.hostId});
const digest = canonicalSha256(binding);
const parent = `/sys/fs/cgroup/meri/hosts/${allocation.hostId}-6/${digest}`;
const leafPath = `${parent}/processing`;
const leafRelative = `/meri/hosts/${allocation.hostId}-6/${digest}/processing`;
const WORK = '/run/meri/processing';
const inertKill=()=>{const calls=[];const kill=(pid,sig)=>{calls.push([pid,sig]);
 if(sig===0){const e=Error('ESRCH');e.code='ESRCH';throw e;}};kill.calls=calls;return kill;};

function memoryFs(entries = {}) {
  const map = new Map(Object.entries(entries));
  const writes = [];
  return {map, writes,
    readFileSync(path) { if (!map.has(path)) { const e = Error('ENOENT'); e.code = 'ENOENT'; throw e; } return map.get(path); },
    writeFileSync(path, value) { writes.push(path); map.set(path, String(value)); },
    mkdirSync(path) { if (map.has(path)) { const e = Error('EEXIST'); e.code = 'EEXIST'; throw e; } map.set(path, ''); map.set(`${path}/cgroup.procs`, ''); },
    rmdirSync(path) { map.delete(path); map.delete(`${path}/cgroup.procs`); },
    lstatSync(path) { if (!map.has(path)) { const e = Error('ENOENT'); e.code = 'ENOENT'; throw e; } return { path }; }};
}
const delegating = () => memoryFs({[`${parent}/cgroup.controllers`]: 'cpu memory pids\n',
  [`${parent}/cgroup.subtree_control`]: 'cpu memory pids\n'});
const root = () => ({uid: 0, euid: 0});
const policy = () => ({policySha256: 'c'.repeat(64), maxFreshMs: 5000, async readCurrent() {
  return {allocation, binding, policySha256: 'c'.repeat(64), phase: 'active', checkedAtMs: Date.now(),
    currentUntilMs: Date.now() + 2000}; }});
const network = () => ({plan: Object.freeze({kind: 'processing', namespaceName: 'meri-processing-xyz', routes: Object.freeze([])}),
  proof: Object.freeze({namespaceDev: '51', namespaceIno: '52'}), async verify() {
    return {verified: true, kind: 'processing', allocationSha256: canonicalSha256(allocation), bindingSha256: digest,
      namespacePath: '/run/netns/meri-processing-xyz', namespaceDev: '51', namespaceIno: '52', localRelays: []}; }});

function gatedChild({pid = 7171, program = () => 'OUT'} = {}) {
  const child = new EventEmitter();
  child.pid = pid; child.exitCode = null; child.signalCode = null; child.killed = false;
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({write(_c, _e, cb) { cb(); }});
  const gate = new Writable({write(chunk, _e, cb) {
    if (String(chunk) === 'G') {
      child.stdout.write(String(program())); child.stdout.end(); child.stderr.end(); child.exitCode = 0;
      setImmediate(() => { child.emit('exit', 0, null); child.emit('close', 0, null); });
    }
    cb();
  }});
  child.stdio = [child.stdin, child.stdout, child.stderr, Readable.from(['R\n']), gate];
  child.kill = () => { child.killed = true; child.signalCode = 'SIGKILL'; child.emit('exit', null, 'SIGKILL'); return true; };
  return child;
}
const base = overrides => ({allocation, binding, hostIdentity, authority: policy(), limits: {cpuQuotaUs: 50000,
  periodUs: 100000, memoryBytes: 268435456, pidsMax: 8}, network: network(), helperPath: '/usr/lib/meri/meri-host-launcher',
  home: WORK, browsersPath: WORK, uid: 20001, gid: 20001, identity: root, readyMs: 500, ...overrides});

test('the leaf is created before any command runs, and the command runs through the one runner path', async () => {
  const fs = delegating();
  fs.map.set('/proc/7171/cgroup', `0::${leafRelative}\n`);
  let spawns = 0;
  const placement = await createProcessingPlacement(base({fs, spawnNative: () => { spawns += 1; return gatedChild(); },
    kill: inertKill()}));
  assert.equal(spawns, 0, 'no child at placement time');
  assert.equal(placement.leaf.relativePath, leafRelative);
  const result = await placement.run('/usr/bin/bwrap', ['--unshare-all'], {cwd: WORK, deadlineMs: Date.now() + 5000,
    maxOutput: 128});
  assert.equal(result.stdout.toString(), 'OUT');
  assert.equal(spawns, 1);
  assert.equal(placement.hierarchy().pid, 7171);
  assert.equal(placement.hierarchy().membershipReads, 2);
  assert.deepEqual(await placement.close(), {closed: true, released: true});
});

test('an occupied leaf refuses before any command is prepared', async () => {
  const fs = delegating();
  fs.mkdirSync(leafPath);
  fs.map.set(`${leafPath}/cgroup.procs`, '99\n');
  let spawns = 0;
  await assert.rejects(createProcessingPlacement(base({fs, spawnNative: () => { spawns += 1; return gatedChild(); }})),
    error => error?.code === 'HOST_CGROUP_OCCUPIED');
  assert.equal(spawns, 0);
});

test('close is lazy, runs once and replays an honest unknown', async () => {
  const fs = delegating();
  const placement = await createProcessingPlacement(base({fs}));
  fs.rmdirSync = () => { throw Error('busy'); };
  const first = await placement.close();
  assert.deepEqual(first, {closed: false, released: false, code: 'HOST_CGROUP_CLEANUP_UNKNOWN'});
  assert.deepEqual(await placement.close(), first);
  assert.deepEqual(await placement.close(), first);
});

test('an invalid launcher configuration is refused BEFORE any leaf is created', async () => {
  const fs = delegating();
  await assert.rejects(createProcessingPlacement(base({fs, helperPath: 'relative/launcher'})),
    error => error?.code === 'HOST_LAUNCH_CONFIGURATION');
  assert.equal(fs.map.has(leafPath), false, 'no leaf was left behind by a rejected configuration');
  assert.equal(fs.writes.length, 0);
});

test('close refuses new runs once it starts, releases once and replays its result', async () => {
  const fs = delegating();
  const placement = await createProcessingPlacement(base({fs, spawnNative: () => gatedChild(), kill: inertKill()}));
  const first = await placement.close();
  assert.deepEqual(first, {closed: true, released: true});
  assert.equal(placement.isClosed(), true);
  assert.deepEqual(await placement.close(), first, 'repeat close replays the settled result');
  await assert.rejects(placement.run('/usr/bin/bwrap', [], {cwd: WORK, deadlineMs: Date.now() + 5000}),
    error => error?.code === 'HOST_PROCESSING_CLOSED');
  assert.equal(fs.map.has(leafPath), false);
});
