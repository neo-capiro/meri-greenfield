// Control's close of one original: the final control stop reaches the runner before containment, and containment runs
// even when that stop is refused. Ports are inert fakes; only the close sequence is under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRemoteNativeController} from '../remote-composition.mjs';
import {compileNativeBrokerPlan} from '../broker-stack.mjs';
import {continuationFixture} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {capabilityDigest} from '../task-verifier.mjs';

function controller({stopStatus = 200} = {}) {
  const f = continuationFixture(), control = 'synthetic-control', secure = join(tmpdir(), 'synthetic-secure');
  const runtime = {binding: f.binding, versions: f.target.versions, proxyUrl: 'https://synthetic.invalid', proxyCredential: 'synthetic-proxy', model: 'synthetic',
    deadlineMs: Date.now() + 30000, maxTurns: 1, maxCostMicroUSD: 1, maxOutputBytes: 1};
  const preparationIntent = {workspace: join(tmpdir(), 'synthetic-workspace'), configParentDirectory: join(tmpdir(), 'synthetic-config'), secureStorageDirectory: secure,
    launchTemplate: {command: process.execPath, args: [], env: {CLAUDE_SECURESTORAGE_CONFIG_DIR: secure}}, executableSha256: 'a'.repeat(64),
    imageSha256: f.target.versions.imageDigest.slice(7), runnerSha256: 'c'.repeat(64), sdkOptionsSha256: 'd'.repeat(64), authoritySha256: 'e'.repeat(64)};
  const {original} = compileNativeBrokerPlan({runtime, plan: {}, preparationIntent}), order = [];
  const fetchImpl = async url => {
    order.push('runner ' + new URL(url).pathname.split('/').at(-1));
    return stopStatus === 200 ? Response.json({original, receipt: {physicalStopProven: false, notAllocated: true}}) : Response.json({error: {code: 'TASK_ROUTER_REFUSED'}}, {status: stopStatus});
  };
  const owner = createRemoteNativeController({runtimeConfiguration: {pool: {}, runtime, plan: {}, preparationIntent, taskCapability: 'synthetic-task', controlCapabilitySha256: capabilityDigest(control),
    store: {allocations: {read: async () => ({}), prepareLaunch: async () => {}, consumeLaunch: async () => {}, recordLaunch: async () => {}}},
    allocator: {allocate: async () => ({}), stop: async () => { order.push('containment'); }},
    supervisor: {taskVerifier: {verify: async () => ({})}, admission: {currentAllocation: async () => '{}', withCurrentAllocation: async () => {}}},
    continuation: {prepare: async () => null, readSnapshot: async () => null, resumeOptions: async () => null}, verifyTask: async () => ({}), enabled: true, maxRequestMs: 3000},
    transport: {original, origin: 'https://synthetic-task.invalid', credential: control, fetchImpl}});
  return {owner, order};
}

test('the final control stop reaches the runner before containment revokes and stops its task', async () => {
  const {owner, order} = controller();
  await owner.close();
  assert.deepEqual(order, ['runner stop', 'containment']);
});

test('a refused runner stop still runs containment and reports the failure', async () => {
  const {owner, order} = controller({stopStatus: 403});
  await assert.rejects(owner.close(), /REMOTE_TASK_REFUSED/);
  assert.deepEqual(order, ['runner stop', 'containment']);
});
