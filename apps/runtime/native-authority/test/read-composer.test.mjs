/** Control read composer over real installation, credential, gateway, action-session and relay owners; synthetic secret files
 * and Core HTTP only. Pins RC1 option A (the bearer is the run's own live action-session token, resolved per call through the
 * relay) and the Core #83 invariant: no read route ever receives the marked control credential or another candidate credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createReadCredentialRelay} from '../../read-credential-relay.mjs';
import {createNativeReadsClient} from '../reads-client.mjs';
import {createNativeReadCredentialBroker,createControlReadsComposer,selectedClientOf,READ_GATEWAY_INPUTS} from '../reads-composer.mjs';
import {installationFixture} from '../general-read-installation/test/fixture.mjs';
import {nativeFamilyCase} from '../../../gateway/general-reads/test/native-family-cases.mjs';
import {familyCase} from '../../../gateway/general-reads/test/family-cases.mjs';
import {endpoints as mailEndpoints} from '../../../gateway/sources/mail/test/fixtures.mjs';
import {NATIVE_READ_FAMILIES} from '../../../gateway/sources/retained-reads/native-families.mjs';
import {installationReadOperations} from '../general-read-installation/runtime.mjs';
import {origin as coreOrigin} from '../native-read-credentials/test/fixture.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {measureGeneralReadInstallation} from '../../../gateway/general-reads/installation-issuer.mjs';

const CONTROL='MARKED_CONTROL_SYNTHETIC',CANDIDATE={identity:'/run/meri/identity',task:'/run/meri/task-capability',control:'/run/meri/control-capability',proxy:'/run/meri/proxy-capability'};
const READ={serviceSecret:'/run/meri/core-tool-service-secret',readModeServiceSecret:'/run/meri/core-read-mode-service-secret'};
const code=expected=>error=>error.message===expected;
function secretFixture(){
 const files=new Map([[CANDIDATE.identity,CONTROL],[CANDIDATE.task,'TASK_CAPABILITY_SYNTHETIC'],[CANDIDATE.control,'CONTROL_CAPABILITY_SYNTHETIC'],[CANDIDATE.proxy,'PROXY_CAPABILITY_SYNTHETIC'],
  [READ.serviceSecret,'SYNTHETIC_SERVICE'],[READ.readModeServiceSecret,'SYNTHETIC_SERVICE']]);
 const hooks={onRead:null},readSecret=async path=>{await hooks.onRead?.(path);if(!files.has(path))throw Error('PRIVATE missing');return Buffer.from(files.get(path)+'\n');};
 const configuration={nativeCandidate:{identity:{origin:coreOrigin,credentialFile:CANDIDATE.identity},taskCapabilityFile:CANDIDATE.task,controlCapabilityFile:CANDIDATE.control,proxyCredentialFile:CANDIDATE.proxy}};
 return {files,hooks,readSecret,configuration};
}
/** The real action-session owner behind the real relay. `issue(token, binding?, client?)` opens a live session for that run. */
function sessionFixture({binding,scopes,now,ttlMs=60000}){
 let clock=now();const selected=selectedClientOf(scopes),context={binding,selectedClientId:selected};
 const verifyIdentity=async()=>({principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'identity',checkedAtMs:clock,expiresAtMs:clock+ttlMs});
 const resolveContext=async({identity})=>({identitySha256:canonicalSha256(identity),binding:context.binding,scopes:[{...scopes[0],resourceId:context.selectedClientId}],selectedClientId:context.selectedClientId,contextRevision:'revision',checkedAtMs:clock,expiresAtMs:clock+ttlMs});
 const owner=createActionSessionOwner({mode:'process-local',verifyIdentity,resolveContext,now:()=>clock,limits:{maxSessions:8,maxRequestMs:1000,maxTtlMs:300000,maxFactBytes:65536}});
 const relay=createReadCredentialRelay(),issue=async(token,overrides={})=>{Object.assign(context,{binding,selectedClientId:selected},overrides);return owner.issue({identityCredential:token});};
 return {owner,relay,issue,selected,advance:ms=>{clock+=ms;},close:()=>{relay.close();owner.close();}};
}

test('broker serves the service secrets from their own files; there is no bearer file',async()=>{
 const s=secretFixture(),broker=await createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret});
 assert.equal(broker.available,false,'no relay port');assert.deepEqual([...broker.configured],['serviceSecret','readModeServiceSecret']);
 assert.equal(await broker.getServiceSecret({}),'SYNTHETIC_SERVICE');assert.equal(await broker.getReadModeServiceSecret({}),'SYNTHETIC_SERVICE');
 await assert.rejects(createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:{...READ,nativeReadCredential:'/run/meri/native-read-credential'},readSecret:s.readSecret}),code('CONFIGURATION'));
});

for(const [label,candidate] of Object.entries(CANDIDATE))for(const key of Object.keys(READ)){
 test(`startup refuses ${key} at the ${label} credential path`,async()=>{
  const s=secretFixture();await assert.rejects(createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:{...READ,[key]:candidate},readSecret:s.readSecret}),code('CONFIGURATION'));
 });
 test(`startup refuses ${key} holding the ${label} credential bytes`,async()=>{
  const s=secretFixture();s.files.set(READ[key],s.files.get(candidate));
  await assert.rejects(createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret}),code('CONFIGURATION'));
 });
}

test('a service secret file that later holds the control credential fails closed per call',async()=>{
 const s=secretFixture(),broker=await createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret});
 for(const [key,name] of [['serviceSecret','getServiceSecret'],['readModeServiceSecret','getReadModeServiceSecret']]){
  const before=s.files.get(READ[key]);s.files.set(READ[key],CONTROL);await assert.rejects(broker[name]({}),code('UNAVAILABLE'));
  s.files.delete(READ[key]);await assert.rejects(broker[name]({}),code('UNAVAILABLE'));s.files.set(READ[key],before);
 }
});

test('the selected client is the single client scope; any other scope shape has none',()=>{
 const client={tenantId:'t',kind:'client',resourceId:'a1234567-b123-4c12-8d12-e123456789ab',policyRevision:'p'};
 assert.equal(selectedClientOf([client]),client.resourceId);
 for(const scopes of [[],[{...client,kind:'tenant'}],[client,{...client,resourceId:'b1234567-b123-4c12-8d12-e123456789ab'}],[client,{...client,kind:'tenant'}],null,'x'])assert.equal(selectedClientOf(scopes),null);
});

async function relayBroker(){
 const s=secretFixture(),binding={tenantId:'tenant',actorId:'actor',conversationId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222',attemptId:'33333333-3333-4333-8333-333333333333',workerId:'44444444-4444-4444-8444-444444444444',writerFence:1};
 const scopes=[{tenantId:'tenant',kind:'client',resourceId:'a1234567-b123-4c12-8d12-e123456789ab',policyRevision:'p'}],now=()=>1800000000000;
 const session=sessionFixture({binding,scopes,now}),calls=[],port={nativeCredentialFor(input){calls.push(input);return session.relay.port.nativeCredentialFor(input);}};
 const broker=await createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret,nativeCredentials:port,now});
 return {s,binding,scopes,session,calls,broker,bearer:broker.bearerFor({binding,scopes})};
}

test('bearer resolves per call from the bound relay for exactly the run binding and selected client',async()=>{
 const x=await relayBroker();
 try{
  assert.equal(x.broker.available,true);await assert.rejects(x.bearer({binding:x.binding}),code('UNAVAILABLE'),'unbound relay');
  x.session.relay.bind(x.session.owner);await assert.rejects(x.bearer({binding:x.binding}),code('UNAVAILABLE'),'no live session');
  const issued=await x.session.issue('SYNTHETIC_NATIVE');assert.deepEqual(await x.bearer({binding:x.binding}),{credential:'SYNTHETIC_NATIVE',expiresAtMs:issued.expiresAtMs});
  assert.deepEqual(x.calls.at(-1),{binding:x.binding,selectedClientId:x.session.selected});
  x.session.advance(1000);await x.session.issue('SYNTHETIC_NATIVE_NEWER');assert.equal((await x.bearer({binding:x.binding})).credential,'SYNTHETIC_NATIVE_NEWER','never cached');
 }finally{x.session.close();}
});

test('a session for another run or client, or a caller binding drift, refuses',async()=>{
 const x=await relayBroker();x.session.relay.bind(x.session.owner);
 try{
  await x.session.issue('SYNTHETIC_OTHER_RUN',{binding:{...x.binding,runId:'55555555-5555-4555-8555-555555555555'}});
  await x.session.issue('SYNTHETIC_OTHER_CLIENT',{selectedClientId:'b1234567-b123-4c12-8d12-e123456789ab'});
  await assert.rejects(x.bearer({binding:x.binding}),code('UNAVAILABLE'));
  const before=x.calls.length;await assert.rejects(x.bearer({binding:{...x.binding,writerFence:2}}),code('UNAVAILABLE'));assert.equal(x.calls.length,before,'drift refuses before the relay');
  for(const scopes of [[],[{...x.scopes[0],kind:'tenant'}],[x.scopes[0],x.scopes[0]]])await assert.rejects(x.broker.bearerFor({binding:x.binding,scopes})({binding:x.binding}),code('UNAVAILABLE'));
 }finally{x.session.close();}
});

test('expiry, revocation or close of the live session refuses the next call',async()=>{
 const x=await relayBroker();x.session.relay.bind(x.session.owner);
 try{
  const receipt=await x.session.issue('SYNTHETIC_NATIVE');assert.equal((await x.bearer({binding:x.binding})).credential,'SYNTHETIC_NATIVE');
  x.session.advance(60001);await assert.rejects(x.bearer({binding:x.binding}),code('UNAVAILABLE'),'expired');
  const again=await x.session.issue('SYNTHETIC_NATIVE');x.session.owner.revoke(again.credential);await assert.rejects(x.bearer({binding:x.binding}),code('UNAVAILABLE'),'revoked');
  await x.session.issue('SYNTHETIC_NATIVE');x.session.relay.close();await assert.rejects(x.bearer({binding:x.binding}),code('UNAVAILABLE'),'relay closed');
  void receipt;
 }finally{x.session.close();}
});

test('expiry, revocation or replacement during the service-file read refuses before return',async()=>{
 for(const change of ['expire','revoke','replace']){
  const x=await relayBroker();x.session.relay.bind(x.session.owner);
  try{
   const receipt=await x.session.issue('SYNTHETIC_NATIVE');let fired=false;
   x.s.hooks.onRead=async path=>{if(fired||path!==READ.serviceSecret)return;fired=true;
    if(change==='expire')x.session.advance(60001);else if(change==='revoke')x.session.owner.revoke(receipt.credential);else{x.session.advance(1000);await x.session.issue('SYNTHETIC_NATIVE_REPLACED');}};
   await assert.rejects(x.bearer({binding:x.binding}),code('UNAVAILABLE'),change);assert.equal(fired,true);
  }finally{x.session.close();}
 }
});

test('a live session whose token is a candidate credential or the service secret is never relayed',async()=>{
 const x=await relayBroker();x.session.relay.bind(x.session.owner);
 try{
  for(const token of [CONTROL,'TASK_CAPABILITY_SYNTHETIC','CONTROL_CAPABILITY_SYNTHETIC','PROXY_CAPABILITY_SYNTHETIC','SYNTHETIC_SERVICE']){
   await x.session.issue(token);await assert.rejects(x.bearer({binding:x.binding}),code('UNAVAILABLE'),token);
  }
 }finally{x.session.close();}
});

async function composed({bind=true,secretFiles=READ,gateway,nativeCredentials=true,ttlMs,hangTools=false,producers}={}){
 const f=await installationFixture({scene:nativeFamilyCase('tracked-bills','search_tracked_bills')}),s=secretFixture(),outbound=[];
 const session=sessionFixture({binding:f.binding,scopes:f.scopes,now:f.now,...(ttlMs===undefined?{}:{ttlMs})});if(bind)session.relay.bind(session.owner);
 const inflight=[];
 // One Core origin: authority routes reach the fake Core, tool routes the tracked-bills source. Every request is recorded.
 const fetchImpl=async(url,init)=>{outbound.push({path:new URL(url).pathname,headers:{...init.headers}});
  if(new URL(url).pathname.startsWith('/api/clio/application-authority/'))return f.core.fetchImpl(url,init);
  if(!hangTools)return f.transport.fetchImpl(url,init);
  // An in-flight source request that only ends when its transport aborts it.
  const entry={startedAt:Date.now(),abortedAt:null};inflight.push(entry);
  return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>{entry.abortedAt=Date.now();reject(init.signal.reason??Error('aborted'));},{once:true}));};
 const ports=gateway??{authority:f.gatewayConfiguration.authority,limits:f.gatewayConfiguration.limits,discoveryOwner:f.gatewayConfiguration.discoveryOwner,
  readCurrentInstallation:proof=>f.installationOwner.readCurrent({signal:proof.signal})};
 const extra=producers?await producers(f):{};
 const composer=await createControlReadsComposer({configuration:s.configuration,secretFiles,readSecret:s.readSecret,now:f.now,fetchImpl,gateway:extra.gateway??ports,...(extra.installation?{installation:extra.installation}:{}),...(extra.discovery?{discovery:extra.discovery}:{}),
  ...(nativeCredentials?{nativeCredentials:session.relay.port}:{}),familyIds:[f.family]});
 const mounted=f.prepared({createReadsRuntime:inner=>composer.createReadsRuntime({...f.tuple,...inner})});
 const client=createNativeReadsClient({origin:'https://native.synthetic.invalid',credential:f.tuple.taskCapability,binding:f.binding,approvedReads:f.tuple.approvedReads,fetchImpl:(url,init)=>mounted.application.handle(new Request(url,init)),now:f.now});
 let n=0;const execute=()=>client.execute({operation:f.operation,arguments:f.request,deliveryId:`composer:relay:${++n}`});
 return {f,s,outbound,inflight,session,composer,client,execute,close:()=>{session.close();f.scope.abort();}};
}
const carries=(request,secret)=>Object.values(request.headers).some(value=>String(value).includes(secret));
const noCandidate=x=>{for(const request of x.outbound)for(const candidate of Object.values(CANDIDATE))assert.equal(carries(request,x.s.files.get(candidate)),false,`${request.path} carries ${candidate}`);};

test('composed native read sends the live session bearer and service secret; no request carries a candidate credential',async()=>{
 const x=await composed();
 try{
  assert.deepEqual(x.composer.missing,[]);assert.deepEqual(x.composer.familyIds,[x.f.family]);await x.session.issue('SYNTHETIC_NATIVE');
  const raw=await x.execute();assert.deepEqual(JSON.parse(raw).binding,x.f.binding);
  assert.equal(x.f.wire.length,1);assert.equal(x.f.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');assert.equal(x.f.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
  assert.ok(x.outbound.some(r=>r.path==='/api/clio/application-authority/identity'));assert.ok(x.outbound.some(r=>r.path.startsWith('/api/clio/tools/')));noCandidate(x);
  for(const request of x.outbound.filter(r=>/^\/api\/clio\/application-authority\/(identity|context|membership)$/u.test(r.path)))assert.equal(request.headers['x-internal-service-secret'],undefined,request.path);
 }finally{x.close();}
});

test('unbound relay or no live session for the run refuses before Core',async()=>{
 for(const [bind,issue] of [[false,true],[true,false]]){
  const x=await composed({bind});
  try{if(issue)await x.session.issue('SYNTHETIC_NATIVE');await assert.rejects(x.execute());assert.equal(x.outbound.length,0);assert.equal(x.f.wire.length,0);assert.equal(x.f.state.reservations.size,0);}
  finally{x.close();}
 }
});

test('a live session for another run or another client refuses before Core',async()=>{
 for(const override of [{binding:'other-run'},{selectedClientId:'b1234567-b123-4c12-8d12-e123456789ab'}]){
  const x=await composed();
  try{
   await x.session.issue('SYNTHETIC_NATIVE',override.binding?{binding:{...x.f.binding,runId:'55555555-5555-4555-8555-555555555555'}}:override);
   await assert.rejects(x.execute());assert.equal(x.outbound.length,0);assert.equal(x.f.wire.length,0);
  }finally{x.close();}
 }
});

test('session expiry mid-run refuses the next read before Core',async()=>{
 const x=await composed();
 try{
  await x.session.issue('SYNTHETIC_NATIVE');await x.execute();const sent=x.outbound.length,wire=x.f.wire.length;
  x.session.advance(60001);await assert.rejects(x.execute());assert.equal(x.outbound.length,sent);assert.equal(x.f.wire.length,wire);noCandidate(x);
 }finally{x.close();}
});

test('an in-flight source read is aborted at the live session expiry, not the task or gateway deadline',async()=>{
 // The fixture clock is fixed, so each lifetime's timer is its deadline minus that clock: here 800 ms of real time.
 const x=await composed({ttlMs:800,hangTools:true});
 try{
  const issued=await x.session.issue('SYNTHETIC_NATIVE');assert.equal(issued.expiresAtMs,x.f.now()+800);
  await assert.rejects(x.execute());assert.equal(x.inflight.length,1,'the source request was dispatched');
  const [entry]=x.inflight;assert.notEqual(entry.abortedAt,null,'the transport aborted it');
  const held=entry.abortedAt-entry.startedAt;assert.ok(held>=500&&held<2200,`aborted after ${held} ms; the gateway call deadline is 3000 ms`);
  assert.ok(x.f.deadlineMs-x.f.now()>=5000,'task authority outlives the session');noCandidate(x);
 }finally{x.close();}
});

test('a live session holding the control credential is refused before Core and never sent',async()=>{
 const x=await composed();
 try{await x.session.issue(CONTROL);await assert.rejects(x.execute());assert.equal(x.outbound.length,0);assert.equal(x.f.wire.length,0);noCandidate(x);}
 finally{x.close();}
});

test('missing relay port or service secret composes the unavailable runtime and reports only key names',async()=>{
 for(const [options,expected] of [[{nativeCredentials:false},['nativeCredentials.nativeCredentialFor']],[{secretFiles:{readModeServiceSecret:READ.readModeServiceSecret}},['secretFiles.serviceSecret']]]){
  const x=await composed(options);
  try{
   assert.deepEqual(x.composer.missing,expected);await x.session.issue('SYNTHETIC_NATIVE');
   await assert.rejects(x.client.readAvailability());await assert.rejects(x.execute());assert.equal(x.outbound.length,0);assert.equal(x.f.wire.length,0);
   assert.equal(JSON.stringify(x.composer.missing).includes('SYNTHETIC'),false);
  }finally{x.close();}
 }
});

test('a composed read runs through the real P2 installation issuer and P1 discovery producer (no fixture ports)',async()=>{
 const policyCalls=[];
 const x=await composed({producers:async f=>{
  const {measurement,measurementSha256}=await measureGeneralReadInstallation({catalogJson:JSON.stringify(catalog),operations:[{operation:f.operation,family:f.family}]});
  return {gateway:{authority:f.gatewayConfiguration.authority,limits:f.gatewayConfiguration.limits},installation:{enabled:true,measurement,measurementSha256},
   discovery:{enabled:true,capabilityPolicy:{async forRun(input){policyCalls.push(input);return {generalReads:true,readFamilies:[f.family]};}}}};
 }});
 try{
  assert.deepEqual(x.composer.missing,[]);await x.session.issue('SYNTHETIC_NATIVE');
  const availability=await x.client.readAvailability();assert.deepEqual(availability.installation.operations,[x.f.operation]);assert.deepEqual(availability.discovery.operations,[x.f.operation]);
  const raw=await x.execute();assert.deepEqual(JSON.parse(raw).binding,x.f.binding);assert.equal(x.f.wire.length,1);assert.ok(policyCalls.length>0);noCandidate(x);
 }finally{x.close();}
});

test('the full P2 measurement needs all 21 retained handlers; task-bound ports compose the exact 76',async()=>{
 const f=await installationFixture({scene:nativeFamilyCase('tracked-bills','search_tracked_bills')}),s=secretFixture(),rows=installationReadOperations();
 assert.equal(rows.length,76);const families=[...new Set(rows.map(row=>row.family))],retained=families.filter(id=>!NATIVE_READ_FAMILIES.includes(id));
 assert.equal(families.length,42);assert.equal(retained.length,15);assert.equal(rows.filter(row=>retained.includes(row.family)).length,21);
 const {measurement,measurementSha256}=await measureGeneralReadInstallation({catalogJson:JSON.stringify(catalog),operations:rows});
 const sourcePorts=Object.fromEntries(retained.map(family=>{
  if(family==='mail')return [family,{endpoints:mailEndpoints,getCredentials:async()=>{throw Error('UNREACHABLE_MAIL_CREDENTIAL');},fetchImpl:async()=>{throw Error('UNREACHABLE_MAIL_SOURCE');}}];
  const operation=rows.find(row=>row.family===family).operation.id;
  return [family,familyCase(family,operation).transport];
 }));
 const base={configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret,now:f.now,
  nativeCredentials:{nativeCredentialFor(){throw Error('UNREACHABLE_NATIVE_CREDENTIAL');}},
  gateway:{authority:f.gatewayConfiguration.authority,limits:f.gatewayConfiguration.limits,discoveryOwner:f.gatewayConfiguration.discoveryOwner},
  installation:{enabled:true,measurement,measurementSha256}};
 const narrowed=await createControlReadsComposer({...base,familyIds:[f.family]});
 assert.equal(narrowed.missing.filter(name=>name.startsWith('familyIds.')).length,41,'a 55-handler override cannot silently accept the 76-row receipt');
 const absent=await createControlReadsComposer(base);
 assert.deepEqual(absent.missing,retained.map(id=>`retainedTaskPorts.${id}`));
 await assert.rejects(absent.createReadsRuntime(f.tuple).readAvailability(),code('UNAVAILABLE'));
 let retainedPorts;
 const composer=await createControlReadsComposer({...base,retainedTaskPorts(ports){retainedPorts=ports;return {families:sourcePorts,contextPorts:{
  mailContextPorts:{async loadPrevious(){throw Error('UNREACHABLE_MAIL_CONTEXT');},async retain(){throw Error('UNREACHABLE_MAIL_CONTEXT');}},
  memoryContextPorts:f.gatewayConfiguration.memoryContextPorts,
  retainedContextPorts:{async readCurrent(){throw Error('UNREACHABLE_RETAINED_CONTEXT');}}
 }};}});
 assert.deepEqual(composer.missing,[]);assert.deepEqual(composer.familyIds,families);
 const available=await composer.createReadsRuntime(f.tuple).readAvailability();
 assert.equal(typeof retainedPorts.getNativeCredentialWithExpiry,'function');
 assert.equal(typeof retainedPorts.getSignedSourceCredentials,'function');
 assert.deepEqual(available.installation.operations,[f.operation],'all 76 source hashes pass before run eligibility narrows to one');
 f.scope.abort();
});

test('the real P1/P2 producers stay disabled by default and keep the runtime unavailable',async()=>{
 const x=await composed({producers:async f=>({gateway:{authority:f.gatewayConfiguration.authority,limits:f.gatewayConfiguration.limits}})});
 try{assert.deepEqual(x.composer.missing,['installation.enabled','discovery.enabled']);await x.session.issue('SYNTHETIC_NATIVE');
  await assert.rejects(x.client.readAvailability());await assert.rejects(x.execute());assert.equal(x.outbound.length,0);assert.equal(x.f.wire.length,0);}
 finally{x.close();}
});

test('a P1 policy without the read family exposes and executes nothing',async()=>{
 const x=await composed({producers:async f=>{
  const {measurement,measurementSha256}=await measureGeneralReadInstallation({catalogJson:JSON.stringify(catalog),operations:[{operation:f.operation,family:f.family}]});
  return {gateway:{authority:f.gatewayConfiguration.authority,limits:f.gatewayConfiguration.limits},installation:{enabled:true,measurement,measurementSha256},
   discovery:{enabled:true,capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:['mail']};}}}};
 }});
 try{
  await x.session.issue('SYNTHETIC_NATIVE');const availability=await x.client.readAvailability();assert.deepEqual(availability.discovery.operations,[]);assert.deepEqual(availability.installation.operations,[]);
  await assert.rejects(x.execute());assert.equal(x.f.wire.length,0);
 }finally{x.close();}
});

for(const omit of READ_GATEWAY_INPUTS)test(`missing gateway.${omit} composes the unavailable runtime without credentials or source IO`,async()=>{
 const f0=await installationFixture({scene:nativeFamilyCase('tracked-bills','search_tracked_bills')}),ports={authority:f0.gatewayConfiguration.authority,limits:f0.gatewayConfiguration.limits,discoveryOwner:f0.gatewayConfiguration.discoveryOwner,readCurrentInstallation:()=>{throw Error('UNREACHABLE');}};
 f0.scope.abort();delete ports[omit];const x=await composed({gateway:ports});
 try{
  assert.deepEqual(x.composer.missing,[{readCurrentInstallation:"installation.enabled",discoveryOwner:"discovery.enabled"}[omit]??`gateway.${omit}`]);await x.session.issue('SYNTHETIC_NATIVE');
  await assert.rejects(x.client.readAvailability());await assert.rejects(x.execute());
  assert.equal(x.outbound.length,0);assert.equal(x.f.wire.length,0);
 }finally{x.close();}
});
