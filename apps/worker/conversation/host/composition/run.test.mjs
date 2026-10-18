/** Synthetic native/control ports only. This never starts an SDK, namespace, browser, model call or cloud action. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding,enabledPolicy,installationFor,sourceScopes} from '../../browser/test/fixtures.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createNativeLocalRelayPort} from '../network/launcher-adapter.mjs';
import {createSdkLaunchGate} from '../launcher/sdk-quiescence.mjs';
import {createBrowserHostRuntimePort} from '../browser-runtime-port.mjs';
import {armBrowserAfterWorkspaceReadback,prepareGuestHostRun} from './run.mjs';
import {BROWSER_WORKSPACE_READBACK_SCHEMA} from '../browser-workspace/readback.mjs';
import {browserPaths} from '../../browser/workspace.mjs';

const fault=code=>error=>error?.code===code;
const allocation=()=>({schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,
 leaseDeadlineMs:Date.now()+60000});
const hostIdentity=a=>({schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',
 bootId:'00000001-0000-4000-8000-000000000000',conversationId:binding.conversationId,hostId:a.hostId});
const waitTick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture({onNetwork,onBash,teardownError}={}){
 const a=allocation(),events=[],monitors=[],clientPurposes=[],networks=[];
 let grantCount=0,launcherArgs,launcherCount=0,observerArms=0;const launcherCalls=[];
 const validBrowserInstallation=installationFor(binding);
 const components={
  createClient({purpose}){clientPurposes.push(purpose);return {
   async readCurrent({allocation,binding,policySha256}){events.push(`current:${purpose}`);
    const checkedAtMs=Date.now();return {allocation,binding,policySha256,phase:'active',checkedAtMs,
     currentUntilMs:checkedAtMs+5000};},close(){events.push(`client-close:${purpose}`);}};},
  async startMonitor({capabilityPolicy,readCurrent,allocation,binding}){
   const controller=new AbortController(),policySha256=canonicalSha256(assertCapabilityPolicy(capabilityPolicy));
   await readCurrent({allocation,binding,policySha256});
   const monitor={signal:controller.signal,policySha256,async refresh(){events.push('monitor-refresh');
    return readCurrent({allocation,binding,policySha256});},close(){controller.abort();events.push('monitor-close');}};
   monitors.push({controller,monitor});return monitor;
  },
  async startBrowserEgress(){events.push('proxy-denied');return {endpoint:'http://127.0.0.1:3128',
   async grant(){grantCount++;throw Error('must not grant during bootstrap');},
   async revoke(){events.push('proxy-revoke');return {revoked:true};},
   async close(){events.push('proxy-close');return {closed:true};}};},
  async prepareBash(input){if(!onBash)throw Error('Bash must be off');return onBash(input);},
  async prepareNetwork(input){events.push(`network-prepare:${input.kind}`);if(onNetwork)await onNetwork(input);
   const handle={plan:{kind:input.kind},async verify(){events.push(`network-verify:${input.kind}`);
    return {verified:true,kind:input.kind};},async close(){events.push(`network-close:${input.kind}`);return {closed:true};}};
   networks.push(handle);return handle;},
  createBrowserObserver(){return {async arm(){observerArms++;events.push('browser-arm');},
   async waitForExit(){events.push('browser-process-wait');return {exited:true};},
   async close(){events.push('browser-observer-close');}};},
  createHostObserver(){return {async arm(){observerArms++;events.push('sdk-arm');},
   async waitForExit(){events.push('process-wait');return {exited:true};},
   async close(){events.push('host-observer-close');}};},
  createLauncher(args){launcherArgs=args;launcherCalls.push(args);launcherCount++;assert.equal(args.sdkLaunchGate.state,'idle');
   assert.ok(args.authorities.every(x=>Object.keys(x).sort().join(',')==='maxFreshMs,policySha256,readCurrent'));
   events.push('launcher-created');return {async prepareBrowserBroker(){events.push('broker-bound');
    return {installation:validBrowserInstallation,failure:new Promise(()=>{}),async close(){events.push('broker-close');return {closed:true};}};},
    createSdkProcessClient(){events.push('process-client');return {kind:'one-sdk-query'};},
    async close(){events.push('launcher-close');return {closed:true};}};},
  createLocalRelayPort:createNativeLocalRelayPort,createSdkLaunchGate,
  async createConfinedReadinessPorts(){throw Error('readiness must not start in this fixture');},
  createSdkQuiescenceObserver(){events.push('readiness-observer-created');return {
   async arm(){events.push('readiness-arm');},async waitQuiescent(){events.push('readiness-wait');
    return {quiescent:true};},async close(){events.push('readiness-observer-close');}};},
  createSdkQuiescenceReader(){throw Error('Bash must be off');},
  async startLocalRelay(){throw Error('native relay must not start in scripted network');},
  createBrowserPort:createBrowserHostRuntimePort,
  createTeardown({ports}){return {async settle(){events.push('teardown-start');
   await ports.browser.revoke();await ports.bash.revoke();
   await ports.browser.close();await ports.bash.close();
   await ports.processes.waitForExit();events.push('teardown-end');
   if(teardownError)throw Object.assign(Error('HOST_TEARDOWN_UNKNOWN'),{code:'HOST_TEARDOWN_UNKNOWN'});
   return {status:'VERIFIED'};}};},
 };
 const input={allocation:a,binding,hostIdentity:hostIdentity(a),cwd:`/tmp/${binding.conversationId}`,
  deadlineMs:a.leaseDeadlineMs-1000,capabilityPolicy:{},readBrowserPolicy:async()=>enabledPolicy(),
  control:{endpoint:{address:'10.0.1.11',port:443},tls:{},maxFreshMs:10000,refreshEveryMs:1000,timeoutMs:1000},
  model:{endpoint:{address:'10.0.1.10',port:443},localCaPath:'/opt/meri/trust/model-proxy-ca.pem'},
  browser:{installation:validBrowserInstallation,resolve:async()=>{},sourceScopes,
   approvals:{async decide(){}},artifacts:{async ingest(){}},receipts:{async record(){}}},
  bash:{},native:{helperPath:'/opt/meri/bin/meri-native-launch',shimPath:'/opt/meri/bin/meri-mcp-shim',
   nodePath:'/opt/scripted/node',
   sdk:{uid:24001,gid:24001},browser:{uid:24002,gid:24002},
   relay:{sdk:{uid:24003,gid:24003},browser:{uid:24004,gid:24004}},
   validateSdkDescriptor:x=>x,verifyConfinement:async()=>{}},
  network:{sdkRoutes:[{name:'model-proxy',localPort:8443,targetAddress:'10.0.1.10',targetPort:443},
   {name:'control',localPort:8444,targetAddress:'10.0.1.11',targetPort:443}]},
  host:{async destroy(){},async observeAbsent(){}},components};
 return {input,events,monitors,clientPurposes,networks,get grantCount(){return grantCount;},
  get launcherArgs(){return launcherArgs;},launcherCalls,get launcherCount(){return launcherCount;},
  get observerArms(){return observerArms;}};
}

test('held browser bootstrap authenticates SDK, binds one process client and exposes no browser',async()=>{
 const f=fixture(),run=await prepareGuestHostRun(f.input);
 assert.deepEqual(f.clientPurposes,['sdk']);
 assert.equal(f.grantCount,0);assert.equal(f.observerArms,0);assert.equal(f.launcherCount,1);
 assert.equal(run.browserPort,undefined);assert.equal(f.events.includes('broker-bound'),false);
 assert.deepEqual(run.processClientFactory(),{kind:'one-sdk-query'});
 assert.throws(()=>f.launcherArgs.validateSdkDescriptor({env:{ANTHROPIC_BASE_URL:'https://10.0.1.10/',
  NODE_EXTRA_CA_CERTS:'/opt/meri/trust/model-proxy-ca.pem'}}),fault('HOST_MODEL_DESCRIPTOR_REFUSED'));
 assert.deepEqual(f.launcherArgs.validateSdkDescriptor({env:{ANTHROPIC_BASE_URL:'https://127.0.0.1:8443/',
  NODE_EXTRA_CA_CERTS:'/opt/meri/trust/model-proxy-ca.pem'}}),{env:{ANTHROPIC_BASE_URL:'https://127.0.0.1:8443/',
  NODE_EXTRA_CA_CERTS:'/opt/meri/trust/model-proxy-ca.pem'}});
 assert.throws(()=>run.processClientFactory(),fault('HOST_SDK_QUERY_REUSED'));
 await f.launcherArgs.onSdkPrepared({sdkLeaderPid:1234});
 assert.throws(()=>f.launcherArgs.onBrowserPrepared({leaderPid:5678}),fault('HOST_BROWSER_NOT_ADMITTED'));
 assert.equal(f.observerArms,1);
 assert.deepEqual(await run.settle({reason:'conversation-end'}),{status:'VERIFIED'});
 assert.ok(f.events.indexOf('network-close:sdk')<f.events.indexOf('process-wait'));
 assert.equal(f.events.includes('network-close:browser'),false);
 assert.equal(f.grantCount,0);
});

test('monitor revocation cuts SDK relays and schedules one teardown without caller settlement',async()=>{
 const f=fixture(),run=await prepareGuestHostRun(f.input);
 f.monitors[0].controller.abort();await waitTick();
 assert.ok(f.events.includes('network-close:sdk'));
 assert.equal(f.events.includes('network-close:browser'),false);
 assert.equal(f.events.includes('proxy-close'),false);
 assert.equal(f.events.filter(x=>x==='teardown-start').length,1);
 assert.deepEqual(await run.settle(),{status:'VERIFIED'});
 assert.throws(()=>run.processClientFactory(),fault('HOST_BOOTSTRAP_REVOKED'));
});

test('default enabled but held browser keeps the single SDK path available without broker or browser network',async()=>{
 const f=fixture();
 f.input.browser={};
 const run=await prepareGuestHostRun(f.input);
 assert.deepEqual(f.clientPurposes,['sdk']);
 assert.equal(run.browserPort,undefined);assert.equal(run.browserInstallation,undefined);
 assert.equal(f.events.includes('broker-bound'),false);
 assert.equal(f.events.includes('network-prepare:browser'),false);
 assert.deepEqual(run.processClientFactory(),{kind:'one-sdk-query'});
 await run.settle({reason:'conversation-end'});
});

test('explicit disabled browser policy omits broker while SDK remains available',async()=>{
 const f=fixture();f.input.readBrowserPolicy=async()=>({enabled:false});
 f.input.browser={};
 const run=await prepareGuestHostRun(f.input);
 assert.deepEqual(f.clientPurposes,['sdk']);
 assert.equal(run.browserPort,undefined);assert.equal(f.events.includes('broker-bound'),false);
 assert.equal(f.events.includes('network-prepare:browser'),false);
 assert.deepEqual(run.processClientFactory(),{kind:'one-sdk-query'});
 await run.settle({reason:'conversation-end'});
});

test('revocation while SDK namespace is pending closes its late handle and never launches',async()=>{
 let entered,release;const waiting=new Promise(resolve=>{release=resolve;});
 const reached=new Promise(resolve=>{entered=resolve;});
 const f=fixture({onNetwork:async input=>{if(input.kind==='sdk'){entered();await waiting;}}});
 const controller=new AbortController();f.input.signal=controller.signal;
 const pending=prepareGuestHostRun(f.input);await reached;
 controller.abort();release();
 // No SDK leader was armed, so physical/process absence cannot be verified: the host remains UNKNOWN.
 await assert.rejects(pending,fault('HOST_BOOTSTRAP_UNKNOWN'));
 assert.ok(f.events.includes('network-close:sdk'));
 assert.equal(f.events.includes('network-prepare:browser'),false);
 assert.equal(f.launcherCount,0);assert.equal(f.grantCount,0);
});

test('Bash needs confined readiness and four independent process identities',async()=>{
 const f=fixture();f.input.capabilityPolicy={bash:true};
 await assert.rejects(prepareGuestHostRun(f.input),fault('HOST_BOOTSTRAP_CONFIGURATION'));
 assert.equal(f.events.length,0);
 const g=fixture();g.input.native.relay.sdk.uid=g.input.native.sdk.uid;
 await assert.rejects(prepareGuestHostRun(g.input),fault('HOST_BOOTSTRAP_CONFIGURATION'));
 assert.equal(g.events.length,0);
});

test('SDK control and model relays must match trusted endpoints exactly',async()=>{
 const f=fixture();f.input.network.sdkRoutes[1].targetAddress='10.0.1.99';
 await assert.rejects(prepareGuestHostRun(f.input),fault('HOST_BOOTSTRAP_CONFIGURATION'));
 assert.equal(f.events.length,0);
 const g=fixture();g.input.model.endpoint.port=444;
 await assert.rejects(prepareGuestHostRun(g.input),fault('HOST_BOOTSTRAP_CONFIGURATION'));
 assert.equal(g.events.length,0);
});

test('paused browser child needs measured workspace readback before observer arm',async()=>{
 const f=fixture(),events=[],paths=browserPaths(f.input.cwd),scope={allocation:f.input.allocation,
  binding,hostIdentity:f.input.hostIdentity,cwd:f.input.cwd,paths,
  browserUid:24002,browserGid:24002,sdkUid:24001,sdkGid:24001,leaderPid:5678,
  browserObserver:{async arm(){events.push('armed');return {armed:true};}}};
 const measured={schema:BROWSER_WORKSPACE_READBACK_SCHEMA,
  allocationSha256:canonicalSha256(scope.allocation),bindingSha256:canonicalSha256(binding),
  hostIdentitySha256:canonicalSha256(scope.hostIdentity),cwd:scope.cwd,profile:paths.profile,
  output:paths.output,home:paths.home,browserUid:24002,browserGid:24002,
  sdkUid:24001,sdkGid:24001,leaderPid:5678,browserMountNamespace:'mnt:[123]',
  browserStartTicks:'987654',overlayMountId:'10',stateMountId:'11',originalCwdInode:'42',
  stateInode:'43',observedAtMs:Date.now()};
 await assert.rejects(armBrowserAfterWorkspaceReadback({...scope,
  readWorkspace:async()=>{events.push('readback');throw Error('overlay absent');}}));
 assert.deepEqual(events,['readback']);
 await assert.rejects(armBrowserAfterWorkspaceReadback({...scope,
  readWorkspace:async()=>({...measured,sourceFilesInaccessible:true,schema:'old-boolean-claim'})}),
  fault('HOST_BROWSER_WORKSPACE_UNPROVEN'));
 assert.deepEqual(events,['readback']);
 assert.deepEqual(await armBrowserAfterWorkspaceReadback({...scope,
  readWorkspace:async()=>{events.push('readback');return measured;}}),{armed:true});
 assert.deepEqual(events,['readback','readback','armed']);
});

test('Bash outer proof must match this host generation and boot before readiness',async()=>{
 for(const wrong of ['generation','boot']){
  let readinessCalled=false;
  const f=fixture({onBash:async input=>{
   await input.verifyOuterIsolation({binding,expiresAtMs:input.expiresAtMs});
   readinessCalled=true;await input.createReadinessPorts({pathEnv:'/usr/bin'});
  }});
  f.input.capabilityPolicy={bash:true};
  f.input.native.validateReadinessDescriptor=x=>x;
  f.input.bash.verifyOuterIsolation=async()=>({allocation:wrong==='generation'?{
   ...f.input.allocation,generation:2}:f.input.allocation,
   hostIdentity:wrong==='boot'?{...f.input.hostIdentity,bootId:'00000002-0000-4000-8000-000000000000'}:
    f.input.hostIdentity,receipt:{}});
  await assert.rejects(prepareGuestHostRun(f.input),fault('HOST_BASH_HOST_MISMATCH'));
  assert.equal(readinessCalled,false);
  assert.equal(f.events.includes('process-client'),false);
  assert.equal(f.grantCount,0);
 }
});

test('offline Bash readiness uses a separate confined launcher under the conversation SDK gate',async()=>{
 const f=fixture({onBash:async input=>{
  await input.verifyOuterIsolation({binding,expiresAtMs:input.expiresAtMs});
  const ports=await input.createReadinessPorts({pathEnv:'/usr/bin'});await ports.close();
  return {allocation:f.input.allocation,hostIdentity:f.input.hostIdentity,runtimeFacts:{bashSandbox:{available:true}},
   async close(){return {closed:true};}};
 }});
 f.input.capabilityPolicy={bash:true};
 f.input.native.validateReadinessDescriptor=x=>x;
 f.input.bash.verifyOuterIsolation=async()=>({allocation:f.input.allocation,
  hostIdentity:f.input.hostIdentity,receipt:{}});
 f.input.components.createConfinedReadinessPorts=async({sdkUid,sdkGid,makeLauncher})=>{
  assert.equal(sdkUid,24001);assert.equal(sdkGid,24001);
  makeLauncher({probeCommand:'/usr/bin/bwrap',probeNodePath:'/opt/scripted/node'});
  await f.launcherArgs.onSdkPrepared({sdkLeaderPid:999});
  return {async close(){}};
 };
 const run=await prepareGuestHostRun(f.input);
 assert.equal(f.launcherCalls.length,2);
 assert.equal(f.launcherCalls[0].sdkMode,'conversation');
 assert.equal(f.launcherCalls[1].sdkMode,'readiness');
 assert.equal(f.launcherCalls[0].sdkLaunchGate,f.launcherCalls[1].sdkLaunchGate);
 assert.ok(f.events.indexOf('readiness-arm')<f.events.indexOf('readiness-wait'));
 assert.equal(run.bashRuntimeFacts.bashSandbox.available,true);
 await run.settle({reason:'conversation-end'});
});

test('uncertain teardown after startup failure surfaces UNKNOWN',async()=>{
 const f=fixture({onNetwork:async input=>{if(input.kind==='sdk')throw Error('namespace failed');},teardownError:true});
 await assert.rejects(prepareGuestHostRun(f.input),fault('HOST_BOOTSTRAP_UNKNOWN'));
 assert.ok(f.events.includes('network-prepare:sdk'));
 assert.equal(f.events.includes('launcher-created'),false);
});
