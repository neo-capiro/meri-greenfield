/** Inert caller→placement→launcher chain tests. Synthetic spawn/fs/run ports only: no child, cgroup, mount or socket. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable,Writable,PassThrough} from 'node:stream';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createProcessingCommandLauncher} from '../launcher/supervisor.mjs';
import {createFiniteCgroupLeaf,releaseFiniteCgroupLeaf} from './finite-leaf.mjs';
import {createProcessingUploadRunner} from '../../../../runtime/uploads/native-processing.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = Object.freeze({tenantId: uuid(1), actorId: uuid(2), conversationId: uuid(3), runId: uuid(4),
  attemptId: uuid(5), workerId: uuid(6), writerFence: 1});
const allocation = Object.freeze({schema: HOST_ALLOCATION_SCHEMA, tenantId: binding.tenantId,
  conversationId: binding.conversationId, generation: 3, hostId: uuid(7), imageDigest: `sha256:${'a'.repeat(64)}`,
  leaseDeadlineMs: Date.now() + 3_600_000});
const hostIdentity = Object.freeze({schema: D005_HOST_IDENTITY_SCHEMA, instanceId: 'i-0123456789abcdef0',
  bootId: uuid(8), conversationId: binding.conversationId, hostId: allocation.hostId});
const digest = canonicalSha256(binding);
const parent = `/sys/fs/cgroup/meri/hosts/${allocation.hostId}-3/${digest}`;
const leafPath = `${parent}/processing`;
const leafRelative = `/meri/hosts/${allocation.hostId}-3/${digest}/processing`;

function memoryFs(entries = {}) {
  const map = new Map(Object.entries(entries));
  const writes = [];
  return {map, writes,
    readFileSync(path) { if (!map.has(path)) { const e = Error('ENOENT'); e.code = 'ENOENT'; throw e; } return map.get(path); },
    writeFileSync(path, value) { writes.push(path); map.set(path, String(value)); },
    mkdirSync(path) { if (map.has(path)) { const e = Error('EEXIST'); e.code = 'EEXIST'; throw e; } map.set(path, ''); map.set(`${path}/cgroup.procs`, ''); },
    rmdirSync(path) { map.delete(path); map.delete(`${path}/cgroup.procs`); }};
}
const delegating = () => memoryFs({[`${parent}/cgroup.controllers`]: 'cpu memory pids\n',
  [`${parent}/cgroup.subtree_control`]: 'cpu memory pids\n'});
const root = () => ({uid: 0, euid: 0});

function network({dev = '31', ino = '32'} = {}) {
  const state = {verify: 0, dev, ino};
  return {state, plan: Object.freeze({kind: 'processing', namespaceName: 'meri-processing-abc', routes: Object.freeze([])}),
    proof: Object.freeze({namespaceDev: dev, namespaceIno: ino}),
    async verify() {
      state.verify += 1;
      return {verified: true, kind: 'processing', allocationSha256: canonicalSha256(allocation), bindingSha256: digest,
        namespacePath: '/run/netns/meri-processing-abc', namespaceDev: state.dev, namespaceIno: state.ino,
        localRelays: []};
    }};
}

function launcherChild({pid = 5151, ready = 'R\n', gate}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.killed = false;
  child.stdio = [undefined, undefined, undefined, Readable.from([ready]),
    new Writable({write(chunk, _e, cb) { gate.push(String(chunk)); cb(); }})];
  child.kill = () => { child.killed = true; child.signalCode = 'SIGKILL'; child.emit('exit', null, 'SIGKILL'); return true; };
  return child;
}

const baseLauncher = overrides => ({allocation, binding, hostIdentity, network: network(),
  helperPath: '/usr/lib/meri/meri-host-launcher', cwd: '/run/meri/processing', home: '/run/meri/processing',
  browsersPath: '/run/meri/processing', uid: 20001, gid: 20001, readyMs: 500, ...overrides});

test('processing command launcher verifies authority/network before the spawn AND again before GO', async () => {
  const net = network();
  const gate = [];
  const events = [];
  let child;
  const launcher = createProcessingCommandLauncher(baseLauncher({network: net, spawnNative: () => {
    events.push(['spawn', net.state.verify]);
    child = launcherChild({gate}); return child;
  },
  onPrepared: async ({leaderPid, kind}) => { events.push(['prepared', leaderPid, kind, net.state.verify]); }}));
  const spawned = await launcher('/usr/bin/bwrap', ['--unshare-all']);
  assert.deepEqual(events, [['spawn', 1], ['prepared', 5151, 'processing', 1]]);
  assert.equal(net.state.verify, 2, 'current authority/network rechecked after READY');
  assert.deepEqual(gate, ['G']);
  assert.equal(spawned.pid, 5151);
});

test('a revocation while READY/verification is pending blocks GO, kills the owned child and exposes no dispatch', async () => {
  const net = network();
  const gate = [];
  let child;
  const launcher = createProcessingCommandLauncher(baseLauncher({network: net,
    spawnNative: () => { child = launcherChild({gate}); return child; },
    onPrepared: async () => { net.state.dev = '99'; }})); // network identity changed while placement verification ran
  await assert.rejects(launcher('/usr/bin/bwrap', []), error => error?.code === 'HOST_LAUNCH_NETWORK_REFUSED');
  assert.deepEqual(gate, [], 'no G after a changed network identity');
  assert.equal(child.killed, true);
});

test('the upload runner preserves the fixed argv, exact input bytes and bounded output through the processing port', async () => {
  const seen = [];
  const run = async input => { seen.push(input); return {stdout: Buffer.from('ok'), exitCode: 0}; };
  const runner = createProcessingUploadRunner({launcher: async () => ({}), run,
    platform: 'linux', uidOf: () => 1000,
    lstatImpl: async () => ({isSymbolicLink: () => false, isDirectory: () => true, uid: 1000, mode: 0o700}),
    realpathImpl: async path => path});
  const cwd = '/run/meri/upload-scratch/meri-upload-probe-AbC123';
  const inputBytes = Buffer.from('{"credentialPaths":[]}');
  const out = await runner('probe', {cwd, input: inputBytes, deadlineMs: 1234, maxOutput: 4096, signal: undefined});
  assert.equal(out.exitCode, 0);
  assert.equal(seen.length, 1);
  const call = seen[0];
  assert.equal(call.command, '/usr/bin/bwrap');
  assert.deepEqual(call.input, inputBytes);
  assert.equal(call.maxOutput, 4096);
  assert.equal(call.deadlineMs, 1234);
  assert.equal(call.cwd, cwd);
  assert.ok(call.args.includes('--unshare-all') && call.args.includes('--uid') && call.args.includes('1000'));
  assert.ok(call.args.includes('--die-with-parent'));
});

test('a partial setup failure removes only the leaf this call created and reports it truthfully', async () => {
  const fs = delegating();
  const original = fs.writeFileSync;
  fs.writeFileSync = (path, value) => { if (path.endsWith('memory.max')) { const e = Error('EIO'); e.code = 'EIO'; throw e; } original(path, value); };
  const policy = {policySha256: 'c'.repeat(64), maxFreshMs: 5000, readCurrent: async () => ({allocation, binding,
    policySha256: 'c'.repeat(64), phase: 'active', checkedAtMs: Date.now(), currentUntilMs: Date.now() + 1000})};
  let error;
  try {
    await createFiniteCgroupLeaf({allocation, binding, hostIdentity, authority: policy,
      limits: {cpuQuotaUs: 50000, periodUs: 100000, memoryBytes: 268435456, pidsMax: 8}, fs, identity: root});
  } catch (caught) { error = caught; }
  assert.equal(error?.partialCleanup, 'removed');
  assert.equal(fs.map.has(leafPath), false);
  assert.deepEqual(fs.writes.filter(path => path.endsWith('memory.max')).length, 0, 'failed write recorded none');
});

test('an adopted leaf is never removed by a later partial failure or by release of a foreign group', async () => {
  const fs = delegating();
  fs.mkdirSync(leafPath);
  fs.map.set(`${leafPath}/cpu.max`, '50000 100000');
  fs.map.set(`${leafPath}/memory.max`, '268435456');
  fs.map.set(`${leafPath}/pids.max`, '8');
  const policy = {policySha256: 'c'.repeat(64), maxFreshMs: 5000, readCurrent: async () => ({allocation, binding,
    policySha256: 'c'.repeat(64), phase: 'active', checkedAtMs: Date.now(), currentUntilMs: Date.now() + 1000})};
  const leaf = await createFiniteCgroupLeaf({allocation, binding, hostIdentity, authority: policy,
    limits: {cpuQuotaUs: 50000, periodUs: 100000, memoryBytes: 268435456, pidsMax: 8}, fs, identity: root});
  assert.equal(leaf.adopted, true);
  assert.equal(fs.writes.length, 0);
  fs.map.set(`${leafPath}/cgroup.procs`, '77\n');
  assert.deepEqual(releaseFiniteCgroupLeaf({leaf, fs}), {released: false, code: 'HOST_CGROUP_OCCUPIED'});
  assert.equal(fs.map.has(leafPath), true);
});

test('a settled cleanup UNKNOWN is replayed on every later close call and never becomes success', async () => {
  const {createProcessingPlacement} = await import('./processing-placement.mjs');
  const fs = delegating();
  fs.map.set('/proc/5151/cgroup', `0::${leafRelative}\n`);
  const policy = {policySha256: 'c'.repeat(64), maxFreshMs: 5000, readCurrent: async () => ({allocation, binding,
    policySha256: 'c'.repeat(64), phase: 'active', checkedAtMs: Date.now(), currentUntilMs: Date.now() + 1000})};
  const net = network();
  const launcher = createProcessingCommandLauncher(baseLauncher({network: net, spawnNative: () => launcherChild({gate: []}),
    onPrepared: async () => {}}));
  const placement = await createProcessingPlacement({allocation, binding, hostIdentity, policy,
    limits: {cpuQuotaUs: 50000, periodUs: 100000, memoryBytes: 268435456, pidsMax: 8}, fs, identity: root, now: () => Date.now(),
    helperPath: '/usr/lib/meri/meri-host-launcher', networkProof: {verified: true, kind: 'processing',
      allocationSha256: canonicalSha256(allocation), bindingSha256: digest,
      namespacePath: '/run/netns/meri-processing-abc', namespaceDev: '31', namespaceIno: '32'},
    command: '/usr/bin/bwrap', args: [], cwd: '/run/meri/processing', uid: 20001, gid: 20001, readyMs: 500, stopMs: 200,
    spawnNative: () => launcherChild({gate: []})});
  fs.rmdirSync = () => { throw Error('busy'); };
  const first = await placement.close();
  assert.deepEqual(first, {closed: false, released: false, code: 'HOST_CGROUP_CLEANUP_UNKNOWN'});
  assert.deepEqual(await placement.close(), first);
  assert.deepEqual(await placement.close(), first);
});
