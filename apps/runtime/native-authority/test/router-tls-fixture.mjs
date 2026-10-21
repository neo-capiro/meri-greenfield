// Shared harness for the composed task-router tests: a throwaway CA and localhost certificate, the runtime HTTPS listener, control's
// pinned native transport, and the real TLS connection from control's task router to a runner listener (as the production connector
// opens it). Needs --experimental-test-module-mocks on Windows (the CA file uid/mode check is POSIX-only); on Linux the CA file is real.
import test, {mock} from 'node:test';
import * as fsp from 'node:fs/promises';
import {request as httpsRequest} from 'node:https';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {listenRuntime} from '../../http-server.mjs';

export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const certificates = mkdtempSync(join(tmpdir(), 'meri-router-tls-'));
const openssl = process.platform === 'win32' ? 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe' : 'openssl';
const run = args => execFileSync(openssl, args, {cwd: certificates, stdio: 'ignore'});
run(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2',
  '-subj', '/CN=synthetic-control-ca', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
run(['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', 'srv.key', '-out', 'srv.csr', '-subj', '/CN=localhost']);
writeFileSync(join(certificates, 'srv.ext'), 'subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
run(['x509', '-req', '-in', 'srv.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'srv.pem', '-days', '2', '-extfile', 'srv.ext']);
export const ca = readFileSync(join(certificates, 'ca.pem'));
const serverTls = {key: readFileSync(join(certificates, 'srv.key')), cert: readFileSync(join(certificates, 'srv.pem')), minVersion: 'TLSv1.3'};
export let caFile = join(certificates, 'ca.pem');
if (process.platform === 'win32') {
  caFile = '/synthetic/control-ca.pem';
  const handle = {stat: async () => ({isFile: () => true, size: ca.length, uid: 0, mode: 0o100600}), readFile: async () => ca, close: async () => {}};
  mock.module('node:fs/promises', {namedExports: {...fsp, open: async (path, ...rest) => path === caFile ? handle : fsp.open(path, ...rest)}});
  process.getuid ??= () => 0;
} else chmodSync(caFile, 0o600);
export const {createPinnedNativeFetch} = await import('../../pinned-native-transport.mjs');
test.after(() => rmSync(certificates, {recursive: true, force: true}));

export const listen = (application, http = {hostname: 'localhost', port: 0, frontendOrigin: 'https://synthetic.invalid'}) =>
  listenRuntime({configuration: {http, limits: {requestMs: 25000, shutdownMs: 2000}}, application, readiness: async () => ({}), tls: serverTls});

/** The router's connector: one real TLS connection to the runner listener per exchange; close() destroys it like the production
 * connector. `runnerOrigin()` is read at connect time; `beforeConnect({signal})` may add modelled latency. */
export function tlsConnector(runnerOrigin, {beforeConnect = async () => {}} = {}) {
  return {async connect({signal}) {
    await beforeConnect({signal});
    let request;
    return {close: () => request?.destroy(), send: ({operation, body, authorization, signal: sendSignal}) => new Promise((resolve, reject) => {
      request = httpsRequest(runnerOrigin() + '/v1/native-task/' + operation, {method: 'POST', ca, agent: false,
        headers: {authorization, 'content-type': 'application/json', 'content-length': String(body.length)}}, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk)).on('end', () => resolve({status: response.statusCode, body: Buffer.concat(chunks)})).on('error', reject);
      });
      request.on('error', reject);
      sendSignal?.addEventListener('abort', () => { request.destroy(); reject(Error('aborted')); }, {once: true});
      request.end(body);
    })};
  }};
}
