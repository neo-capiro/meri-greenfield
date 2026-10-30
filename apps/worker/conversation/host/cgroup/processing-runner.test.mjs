/** Inert processing chain tests: synthetic spawn/fs/currentness/network. No child, cgroup, netns, mount or socket. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable,Writable,PassThrough} from 'node:stream';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createProcessingCommandLauncher,runProcessingCommand} from '../launcher/supervisor.mjs';
import {createFiniteCgroupLeaf,releaseFiniteCgroupLeaf} from './finite-leaf.mjs';
import {createProcessingUploadRunner} from '../../../../runtime/uploads/native-processing.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = Object.freeze({tenantId: uuid(1), actorId: uuid(2), conversationId: uuid(3), runId: uuid(4),
  attemptId: uuid(5), workerId: uuid(6), writerFence: 1});
const allocation = Object.freeze({schema: HOST_ALLOCATION_SCHEMA, tenantId: binding.tenantId,
  conversationId: binding.conversationId, generation: 5, hostId: uuid(7), imageDigest: `sha256:${'a'.repeat(64)}`,
  leaseDeadlineMs: Date.now() + 3_600_000});
const hostIdentity = Object.freeze({schema: D005_HOST_IDENTITY_SCHEMA, instanceId: 'i-0123456789abcdef0',
  bootId: uuid(8), conversationId: binding.conversationId, hostId: allocation.hostId});
const digest = canonicalSha256(binding);
const WORK = '/run/meri/processing';
const parent = `/sys/fs/cgroup/meri/hosts/${allocation.hostId}-5/${digest}`;
const leafPath = `${parent}/processing`;

function authority() {
  const state = {reads: 0, phase: 'active'};
  return {state, policySha256: 'c'.repeat(64), maxFreshMs: 5000,
    async readCurrent() {
      state.reads += 1;
      return {allocation, binding, policySha256: 'c'.repeat(64), phase: state.phase,
        checkedAtMs: Date.now(), currentUntilMs: Date.now() + 2000};
    }};
}
function network() {
  const state = {verify: 0, dev: '31', ino: '32'};
  return {state, plan: Object.freeze({kind: 'processing', namespaceName: 'meri-processing-abc', routes: Object.freeze([])}),
    proof: Object.freeze({namespaceDev: '31', namespaceIno: '32'}),
    async verify() { state.verify += 1;
      return {verified: true, kind: 'processing', allocationSha256: canonicalSha256(allocation), bindingSha256: digest,
        namespacePath: '/run/netns/meri-processing-abc', namespaceDev: state.dev, namespaceIno: state.ino, localRelays: []}; }};
}
/** Behave like the C launcher: READY on fd 3, gate on fd 4, then the fixed program runs in place. */
function gatedChild({pid = 6161, ready = 'R\n', program = () => 'OUT'} = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.killed = false;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new Writable({write(_c, _e, cb) { cb(); }});
  const gate = new Writable({write(chunk, _e, cb) {
    if (String(chunk) === 'G') {
      child.stdout.write(String(program()));
      child.stdout.end(); child.stderr.end();
      child.exitCode = 0;
      setImmediate(() => { child.emit('exit', 0, null); child.emit('close', 0, null); });
    }
    cb();
  }});
  child.stdio = [child.stdin, child.stdout, child.stderr, Readable.from([ready]), gate];
  child.kill = () => { child.killed = true; child.signalCode = 'SIGKILL'; child.emit('exit', null, 'SIGKILL'); return true; };
  return child;
}
const launcherBase = overrides => ({allocation, binding, hostIdentity, network: network(), authority: authority(),
  helperPath: '/usr/lib/meri/meri-host-launcher', home: WORK, browsersPath: WORK, uid: 20001, gid: 20001,
  readyMs: 500, ...overrides});

test('the default runner chain: one spawn, exact stdout/exit, no cleanup while the child serves', async () => {
  const order = [];
  let killed = false;
  const child = gatedChild();
  const originalKill = child.kill;
  child.kill = () => { killed = true; return originalKill(); };
  const launcher = async (command, args, {cwd}) => {
    order.push(['prepare', command, cwd]);
    return {pid: child.pid, child, gate: child.stdio[4]};
  };
  const result = await runProcessingCommand({launcher, command: '/usr/bin/bwrap', args: ['--unshare-all'],
    cwd: WORK, input: Buffer.from('IN'), deadlineMs: Date.now() + 5000, maxOutput: 1024});
  assert.equal(result.stdout.toString(), 'OUT');
  assert.equal(result.receipt.exitCode, 0);
  assert.equal(result.receipt.groupAbsent, true);
  assert.deepEqual(order, [['prepare', '/usr/bin/bwrap', WORK]], 'one prepared command, no second process');
  assert.equal(killed, false, 'the group is not cleaned while the child is still serving');
});

test('GO is written only after the runner installed its listeners, so a fast exit is still observed', async () => {
  const child = gatedChild({program: () => ''});
  let goAfterListeners = false;
  const gate = child.stdio[4];
  const write = gate._write.bind(gate);
  gate._write = (chunk, enc, cb) => { if (String(chunk) === 'G') goAfterListeners = child.stdout.listenerCount('data') > 0; return write(chunk, enc, cb); };
  const launcher = async () => ({pid: child.pid, child, gate});
  const result = await runProcessingCommand({launcher, command: '/usr/bin/bwrap', args: [], cwd: WORK,
    deadlineMs: Date.now() + 5000, maxOutput: 64});
  assert.equal(goAfterListeners, true);
  assert.ok(result.receipt.stdoutEnded && result.receipt.stderrEnded);
});

test('the launcher reads canonical currentness before spawn and again before returning the prepared command', async () => {
  const auth = authority(); const net = network(); const events = [];
  const prepare = createProcessingCommandLauncher(launcherBase({authority: auth, network: net,
    spawnNative: () => { events.push(['spawn', auth.state.reads, net.state.verify]); return gatedChild(); },
    onPrepared: async () => { events.push(['prepared', auth.state.reads, net.state.verify]); }}));
  const prepared = await prepare('/usr/bin/bwrap', ['--x'], {cwd: WORK, deadlineMs: Date.now() + 5000});
  assert.deepEqual(events, [['spawn', 1, 1], ['prepared', 1, 1]]);
  assert.equal(auth.state.reads, 2, 'currentness read again after READY, before dispatch');
  assert.equal(net.state.verify, 2, 'network verified again before dispatch');
  assert.equal(prepared.pid, 6161);
  prepared.gate.end('G');
});

test('an authority revocation while READY is pending blocks dispatch and kills the child', async () => {
  const auth = authority(); const gate = []; let child;
  const prepare = createProcessingCommandLauncher(launcherBase({authority: auth,
    spawnNative: () => { child = gatedChild();
      const write = child.stdio[4]._write.bind(child.stdio[4]);
      child.stdio[4]._write = (chunk, enc, cb) => { gate.push(String(chunk)); return write(chunk, enc, cb); };
      return child; },
    onPrepared: async () => { auth.state.phase = 'revoked'; }}));
  await assert.rejects(prepare('/usr/bin/bwrap', [], {cwd: WORK, deadlineMs: Date.now() + 5000}),
    error => error?.code === 'HOST_LAUNCH_CURRENTNESS_REFUSED');
  assert.deepEqual(gate, [], 'no GO after revocation');
  assert.equal(child.killed, true);
});

test('a changed network identity between READY and dispatch refuses', async () => {
  const net = network(); const gate = []; let child;
  const prepare = createProcessingCommandLauncher(launcherBase({network: net,
    spawnNative: () => { child = gatedChild();
      const write = child.stdio[4]._write.bind(child.stdio[4]);
      child.stdio[4]._write = (chunk, enc, cb) => { gate.push(String(chunk)); return write(chunk, enc, cb); };
      return child; },
    onPrepared: async () => { net.state.dev = '99'; }}));
  await assert.rejects(prepare('/usr/bin/bwrap', [], {cwd: WORK, deadlineMs: Date.now() + 5000}),
    error => error?.code === 'HOST_LAUNCH_NETWORK_REFUSED');
  assert.deepEqual(gate, []);
  assert.equal(child.killed, true);
});

test('caller cancellation and an expired allocation both refuse before dispatch', async () => {
  const controller = new AbortController();
  const prepare = createProcessingCommandLauncher(launcherBase({signal: controller.signal, spawnNative: () => gatedChild(),
    onPrepared: async () => {}}));
  controller.abort();
  await assert.rejects(prepare('/usr/bin/bwrap', [], {cwd: WORK, deadlineMs: Date.now() + 5000}),
    error => error?.code === 'HOST_LAUNCH_CANCELLED');
  await assert.rejects(async () => createProcessingCommandLauncher(launcherBase({
    allocation: {...allocation, leaseDeadlineMs: Date.now() - 1}, spawnNative: () => gatedChild(),
    onPrepared: async () => {}})), error => error?.code === 'HOST_LAUNCH_EXPIRED');
});

test('the upload runner preserves the fixed argv, exact input bytes and bounded output', async () => {
  const seen = [];
  const run = async input => { seen.push(input); return {stdout: Buffer.from('ok'), exitCode: 0}; };
  const runner = createProcessingUploadRunner({launcher: async () => ({}), run, platform: 'linux', uidOf: () => 1000,
    lstatImpl: async () => ({isSymbolicLink: () => false, isDirectory: () => true, uid: 1000, mode: 0o700}),
    realpathImpl: async path => path});
  const cwd = '/run/meri/upload-scratch/meri-upload-probe-AbC123';
  const inputBytes = Buffer.from('{"credentialPaths":[]}');
  await runner('probe', {cwd, input: inputBytes, deadlineMs: 1234, maxOutput: 4096});
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
  let error;
  try {
    await createFiniteCgroupLeaf({allocation, binding, hostIdentity, authority: authority(),
      limits: {cpuQuotaUs: 50000, periodUs: 100000, memoryBytes: 268435456, pidsMax: 8}, fs, identity: root});
  } catch (caught) { error = caught; }
  assert.equal(error?.partialCleanup, 'removed');
  assert.equal(fs.map.has(leafPath), false);
});

test('an adopted leaf is never removed and release of an occupied group refuses', async () => {
  const fs = delegating();
  fs.mkdirSync(leafPath);
  fs.map.set(`${leafPath}/cpu.max`, '50000 100000');
  fs.map.set(`${leafPath}/memory.max`, '268435456');
  fs.map.set(`${leafPath}/pids.max`, '8');
  const leaf = await createFiniteCgroupLeaf({allocation, binding, hostIdentity, authority: authority(),
    limits: {cpuQuotaUs: 50000, periodUs: 100000, memoryBytes: 268435456, pidsMax: 8}, fs, identity: root});
  assert.equal(leaf.adopted, true);
  assert.equal(fs.writes.length, 0);
  fs.map.set(`${leafPath}/cgroup.procs`, '77\n');
  assert.deepEqual(releaseFiniteCgroupLeaf({leaf, fs}), {released: false, code: 'HOST_CGROUP_OCCUPIED'});
  assert.equal(fs.map.has(leafPath), true);
});

function memoryFs(entries = {}) {
  const map = new Map(Object.entries(entries));
  const writes = [];
  return {map, writes,
    readFileSync(path) { if (!map.has(path)) { const e = Error('ENOENT'); e.code = 'ENOENT'; throw e; } return map.get(path); },
    writeFileSync(path, value) { writes.push(path); map.set(path, String(value)); },
    mkdirSync(path) { if (map.has(path)) { const e = Error('EEXIST'); e.code = 'EEXIST'; throw e; } map.set(path, ''); map.set(`${path}/cgroup.procs`, ''); },
    rmdirSync(path) { map.delete(path); map.delete(`${path}/cgroup.procs`); }};
}
const root = () => ({uid: 0, euid: 0});
const delegating = () => memoryFs({[`${parent}/cgroup.controllers`]: 'cpu memory pids\n',
  [`${parent}/cgroup.subtree_control`]: 'cpu memory pids\n'});
