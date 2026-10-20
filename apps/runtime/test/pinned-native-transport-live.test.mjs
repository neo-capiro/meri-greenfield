// Real transport reproduction: the actual apps/runtime/pinned-native-transport.mjs over a local TLS listener that stands
// in for control behind the private ALB, driven through the deployed remote SDK process client and runner diagnostics.
// Needs: node --experimental-test-module-mocks (the CA file's uid/mode check is POSIX-only; the CA bytes are presented
// through an inert handle) and an `openssl` binary for a throwaway CA. No provider, SDK process, network or credential.
// On the deployed tree every failure prints `native-start code=UNKNOWN`; on the repaired tree the fixed class appears.
import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {withRunnerDiagnostics, markRunnerStage} from '../runner-runtime-diagnostics.mjs';
import {createRemoteSdkProcessClient} from '../native-authority/remote-task-client.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {binding, versions} from '../../control/conversations/test/store-fixture.mjs';

const dir = mkdtempSync(join(tmpdir(), 'meri-pinned-live-'));
const openssl = args => execFileSync('openssl', args, {cwd: dir, stdio: ['ignore', 'ignore', 'pipe']});
openssl(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2',
  '-subj', '/CN=synthetic-control-ca', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
openssl(['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', 'srv.key', '-out', 'srv.csr', '-subj', '/CN=localhost']);
writeFileSync(join(dir, 'srv.ext'), 'subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
openssl(['x509', '-req', '-in', 'srv.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'srv.pem', '-days', '2', '-extfile', 'srv.ext']);
const ca = readFileSync(join(dir, 'ca.pem'));

mock.module('node:fs/promises', {namedExports: {open: async () => ({
  stat: async () => ({isFile: () => true, size: ca.length, uid: 0, mode: 0o100600}), readFile: async () => ca, close: async () => {}})}});
process.getuid ??= () => 0;
const transport = await import('../pinned-native-transport.mjs');
const repaired = Array.isArray(transport.PINNED_NATIVE_FAILURE_CODES);

const descriptor = {command: '/synthetic/node', args: [], cwd: '/synthetic/workspace', env: {}};
let mode = 'ok';
const json = (res, status, value) => {const body = Buffer.from(JSON.stringify(value)); res.writeHead(status, {'content-type': 'application/json', 'content-length': String(body.length)}); res.end(body);};
const server = createServer({key: readFileSync(join(dir, 'srv.key')), cert: readFileSync(join(dir, 'srv.pem')), minVersion: 'TLSv1.3'}, (req, res) => {
  let body = ''; req.on('data', chunk => {body += chunk;});
  req.on('end', () => {
    const {original} = JSON.parse(body), operation = req.url.split('/').at(-1);
    if (operation === 'prepare') return json(res, 200, {original, descriptorSha256: hash(descriptor)});
    if (operation === 'stop') return json(res, 200, {original, receipt: {physicalStopProven: false, notAllocated: true}});
    if (operation !== 'start') return json(res, 200, {original});
    if (mode === 'control-403') return json(res, 403, {error: {code: 'TASK_ROUTER_REFUSED'}});
    if (mode === 'edge-400') return json(res, 400, {});
    if (mode === 'reset-before-headers') {res.socket.destroy(); return;}
    if (mode === 'close-mid-body') {res.writeHead(200, {'content-type': 'application/json', 'content-length': '64'}); res.write('{"original":'); setTimeout(() => res.socket.destroy(), 20); return;}
    return json(res, 200, {original, descriptorSha256: hash(descriptor)});
  });
});
await new Promise(resolve => server.listen(0, 'localhost', resolve));
const origin = `https://localhost:${server.address().port}`;
test.after(() => {server.close(); rmSync(dir, {recursive: true, force: true});});

async function driveStart(selected) {
  mode = selected;
  const executionKey = hash(binding);
  const original = {binding, versions, executionKey, executionId: executionKey, planSha256: hash(descriptor), expiresAtMs: Date.now() + 120000};
  const fetchImpl = await transport.createPinnedNativeFetch({origin, caFile: '/synthetic/control-ca.pem', caSha256: createHash('sha256').update(ca).digest('hex')});
  const client = createRemoteSdkProcessClient({original, origin, credential: 'synthetic-task-only', fetchImpl});
  const lines = []; let startError;
  const outcome = await withRunnerDiagnostics(async () => {
    markRunnerStage('activity-stream'); client.spawnClaudeCodeProcess(descriptor);
    try {await client.startPreparedProcess();} catch (error) {startError = error; throw error;}
  }, {write: line => lines.push(line)}).then(() => null, error => error);
  await client.close().catch(() => {});
  return {lines, error: startError, outcome, status: client.status()};
}
const firstLine = code => `RUNNER_FIRST_FAILURE origin=native-start code=${code}\n`;

test('native start succeeds through the real pinned transport when control answers 200', async () => {
  const {lines, outcome, status} = await driveStart('ok');
  assert.equal(outcome, null);
  assert.deepEqual(lines, []);
  assert.equal(status.started, true);
});

for (const [selected, repairedCode] of [['control-403', 'PINNED_NATIVE_STATUS_403'], ['edge-400', 'PINNED_NATIVE_STATUS_4XX'],
  ['reset-before-headers', 'PINNED_NATIVE_SOCKET'], ['close-mid-body', 'PINNED_NATIVE_SOCKET']]) {
  test(`${selected} at native start is reported as ${repaired ? repairedCode : 'UNKNOWN (deployed tree)'}`, async () => {
    const {lines, error, outcome} = await driveStart(selected);
    assert.equal(outcome, error);
    assert.equal(error.message, 'PINNED_NATIVE_REFUSED');
    assert.equal(lines[0], firstLine(repaired ? repairedCode : 'UNKNOWN'));
    if (!repaired) assert.equal(Object.getOwnPropertyDescriptor(error, 'code'), undefined);
    else assert.equal(error.code, repairedCode);
  });
}
