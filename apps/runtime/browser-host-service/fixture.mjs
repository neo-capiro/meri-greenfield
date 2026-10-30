/** Inert shared fixture for the browser-only service tests.
 *
 * Test-only mTLS material is generated in memory by the same cryptography-based helper the accepted viewer transport
 * test uses. No real credential files are read and no native/socket/browser resource is created.
 */
import {execFileSync} from 'node:child_process';
import {X509Certificate} from 'node:crypto';
import {binding, installation, enabledPolicy} from '../../worker/conversation/browser/test/fixtures.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {BROWSER_WORKSPACE_READBACK_SCHEMA} from '../../worker/conversation/host/browser-workspace/readback.mjs';
import {browserPaths} from '../../worker/conversation/browser/workspace.mjs';

const issuer = String.raw`
import json,base64
from datetime import datetime,timedelta,timezone
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from cryptography.x509.oid import NameOID,ExtendedKeyUsageOID
now=datetime.now(timezone.utc)
def make(name,parent=None,server=False):
 key=ed25519.Ed25519PrivateKey.generate()
 subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)])
 b=x509.CertificateBuilder().subject_name(subject).issuer_name(parent[1].subject if parent else subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(seconds=10)).not_valid_after(now+timedelta(minutes=5))
 b=b.add_extension(x509.BasicConstraints(ca=parent is None,path_length=None),critical=True)
 if parent:
  b=b.add_extension(x509.SubjectAlternativeName([x509.DNSName(name)]),critical=False)
  b=b.add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH if server else ExtendedKeyUsageOID.CLIENT_AUTH]),critical=False)
 cert=b.sign(parent[0] if parent else key,algorithm=None)
 return key,cert
root=make('fixture-ca'); host=make('browser.meri.internal',root,True); control=make('control.meri.internal',root)
out={}
for name,pair in [('ca',root),('host',host),('control',control)]:
 out[name+'Cert']=base64.b64encode(pair[1].public_bytes(serialization.Encoding.PEM)).decode()
 if name!='ca':out[name+'Key']=base64.b64encode(pair[0].private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())).decode()
print(json.dumps(out))
`;
const generated = JSON.parse(execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', issuer], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
const material = Object.fromEntries(Object.entries(generated).map(([key, value]) => [key, Buffer.from(value, 'base64')]));

export const TLS = Object.freeze({
  serverName: 'browser.meri.internal',
  cert: material.hostCert,
  key: material.hostKey,
  clientCa: material.caCert,
});
export const PEER = Object.freeze({
  name: 'control.meri.internal',
  fingerprintSha256: new X509Certificate(material.controlCert).fingerprint256.replaceAll(':', '').toLowerCase(),
});

export const {launch, ...contextInstallation} = installation;
export const policy = validateBrowserPolicy(enabledPolicy());
export const policySha256 = canonicalSha256(policy);
export const cwd = `/workspace/${binding.conversationId}`;
export const paths = browserPaths(cwd);
export const allocation = Object.freeze({
  schema: 'meri-conversation-host-allocation/1', tenantId: binding.tenantId, conversationId: binding.conversationId, generation: 1,
  hostMode: 'browser-only', hostId: '00000000-0000-4000-8000-000000000002',
  imageDigest: `sha256:${'a'.repeat(64)}`, leaseDeadlineMs: Date.now() + 300000,
});
export const hostIdentity = Object.freeze({
  schema: 'meri-d005-host-identity/1', instanceId: 'i-0123456789abcdef0',
  bootId: '00000000-0000-4000-8000-000000000003', conversationId: binding.conversationId, hostId: allocation.hostId,
});

export function workspaceReadback(overrides = {}) {
  return {
    schema: BROWSER_WORKSPACE_READBACK_SCHEMA,
    allocationSha256: canonicalSha256(allocation), bindingSha256: canonicalSha256(binding),
    hostIdentitySha256: canonicalSha256(hostIdentity), cwd, profile: paths.profile, output: paths.output, home: paths.home,
    browserUid: 2002, browserGid: 2002, sdkUid: 1001, sdkGid: 1001, leaderPid: 301,
    browserMountNamespace: 'mnt:[4026533000]', browserStartTicks: '12345', overlayMountId: '55', stateMountId: '56',
    originalCwdInode: '42', stateInode: '43', observedAtMs: Date.now(), ...overrides,
  };
}

/** Scripted lowest-level ports; constructors stay real unless a Linux-only seam must be replaced. */
export function serviceFixture(overrides = {}) {
  const events = [];
  const counters = {open: 0, close: 0};
  let releasePrepare, releaseView, readRun;
  const prepareGate = new Promise(resolve => { releasePrepare = () => resolve({readable: {}, writable: {}, installation: contextInstallation, close: async () => { events.push('launch-close'); }}); });
  const viewGate = new Promise(resolve => { releaseView = () => resolve({address: '127.0.0.1', port: 9443}); });
  let releaseClose;
  const stalledClose = new Promise(resolve => { releaseClose = resolve; });
  const sessions = {
    ownerInstanceId: 'session-facade',
    async open() { counters.open++; events.push('session-open'); },
    async destroy() { events.push('session-destroy'); },
  };
  const input = {
    allocation, binding, hostIdentity, cwd, deadlineMs: Date.now() + 60000,
    policy, installation: contextInstallation, upstream: {createConnection() {}}, controls: {bind() {}},
    current: async () => ({binding}), siteWorkflows: {}, hold: async () => ({}), dispose: async () => ({disposed: true}),
    browserClient: {async readCurrent() { events.push('current'); return {allocation, binding, policySha256, phase: 'active', checkedAtMs: Date.now(), currentUntilMs: Date.now() + 1000}; }},
    maxFreshMs: 1000,
    workspaceOwnership: {sdkUid: 1001, sdkGid: 1001, browserUid: 2002, browserGid: 2002},
    prepareBrowserWorkspace: () => { events.push('prepare-workspace'); return {cwd, paths, cwdInode: '42', stateInode: '43'}; },
    readWorkspace: async () => { events.push('readback'); return workspaceReadback(); },
    sessionProcesses: {async arm() { events.push('session-arm'); return {armed: true}; }, async waitForExit() { return undefined; }, async close() { events.push('session-observer-close'); }},
    processes: {async arm() { events.push('host-arm'); return {armed: true}; }, async waitForExit() { events.push('observe-processes'); return undefined; }, async close() { events.push('host-observer-close'); }},
    host: {async destroy() { events.push('physical-destroy'); throw Error('cloud-unbound'); }, async observeAbsent() { events.push('physical-observe'); return undefined; }},
    browser: {async revoke() { events.push('egress-revoke'); return {revoked: true}; }, async close() { events.push('egress-close'); return {closed: true}; }},
    browserNetwork: {},
    authority: {readCurrent: async () => ({}), policySha256},
    helperPath: '/opt/meri/bin/meri-host-launcher', browserUid: 2002, browserGid: 2002,
    readRun: async () => ({binding, cwd, deadlineMs: Date.now() + 60000, port: {modelTransport: 'host-owned', policy: async () => policy}}),
    viewer: {bind: {address: '127.0.0.1', port: 9443}, tls: TLS, peer: PEER},
  };
  const deps = {
    launcher: config => ({
      async prepareBrowserContext() {
        events.push('prepare');
        if (overrides.prepareFails) throw Object.assign(Error('LAUNCH_REFUSED'), {code: 'HOST_LAUNCH_UNKNOWN'});
        if (overrides.preparePending) { await prepareGate; events.push('prepare-late'); }
        // Mirrors the real launcher: the pre-exec callback runs before GO and can refuse it.
        await config.onBrowserPrepared({leaderPid: 301, kind: 'browser'});
        events.push('go');
        return {readable: {}, writable: {}, installation: contextInstallation, close: async () => { events.push('launch-close'); }};
      },
      close: async () => { events.push('launcher-close'); },
    }),
    contextPort: () => ({async create() { return {}; }, close: async () => { events.push('context-close'); }}),
    sessionHost: () => sessions,
    operationHost: options => { readRun = options.readRun; events.push('operation-host'); return {executeBrowserOperation: async () => ({})}; },
    viewer: () => ({
      async start() {
        events.push('viewer-start');
        if (overrides.viewFails) throw Error('LISTEN_FAILED');
        if (overrides.viewPending) { await viewGate; events.push('viewer-start-late'); }
        return {address: '127.0.0.1', port: 9443};
      },
      async close() {
        counters.close++;
        events.push('viewer-close');
        if (overrides.viewCloseStalls) return stalledClose;
        if (overrides.viewCloseFails) throw Error('CLOSE_FAILED');
        return {closed: true};
      },
    }),
  };
  return {input: {...input, ...(overrides.input ?? {})}, deps, events, counters, sessions, releasePrepare, releaseView, releaseClose, readRun: () => readRun};
}
