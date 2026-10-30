/** Native/currentness ports are scripted; real binding/runtime adapter and launch-gate semantics are retained. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {successorPreparer} from './successor.mjs';
import {binding,enabledPolicy,installationFor,sourceScopes} from '../../browser/test/fixtures.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createBrowserHostRuntimePort} from '../browser-runtime-port.mjs';
import {createSdkLaunchGate} from '../launcher/sdk-quiescence.mjs';
import {browserPaths} from '../../browser/workspace.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const target=(source,n)=>({...source,runId:uuid(n),attemptId:uuid(n+1),workerId:uuid(n+2),writerFence:source.writerFence+1});
function fixture(){
 const now=Date.now(),a={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
  generation:1,hostId:uuid(10),imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:now+60000};
 const i={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',bootId:uuid(11),conversationId:binding.conversationId,hostId:a.hostId};
 const owner=new AbortController(),events=[],resources=[],monitors=[],prepared=[],adoptions=[];
 const policy=enabledPolicy(),digest=canonicalSha256(policy),ownerId=uuid(12),cwd='/tmp/'+binding.conversationId;
 let logical=binding,canonical,closed=false,failNetwork=false,closeUnknown=false,revokeCount=0,launcherCount=0,clientCount=0;
 const closedPort=name=>({async close(){events.push(name+'-close');if(closeUnknown&&name==='network')throw Error('network absence unknown');return {closed:true};}});
 const makeLauncher=()=>({
  async prepareSuccessor(input){prepared.push(input);launcherCount++;events.push('successor-launcher');return makeLauncher();},
  async prepareBrowserBroker(){events.push('fresh-broker');return {installation:installationFor(prepared.at(-1).binding),modelTransport:{},failure:new Promise(()=>{}),...closedPort('broker')};},
  createSdkProcessClient(){events.push('sdk-query-client');return {nativeClient:true};},
  async prepareSdkRetirement(){events.push('retirement-prepare');return {prepared:true};},
  async retireSdk(){events.push('sdk-absent');return {sdkAbsent:true};},...closedPort('launcher')});
 const sourceLauncher=makeLauncher();
 const components={createBrowserPort:createBrowserHostRuntimePort,createSdkLaunchGate,
  createClient({binding:b,purpose}){events.push(purpose+'-client');clientCount++;return {async readCurrent(){return {binding:b};},close(){events.push(purpose+'-client-close');}};},
  async startMonitor(input){events.push('monitor');const ac=new AbortController(),m={signal:ac.signal,policySha256:canonicalSha256(input.capabilityPolicy),
   async refresh(){events.push('monitor-refresh');},close(){ac.abort();}};monitors.push({ac,m});return m;},
  createLocalRelayPort(input){assert.equal(input.binding.writerFence,prepared.length+2);events.push('local-relay');return {};},
  createHostRelayPort(input){events.push('host-relay');return {};},
  async prepareNetwork(input){assert.equal(input.kind,'sdk');events.push('network');if(failNetwork)throw Error('network startup failed');
   return {proof:{},...closedPort('network'),async verify(){},async extendBashRoutes(){events.push('bash-routes');}};},
  createHostObserver(){return {async arm(){events.push('sdk-observer-arm');},...closedPort('observer')};},
  createSdkQuiescenceObserver(){return {async arm(){events.push('readiness-arm');},async waitQuiescent(){events.push('readiness-absent');},...closedPort('readiness-observer')};},
  createSdkQuiescenceReader(){return async()=>({quiescent:true});},
  createLauncher(input){assert.equal(input.sdkMode,'readiness');events.push('readiness-launcher');return closedPort('readiness-launcher');},
  async createConfinedReadinessPorts({makeLauncher}){makeLauncher({probeCommand:'/usr/bin/bwrap',probeNodePath:'/usr/bin/node'});return {async close(){}};},
  async prepareBash(input){await input.verifyOuterIsolation({});await input.createReadinessPorts({pathEnv:'/usr/bin'});
   return {allocation:a,hostIdentity:i,runtimeFacts:{bashSandbox:{available:true},bashEgress:{httpProxyPort:3020,socksProxyPort:3021}},...closedPort('bash')};},
  startLocalRelay(){throw Error('scripted relay does not launch');},
 };
 const native={sdk:{uid:2001,gid:2001},browser:{uid:2002,gid:2002},relay:{sdk:{uid:2003,gid:2003}},hostRelay:{sdk:{uid:2004,gid:2004}},
  helperPath:'/opt/meri/bin/native',hostRelayHelperPath:'/opt/meri/bin/host-relay',nodePath:'/usr/bin/node',shimPath:'/opt/meri/bin/meri-mcp-shim',
  verifyConfinement:async()=>{},validateReadinessDescriptor:x=>x};
 const shared={allocation:a,hostIdentity:i,cwd,paths:browserPaths(cwd),deadlineMs:a.leaseDeadlineMs,now:()=>now,native,
  network:{sdkRoutes:[],privateInterfaceName:'eth0'},identities:[native.sdk,native.browser,native.relay.sdk,native.hostRelay.sdk],components,
  physicalBinding:binding,browserDigest:digest,browserPolicy:policy,installation:installationFor(binding),controlEndpoint:{address:'10.0.1.11',port:443},
  browserHost:{ownerInstanceId:ownerId,async adopt(request,ports){assert.deepEqual(request.handoff,canonical);adoptions.push({request,ports});events.push('adopt');return {resumeSnapshot:{filtered:true}};}},
  async current(){events.push('physical-current');return {browserHandoff:canonical};},async readBrowserPolicy(){events.push('policy');return policy;},validateSdkDescriptor:x=>x,
  signal:owner.signal,register:resource=>resources.push(resource),revoke(){revokeCount++;owner.abort();},
  async settle(){closed=true;const results=await Promise.allSettled(resources.map(x=>x.close()));if(results.some(x=>x.status==='rejected'))throw Error('physical teardown unknown');return {status:'VERIFIED'};},
  isLogical:b=>canonicalSha256(logical)===canonicalSha256(b),setLogical:b=>{logical=b;},
  processes:{async waitForExit(request){assert.deepEqual(request.binding,binding);events.push('physical-process-read');return {exited:true};}},
  egress:{endpoint:'http://127.0.0.1:3128',async refresh(){events.push('physical-egress-refresh');},async revokePhysical(){events.push('physical-egress-revoke');return {revoked:true};}},
 };
 function request(source=binding,n=100){const b=target(source,n);canonical={custody:{schema:'meri-browser-custody/1',binding:source,controlId:uuid(n+3),ownerInstanceId:ownerId,hostId:a.hostId,generation:1,leaseEpoch:1,policySha256:digest,expiresAtMs:a.leaseDeadlineMs},
  returned:{ownerInstanceId:ownerId,leaseEpoch:2,snapshotSha256:'b'.repeat(64)},targetBinding:b,controlId:uuid(n+4)};
  return {binding:b,deadlineMs:a.leaseDeadlineMs,capabilityPolicy:{},control:{endpoint:shared.controlEndpoint,tls:{},maxFreshMs:5000,refreshEveryMs:1000},
   browser:{controls:{ownerInstanceId:ownerId,async bind(){}},hold:async()=>{},approvals:{async decide(){}},artifacts:{async ingest(){}},receipts:{async record(){}},sourceScopes},
   bash:{approvals:{async decide(){}},async verifyOuterIsolation(){return {allocation:a,hostIdentity:i};}}};}
 const adopt=run=>run.browserPort.sessions.adopt({binding:run.binding,policy,deadlineMs:a.leaseDeadlineMs,manifest:null,handoff:canonical});
 return {shared,request,adopt,prepare:successorPreparer(shared,sourceLauncher,()=>true),events,monitors,prepared,adoptions,resources,
  get canonical(){return canonical;},get revokeCount(){return revokeCount;},get launcherCount(){return launcherCount;},get clientCount(){return clientCount;},
  set failNetwork(v){failNetwork=v;},set closeUnknown(v){closeUnknown=v;},get closed(){return closed;}};
}

test('successor composes target SDK network once and adopts the original browser before SDK query',async()=>{
 const f=fixture(),q=f.request(),run=await f.prepare(q);
 assert.equal(f.launcherCount,1);assert.equal(f.clientCount,1);assert.deepEqual(f.prepared[0].binding,q.binding);
 assert.throws(()=>run.processClientFactory(),/HOST_BROWSER_ADOPTION_REFUSED/);
 await run.browserPort.egress.grant({binding:q.binding,policySha256:f.shared.browserDigest,expiresAtMs:q.deadlineMs});
 await f.adopt(run);assert.deepEqual(run.processClientFactory(),{nativeClient:true});assert.throws(()=>run.processClientFactory(),/HOST_SDK_QUERY_REUSED/);
 await assert.rejects(f.prepare(q),/HOST_BROWSER_ADOPTION_REFUSED/);
 assert.equal(run.browserHost,f.shared.browserHost);assert.equal(f.events.includes('physical-egress-refresh'),true);
 await run.settle();assert.equal(f.closed,true);assert.ok(f.events.includes('network-close'));
});

test('second handoff uses fresh authority and leaves the prior browser adapter stale',async()=>{
 const f=fixture(),q=f.request(),run=await f.prepare(q);await f.adopt(run);run.processClientFactory();
 const r=f.adoptions[0].ports.retirement;await r.prepare({});await r.wait({});await r.retain({});
 assert.equal(f.revokeCount,0);const q2=f.request(q.binding,200),next=await run.prepareSuccessor(q2);await f.adopt(next);next.processClientFactory();
 await assert.rejects(run.browserPort.egress.revoke({binding:q.binding,policySha256:f.shared.browserDigest}),/BROWSER_CUSTODY_REFUSED/);
 await assert.rejects(run.browserPort.processes.waitForExit({binding:q.binding,profile:f.shared.paths.profile}),/BROWSER_CUSTODY_REFUSED/);
 assert.equal(f.events.includes('physical-egress-revoke'),false);assert.equal(f.launcherCount,2);
 await next.settle();
});

test('request cancellation before APPLIED retention destroys even an already retired target',async()=>{
 const f=fixture(),q=f.request(),request=new AbortController();q.signal=request.signal;
 const run=await f.prepare(q);await f.adopt(run);const r=f.adoptions[0].ports.retirement;await r.prepare({});await r.wait({});
 request.abort();assert.equal(f.revokeCount,1);await run.settle();
});

test('APPLIED retention detaches old request cancellation but preserves physical host revocation',async()=>{
 const f=fixture(),q=f.request(),request=new AbortController();q.signal=request.signal;
 const run=await f.prepare(q);await f.adopt(run);const r=f.adoptions[0].ports.retirement;await r.prepare({});await r.wait({});await r.retain({});
 request.abort();assert.equal(f.revokeCount,0);await run.settle();assert.equal(f.closed,true);
});

test('target monitor loss revokes the physical host and prohibits SDK launch',async()=>{
 const f=fixture(),run=await f.prepare(f.request());await f.adopt(run);f.monitors[0].ac.abort();
 assert.ok(f.revokeCount>0);assert.throws(()=>run.processClientFactory(),/HOST_BOOTSTRAP_REVOKED/);await run.settle();
});

test('partial network startup and cleanup uncertainty surface distinct failures',async()=>{
 const f=fixture();f.failNetwork=true;await assert.rejects(f.prepare(f.request()),/network startup failed/);assert.equal(f.closed,true);assert.equal(f.launcherCount,0);
 const g=fixture(),q=g.request();g.shared.components.createHostObserver=()=>{throw Error('observer startup failed');};g.closeUnknown=true;
 await assert.rejects(g.prepare(q),error=>error.code==='HOST_BOOTSTRAP_UNKNOWN'&&error.cause.errors.length===2);assert.equal(g.closed,true);
});

test('offline and networked Bash use fresh confined readiness and target policy',async()=>{
 for(const domains of [[],['records.example']]){
  const f=fixture(),q=f.request();q.capabilityPolicy={bash:true,sandboxNetworkDomains:domains};
  const run=await f.prepare(q);assert.equal(run.bashRuntimeFacts.bashSandbox.available,true);assert.equal(f.clientCount,2);
  assert.equal(f.events.includes('readiness-launcher'),true);assert.equal(f.events.includes('bash-routes'),domains.length>0);
  await run.settle();
 }
});

test('foreign target or widened physical retention never starts a network',async()=>{
 const f=fixture(),q=f.request();q.deadlineMs++;
 await assert.rejects(f.prepare(q),/HOST_BOOTSTRAP_CONFIGURATION/);assert.equal(f.events.includes('network'),false);
 const g=fixture(),other=g.request();other.binding={...other.binding,actorId:'foreign'};
 await assert.rejects(g.prepare(other),/BROWSER_CUSTODY_REFUSED/);assert.equal(g.events.includes('network'),false);
});

test('revocation closes a late network handle and reports pending cleanup as unknown',async()=>{
 const f=fixture(),entered=Promise.withResolvers(),release=Promise.withResolvers();let lateClosed=0;
 f.shared.components.prepareNetwork=async()=>{entered.resolve();await release.promise;return {async close(){lateClosed++;return {closed:true};}};};
 const preparing=f.prepare(f.request());preparing.catch(()=>{});await entered.promise;f.shared.revoke();
 await assert.rejects(f.shared.settle(),/physical teardown unknown/);release.resolve();
 await assert.rejects(preparing,error=>error.code==='HOST_BOOTSTRAP_UNKNOWN');assert.equal(lateClosed,1);assert.equal(f.launcherCount,0);
});
