/** The browser host's installed configuration: the shared protected material is mocked at the module seam (the real
 * prepare/install/readback path is covered by installed-default-97), the browser layout validation is real. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {PLAYWRIGHT_MCP_VERSION} from '../../worker/conversation/browser/policy.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const layout={kind:'browser-host',limits:{deadlineMaxMs:5000,maxFreshMs:5000,localSettleMs:5000,memoryBytes:2147483648,pidsMax:512,cpuQuotaUs:200000,periodUs:100000},
 paths:{helperPath:'/opt/meri/meri-host-launcher',hostRelayHelperPath:'/opt/meri/meri-host-relay-launcher',nodePath:'/usr/local/bin/node',
  cliPath:'/opt/meri/browser-host/node_modules/@playwright/mcp/cli.js',browsersPath:'/opt/meri/browsers',workspaceRoot:'/var/lib/meri/browser-workspaces'},
 identities:{sdk:{uid:1001,gid:1001},browser:{uid:2002,gid:2002},hostRelay:{uid:3001,gid:3001},localRelay:{uid:3002,gid:3002},proxy:{uid:3003,gid:3003}},
 network:{privateInterfaceName:'ens5',browserProxyPort:3128}};
const material=hostMode=>({installed:true,profile:{layout},allocation:{schema:'meri-conversation-host-allocation/1',tenantId:id(1),conversationId:id(3),hostId:id(7),
 generation:2,hostMode,imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+600000},
 hostIdentity:{schema:'meri-d005-host-identity/1',hostId:id(7),conversationId:id(3),instanceId:'i-0123456789abcdef0',bootId:id(8)},
 binding:{tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1},image:{digest:'sha256:'+'a'.repeat(64)},
 tls:{installed:true,peerSan:'control.meri.internal',peerFingerprint:'b'.repeat(64),maxPeerLifetimeMs:900000,peerNotAfterMs:Date.now()+600000,cleanupCeilingMs:Date.now()+700000},
 control:{address:'10.0.0.1',port:8443,serverName:'control.example',clientName:'control.meri.internal',policySha256:'e'.repeat(64),serverFingerprintSha256:'c'.repeat(64)},
 listen:{address:'10.0.0.11',port:9444,serverName:'browser-host.example'},credentialPaths:['/var/lib/meri/native-bootstrap/installed.json'],installedTls:{tls:{}}});
let current=material('browser-only');
mock.module('../native-processing-host/protected-bootstrap.mjs',{namedExports:{installedHostMaterial:()=>current,PROTECTED_HELPER:'/opt/meri/meri-host-launcher'}});
const {installedBrowserHostConfig,validateBrowserHostLayout,BROWSER_HOST_RELAY_HELPER}=await import('./installed.mjs');

test('a browser-only bundle yields the installation, workspace, identities and network the production host composes',()=>{
 const config=installedBrowserHostConfig();
 assert.equal(config.allocation.hostMode,'browser-only');assert.equal(config.profile,undefined,'the raw profile does not leak into the configuration');
 assert.deepEqual(config.installation,{nodePath:'/usr/local/bin/node',cliPath:layout.paths.cliPath,browsersPath:'/opt/meri/browsers',version:PLAYWRIGHT_MCP_VERSION,egressProxy:'http://127.0.0.1:3128'});
 assert.equal(config.cwd,`/var/lib/meri/browser-workspaces/${id(3)}`);
 assert.deepEqual(config.identities.browser,{uid:2002,gid:2002});assert.deepEqual(config.identities.proxy,{uid:3003,gid:3003});assert.equal(config.paths.hostRelayHelperPath,BROWSER_HOST_RELAY_HELPER);
 assert.deepEqual(config.network,{privateInterfaceName:'ens5',browserProxyPort:3128});assert.equal(config.listen.serverName,'browser-host.example');
 assert.deepEqual(config.limits,layout.limits);
});
test('a native-processing bundle never configures the browser host',()=>{
 current=material('native-processing');
 assert.throws(()=>installedBrowserHostConfig(),{code:'BROWSER_HOST_INSTALLED_REFUSED'});
 current=material('browser-only');
});
test('the browser layout refuses other kinds, foreign executables, shared or privileged identities, open limits and bad network facts',()=>{
 const over=(path,value)=>{const copy=structuredClone(layout);const keys=path.split('.');let node=copy;for(const key of keys.slice(0,-1))node=node[key];node[keys.at(-1)]=value;return copy;};
 for(const bad of [
  over('kind','native-processing'),over('paths.helperPath','/usr/local/bin/meri-host-launcher'),over('paths.hostRelayHelperPath','/opt/meri/other'),
  over('paths.cliPath','/opt/meri/browser-host/node_modules/@playwright/mcp/index.js'),over('paths.workspaceRoot','relative/path'),over('paths.browsersPath','/opt/../etc'),
  over('identities.browser.uid',1001),over('identities.sdk.uid',0),over('identities.localRelay.gid',70000),
  over('limits.deadlineMaxMs',999),over('limits.maxFreshMs',30001),over('limits.localSettleMs',undefined),over('limits.pidsMax',0),over('limits.memoryBytes',1024),
  over('identities.proxy',undefined),over('identities.proxy.uid',3002),
  over('network.privateInterfaceName','Eth0;rm'),over('network.browserProxyPort',80),
 ])assert.throws(()=>validateBrowserHostLayout(bad),{code:'BROWSER_HOST_INSTALLED_REFUSED'});
 assert.throws(()=>validateBrowserHostLayout(null),{code:'BROWSER_HOST_INSTALLED_REFUSED'});
 assert.equal(Object.isFrozen(validateBrowserHostLayout(layout).identities),true);
});
