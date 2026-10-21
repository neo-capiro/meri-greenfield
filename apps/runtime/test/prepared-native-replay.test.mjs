import {hotPathBudgets} from '../../../packages/runtime/hot-path-budgets.mjs';
// D8: control's in-process native provider (prepared-candidate.mjs localNative) keeps a task verify that did not answer transient.
// End to end, the runner's real native client calls run-owner routes through the real pinned transport and control's production
// listener (http-server.mjs). Behind it are the real prepared candidate (localNative and its in-process native application),
// worker-http, the task authority and the task verifier's HTTP boundary (task-verifier-http.mjs).
// Scripted: the task verifier's decision (did not answer, refused, or a receipt), shaped as task-verifier.mjs throws it; the action
// session port; and the conversation service's load. The kickoff owner is replaced only to reach the lazily allocated controller;
// it is not on this path.
// Linux only: the prepared candidate compiles its native preparation intent for POSIX paths, and the transport opens a real 0600 CA
// file owned by this uid (no mock, no security-check bypass).
import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, chmodSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRunnerTlsCertificateFixture} from '../native-authority/test/runner-tls-fixture.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {isAuthorityUnavailable, markAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {capabilityDigest, taskFault} from '../native-authority/task-verifier.mjs';
import {createNativeTaskVerifierApplication} from '../native-authority/task-verifier-http.mjs';
import {createWorkerRunApplication} from '../worker-http.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createPinnedNativeFetch} from '../pinned-native-transport.mjs';
import {listenRuntime} from '../http-server.mjs';

const skip = process.platform === 'win32' && 'POSIX: the prepared candidate compiles its native preparation intent for Linux paths';
let lazy;
mock.module('../native-authority/prepared-kickoff.mjs', {namedExports: {createPreparedTaskKickoff({controller}) {
  lazy = controller; return {async kickoff() {}, async status() {}, async stop() {}, async close() {await controller.close();}};}}});
const {assemblePreparedCandidate} = await import('../prepared-candidate.mjs');

// --- control: the real prepared candidate under the real worker-http, served by the production listener -------------------
const f = candidateFixture(), clientId = f.scopes[0].resourceId;
let decisions = [], scripted = [], verifies = [], loads = [], served = [];
// What task-verifier.mjs throws: NATIVE_TASK_REFUSED, carrying the did-not-answer mark only when Core/Clerk did not answer.
const verifier = {async verify(input) {
  verifies.push(input.operation);
  const next = decisions.shift() ?? 'receipt';
  if (next === 'unanswered') throw markAuthorityUnavailable(taskFault('REFUSED'));
  if (next === 'refused') throw taskFault('REFUSED');
  const now = Date.now();
  return {binding: input.binding, operation: input.operation, inputSha256: input.inputSha256, identityCredential: 'synthetic-native',
    scopes: f.scopes, selectedClientId: clientId, policyRevision: f.scopes[0].policyRevision, authorizationDecisionId: 'synthetic-decision',
    checkedAtMs: now, expiresAtMs: now + 60000};
}};
const verifierApplication = createNativeTaskVerifierApplication({verifier, callerCapabilitySha256: capabilityDigest(f.secret.control),
  taskCapabilitySha256: capabilityDigest(f.secret.task), enabled: true, maxRequestMs: 10000});
// The allocated controller's native application: the task verifier's real HTTP boundary, or a scripted answer queued by a test.
const controllerApplication = {handle: request => scripted.length ? scripted.shift()(request) : verifierApplication.handle(request)};
const sessions = {
  async issue() {return {credential: 'action_session_' + 'a'.repeat(43)};},
  async authenticateSession() {const now = Date.now(); return {principal: {tenantId: f.binding.tenantId, actorId: f.binding.actorId}, checkedAtMs: now, expiresAtMs: now + 30000};},
  async readCurrentState() {const now = Date.now(); return {binding: f.binding, scopes: f.scopes, selectedClientId: clientId, checkedAtMs: now, expiresAtMs: now + 30000};},
  revoke() {}};
const loaded = {synthetic: 'loaded-for-execution'};
const service = {async loadForExecution(value) {loads.push(value.binding.runId); return loaded;}};
const trusted = createRunnerTlsCertificateFixture({after: fn => test.after(fn)}), leaf = trusted.issueLeaf('control', 'DNS:localhost');
const caSha256 = createHash('sha256').update(trusted.ca).digest('hex');
let candidate, caFile, origin;
if (!skip) {
  const dir = mkdtempSync(join(tmpdir(), 'meri-prepared-native-'));
  test.after(() => rmSync(dir, {recursive: true, force: true}));
  caFile = join(dir, 'control-ca.pem'); writeFileSync(caFile, trusted.ca, {mode: 0o600}); chmodSync(caFile, 0o600);
  candidate = assemblePreparedCandidate({budgets:hotPathBudgets({limits:{startupMs:30000,shutdownMs:10000,requestMs:25000},runWindowMs:900000}),configuration: f.configuration, pool: {connect() {throw Error('No SQL');}},
    ecs: {send() {throw Error('No AWS');}}, objects: {async get() {throw Error('No objects');}, async put() {throw Error('No objects');}},
    credentials: f.secret, fetchImpl: async () => {throw Error('No Core: the task verifier decides here');},
    allocate() {return {resource: {taskArn: 'synthetic'}, supervisor: {}, application: controllerApplication, productPorts: {}, async close() {}};}});
  await lazy.allocate();
  // control.mjs binds its whole assembly here; the run-owner routes it reaches are worker-http's.
  candidate.bindApplication(createWorkerRunApplication({service, sessions, native: candidate.native, configuration: {limits: {requestMs: 25000, requestBytes: 131072}}, now: Date.now}));
  const listener = await listenRuntime({budgets:hotPathBudgets({limits:{startupMs:30000,shutdownMs:10000,requestMs:25000},runWindowMs:900000}),configuration: {http: {hostname: 'localhost', port: 0, frontendOrigin: 'https://frontend.synthetic.invalid'}, limits: {requestMs: 25000, shutdownMs: 1000}},
    application: {handle: request => {served.push(new URL(request.url).pathname); return candidate.application.handle(request);}},
    readiness: async () => ({}), tls: {key: leaf.key, cert: leaf.cert}, exposeReadiness: false});
  test.after(async () => {await listener.close(); await candidate.close();});
  origin = `https://localhost:${listener.address.port}`;
}

async function loadThroughPinned(answers) {
  decisions = [...answers]; verifies = []; loads = []; served = [];
  const client = createNativeCapabilityClient({maxRequestMs:3000,loadMaxRequestMs:3000,configuration: {origin, maxResponseBytes: 131072}, credential: 'synthetic-runner-task-capability',
    fetch: await createPinnedNativeFetch({timeoutMs:30000,origin, caFile, caSha256})});
  const outcome = await client.call('runner/load', {binding: f.binding}, {deadlineMs: Date.now() + 15000}).then(value => ({value}), error => ({error}));
  return {...outcome, requests: served.filter(path => path === '/v1/runner/load').length, verifies, loads};
}

test('a task verify whose Core/Clerk read did not answer reaches the runner as 503 and the load is sent again', {skip}, async () => {
  const {value, error, requests, verifies, loads} = await loadThroughPinned(['unanswered']);
  // Replayed once through the pinned transport: the first attempt stops at its first verify; the replay verifies before, between
  // and after the load.
  assert.deepEqual({error: error?.code, cause: error?.cause?.code, requests, verifies, loads, value},
    {error: undefined, cause: undefined, requests: 2, verifies: ['load', 'load', 'load', 'load'], loads: [f.binding.runId], value: loaded});
});

test('a task verify that refused stays a definitive 403: sent once, never loaded', {skip}, async () => {
  const {error, requests, verifies, loads} = await loadThroughPinned(['refused']);
  assert.deepEqual({error: error?.code, transient: isAuthorityUnavailable(error), cause: error?.cause?.code, requests, verifies, loads},
    {error: 'NATIVE_UNAVAILABLE', transient: false, cause: 'PINNED_NATIVE_STATUS_403', requests: 1, verifies: ['load'], loads: []});
});

// --- localNative's classification of every in-process answer (the same rule as native-client.mjs) --------------------------
const answer = (status, body, headers = {}) => () => new Response(typeof body === 'string' ? body : JSON.stringify(body), {status, headers: {'content-type': 'application/json', ...headers}});
const authorize = () => candidate.native.call('worker/authorize', {capability: 'synthetic-runner-task-capability', binding: f.binding, operation: 'load', inputSha256: 'a'.repeat(64)});
for (const [name, reply, transient] of [
  ['the task verifier: Core/Clerk did not answer', answer(503, {error: {code: 'NATIVE_TASK_AUTHORITY_UNAVAILABLE'}}), true],
  ['a worker authority that did not answer', answer(503, {error: {code: 'WORKER_AUTHORITY_UNAVAILABLE'}}), true],
  ['a gateway that lost a dispatched request', answer(503, {error: {code: 'NATIVE_GATEWAY_UNAVAILABLE', outcome: 'UNKNOWN'}}), true],
  ['a disabled task verifier', answer(503, {error: {code: 'NATIVE_TASK_UNAVAILABLE'}}), false],
  ['a gateway refusal', answer(503, {error: {code: 'NATIVE_GATEWAY_UNAVAILABLE', outcome: 'REFUSED'}}), false],
  ['a task verifier refusal', answer(403, {error: {code: 'NATIVE_TASK_REFUSED'}}), false],
  ['a did-not-answer code on a non-503 status', answer(500, {error: {code: 'NATIVE_TASK_AUTHORITY_UNAVAILABLE'}}), false],
  ['a 503 that is not declared JSON', answer(503, {error: {code: 'NATIVE_TASK_AUTHORITY_UNAVAILABLE'}}, {'content-type': 'text/plain'}), false],
  ['an encoded 503', answer(503, {error: {code: 'NATIVE_TASK_AUTHORITY_UNAVAILABLE'}}, {'content-encoding': 'gzip'}), false],
  ['an oversized 503', answer(503, {error: {code: 'NATIVE_TASK_AUTHORITY_UNAVAILABLE'}, pad: 'x'.repeat(5000)}), false],
  ['an unparsable 503', answer(503, '{"error":'), false],
  ['no in-process route', () => null, false],
]) {
  test(`localNative: ${name} is ${transient ? 'transient (marked NATIVE_UNAVAILABLE)' : 'definitive'}`, {skip}, async () => {
    scripted = [reply];
    const error = await authorize().then(() => assert.fail('resolved'), error => error);
    assert.equal(scripted.length, 0, 'the scripted answer was used');
    assert.equal(isAuthorityUnavailable(error), transient);
    assert.equal(error.code ?? error.message, transient ? 'NATIVE_UNAVAILABLE' : 'PREPARED_CANDIDATE_REFUSED');
  });
}
test('localNative: a 200 answer is the value', {skip}, async () => {
  scripted = [answer(200, {authorized: 'synthetic'})];
  assert.deepEqual(await authorize(), {authorized: 'synthetic'});
});
