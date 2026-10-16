/** Ephemeral local certificates for transport/material tests; no ambient CA writes. */
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

export function createRunnerTlsCertificateFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'meri-runner-tls-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const openssl = process.platform === 'win32' ? 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe' : 'openssl';
  const run = args => execFileSync(openssl, args, {cwd: directory, stdio: 'ignore'});
  run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2', '-subj', '/CN=synthetic-test-ca']);
  const ca = readFileSync(join(directory, 'ca.pem'));
  function issueLeaf(id, san) {
    if (!/^[a-z0-9-]+$/u.test(id) || typeof san !== 'string' || /[\r\n]/u.test(san)) throw Error('INVALID_TEST_CERTIFICATE');
    writeFileSync(join(directory, id + '.ext'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=' + san + '\n');
    run(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', id + '.key', '-out', id + '.csr', '-subj', '/CN=ignored-cn']);
    run(['x509', '-req', '-in', id + '.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', id + '.pem', '-days', '1', '-extfile', id + '.ext']);
    return {key: readFileSync(join(directory, id + '.key')), cert: readFileSync(join(directory, id + '.pem'))};
  }
  return {ca, issueLeaf};
}
