/** Option B through the real composer, installation, credential owner, durable dispatch, budget owner, action-session owner and
 * relay; Core is the synthetic delegation fixture over the scripted Meri owner state. Pins: delegated reads use single-use
 * per-route tokens and never the identity/membership routes; an attended delegation outlives its creating session; `tool` tokens
 * need Meri's own UNKNOWN reservation; release is withheld on change; Stop refuses locally even when revoke fails; option A is
 * the attended fallback only when delegation is unavailable; unattended runs read under an active consent with no session. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../../control/action-host/session/owner.mjs';
import {createReadCredentialRelay} from '../../../read-credential-relay.mjs';
import {createNativeReadsClient} from '../../reads-client.mjs';
import {createControlReadsComposer,selectedClientOf} from '../../reads-composer.mjs';
import {installationFixture} from '../../general-read-installation/test/fixture.mjs';
import {nativeFamilyCase} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {origin as coreOrigin} from '../../native-read-credentials/test/fixture.mjs';
import {allocation} from '../../../../gateway/budget/tool-budget-binding.mjs';
import {delegationCoreFixture} from './fixture.mjs';
import {OBSERVATION_CALLS,DISPATCH_OBSERVATIONS,CREDENTIAL_OBSERVATIONS,READ_TOKEN_CEILINGS,operationsDigest} from '../contract.mjs';

const CANDIDATE={identity:'/run/meri/identity',task:'/run/meri/task-capability',control:'/run/meri/control-capability',proxy:'/run/meri/proxy-capability'};
const READ={serviceSecret:'/run/meri/core-tool-service-secret',readModeServiceSecret:'/run/meri/core-read-mode-service-secret'};
const DELEGATION_ROUTE=/^\/api\/clio\/application-authority\/read-delegation/u,IDENTITY=/^\/api\/clio\/application-authority\/(identity|context|membership)$/u;
function secrets(){
 const files=new Map([[CANDIDATE.identity,'MARKED_CONTROL_SYNTHETIC'],[CANDIDATE.task,'TASK_CAPABILITY_SYNTHETIC'],[CANDIDATE.control,'CONTROL_CAPABILITY_SYNTHETIC'],[CANDIDATE.proxy,'PROXY_CAPABILITY_SYNTHETIC'],
  [READ.serviceSecret,'SYNTHETIC_SERVICE'],[READ.readModeServiceSecret,'SYNTHETIC_SERVICE']]);
 return {files,readSecret:async path=>{if(!files.has(path))throw Error('missing');return Buffer.from(files.get(path)+'\n');},
  configuration:{nativeCandidate:{identity:{origin:coreOrigin,credentialFile:CANDIDATE.identity},taskCapabilityFile:CANDIDATE.task,controlCapabilityFile:CANDIDATE.control,proxyCredentialFile:CANDIDATE.proxy}}};
}
/** The real action-session owner behind the real relay, with its own clock (advancing it ends the session, not the run). */
function sessions({binding,scopes,now,ttlMs=60000}){
 let clock=now();const selected=selectedClientOf(scopes);
 const owner=createActionSessionOwner({mode:'process-local',now:()=>clock,limits:{maxSessions:8,maxRequestMs:1000,maxTtlMs:300000,maxFactBytes:65536},
  verifyIdentity:async()=>({principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'identity',checkedAtMs:clock,expiresAtMs:clock+ttlMs}),
  resolveContext:async({identity})=>({identitySha256:canonicalSha256(identity),binding,scopes,selectedClientId:selected,contextRevision:'revision',checkedAtMs:clock,expiresAtMs:clock+ttlMs})});
 const relay=createReadCredentialRelay();relay.bind(owner);
 return {owner,relay,issue:token=>owner.issue({identityCredential:token}),advance:ms=>{clock+=ms;},close:()=>{relay.close();owner.close();}};
}

async function composed({unattended=false,consent='active',delegation=true,hangTools=false}={}){
 const inflight=[];
 // An in-flight source request that ends only when its transport aborts it.
 const hanging=(url,init)=>{const entry={startedAt:Date.now(),abortedAt:null};inflight.push(entry);
  return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>{entry.abortedAt=Date.now();reject(init.signal.reason??Error('aborted'));},{once:true}));};
 const f=await installationFixture({scene:nativeFamilyCase('tracked-bills','search_tracked_bills')}),s=secrets(),clientId=f.scopes[0].resourceId;
 const session=sessions({binding:f.binding,scopes:f.scopes,now:f.now}),live=new Set();
 const core=delegationCoreFixture({now:f.now,binding:f.binding,clientId,runDeadlineMs:f.deadlineMs,principal:f.core.principal,reservations:f.state.reservations,liveBearers:live,
  authority:f.core.fetchImpl,tools:hangTools?hanging:f.transport.fetchImpl});
 const a=allocation(f.allocationJson),occurrences=[];
 if(unattended)core.state.consent={id:'c1234567-b123-4c12-8d12-e123456789ab',state:consent,expiresAtMs:f.now()+86400000};
 const readOccurrence=async({binding})=>{occurrences.push(binding);if(!unattended)return null;
  return {consentId:core.state.consent.id,consentState:consent,consentExpiresAtMs:core.state.consent.expiresAtMs,consentCreatedAtMs:f.now()-1000,scheduleId:'d1234567-b123-4c12-8d12-e123456789ab',
   occurrenceKey:'e'.repeat(64),startedAtMs:f.now(),clientId,operationsDigest:operationsDigest(a.manifest.allowedOperations),policyRevision:f.policyRevision,runBinding:f.binding};};
 const composer=await createControlReadsComposer({configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret,now:f.now,fetchImpl:core.fetchImpl,
  gateway:{authority:f.gatewayConfiguration.authority,limits:f.gatewayConfiguration.limits,discoveryOwner:f.gatewayConfiguration.discoveryOwner,readCurrentInstallation:proof=>f.installationOwner.readCurrent({signal:proof.signal})},
  ...(unattended?{}:{nativeCredentials:session.relay.port}),familyIds:[f.family],...(delegation?{delegation:{enabled:true,readOccurrence}}:{})});
 let n=0;
 /** A new task of the same run: fresh reads runtime, task ports and credential owner over the same composer. */
 const mount=()=>{const mounted=f.prepared({createReadsRuntime:inner=>composer.createReadsRuntime({...f.tuple,...inner})});
  const client=createNativeReadsClient({origin:'https://native.synthetic.invalid',credential:f.tuple.taskCapability,binding:f.binding,approvedReads:f.tuple.approvedReads,fetchImpl:(url,init)=>mounted.application.handle(new Request(url,init)),now:f.now});
  return ()=>client.execute({operation:f.operation,arguments:f.request,deliveryId:`delegation:${++n}`});};
 const execute=mount();
 const login=async token=>{live.add(token);return session.issue(token);};
 const calls=pattern=>core.state.calls.filter(call=>pattern.test(call.path));
 return {f,core,session,composer,execute,mount,login,calls,occurrences,clientId,inflight,close:()=>{session.close();f.scope.abort();}};
}

test('an attended delegated read uses single-use per-route tokens and never the identity, context or membership routes',async()=>{
 const x=await composed();
 try{
  assert.deepEqual(x.composer.missing,[]);assert.equal(x.composer.readDelegation.enabled,true);await x.login('SYNTHETIC_NATIVE');
  const raw=await x.execute();assert.deepEqual(JSON.parse(raw).binding,x.f.binding);
  const created=x.calls(/\/read-delegations$/u);assert.equal(created.length,1);assert.equal(created[0].headers.authorization,'Bearer SYNTHETIC_NATIVE','created from the live session');
  assert.equal(x.calls(IDENTITY).length,0,'no identity/context/membership call');
  assert.equal(x.f.wire.length,1);assert.match(x.f.wire[0].options.headers.authorization,/^CapiroMeriRead synthetic-read-token-/u);assert.equal(x.f.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
  // The live bearer appears only on create; every other call carries a token or the service identity alone.
  for(const call of x.core.state.calls.filter(call=>!/\/read-delegations$/u.test(call.path)))assert.notEqual(call.headers.authorization,'Bearer SYNTHETIC_NATIVE',call.path);
  const tokens=[...x.core.state.tokens.values()];assert.ok(tokens.every(t=>t.consumed),'every issued token was used exactly once');
  // One call slot keyed by the durable invocation id; its token use is the derived ceiling's own arithmetic.
  const [[slotKey,slot]]=[...x.core.state.slots];assert.match(slotKey.split('|')[1],/^owned_/u);
  assert.deepEqual(slot.counts,{current:(DISPATCH_OBSERVATIONS+CREDENTIAL_OBSERVATIONS)*OBSERVATION_CALLS.plain.current,tool:1,mode:0,reference:0});
  for(const [kind,count] of Object.entries(slot.counts))assert.ok(count<=READ_TOKEN_CEILINGS[kind],kind);
 }finally{x.close();}
});

test('the attended delegation outlives the session that created it; there is no second create while it is current',async()=>{
 const x=await composed();
 try{
  await x.login('SYNTHETIC_NATIVE');await x.execute();
  x.session.advance(60001);// The live session has ended; option A alone would now refuse.
  const raw=await x.execute();assert.deepEqual(JSON.parse(raw).binding,x.f.binding);
  assert.equal(x.calls(/\/read-delegations$/u).length,1);assert.equal(x.f.wire.length,2);
 }finally{x.close();}
});

test('no live session at the first read: no delegation is created and nothing reaches Core',async()=>{
 const x=await composed();
 try{await assert.rejects(x.execute());assert.equal(x.calls(DELEGATION_ROUTE).length,0);assert.equal(x.f.wire.length,0);assert.equal(x.f.state.reservations.size,0);}
 finally{x.close();}
});

test('a tool token is issued only against the call\'s UNKNOWN reservation; without it nothing reaches the source',async()=>{
 const x=await composed();
 try{
  await x.login('SYNTHETIC_NATIVE');x.core.state.rejectTool=true;
  await assert.rejects(x.execute());assert.equal(x.f.wire.length,0);
  const [reservation]=[...x.f.state.reservations.values()];assert.equal(reservation.state,'UNKNOWN','reserved before the token was asked for');
 }finally{x.close();}
});

test('a change at release withholds the source result',async()=>{
 const x=await composed();
 try{await x.login('SYNTHETIC_NATIVE');x.core.state.withholdAtRelease=true;await assert.rejects(x.execute());assert.equal(x.f.wire.length,1,'the source answered');}
 finally{x.close();}
});

test('Stop refuses locally first, even when Core revoke fails, and a later task of the same run cannot re-create the delegation',async()=>{
 const x=await composed();
 try{
  await x.login('SYNTHETIC_NATIVE');await x.execute();x.core.state.failRevokes=3;
  const stopped=await x.composer.readDelegation.stopRun({binding:x.f.binding,reason:'cancelled'});assert.deepEqual(stopped,{stopped:true,revoked:false});
  assert.equal(x.calls(/\/revocations$/u).length,3,'bounded best-effort revoke');
  const before=x.core.state.calls.length;await assert.rejects(x.execute());
  // A new task of the same stopped run, while the user's session is still live, gets the stopped delegation, not a new one.
  await assert.rejects(x.mount()());
  assert.equal(x.core.state.calls.slice(before).filter(call=>DELEGATION_ROUTE.test(call.path)||call.scheme==='CapiroMeriRead').length,0,'refused before any delegated call');
  assert.equal(x.calls(/\/read-delegations$/u).length,1);assert.equal(x.f.wire.length,1);
 }finally{x.close();}
});

test('option A is the attended fallback only when Core delegation is unavailable, never when it refuses',async()=>{
 const unavailable=await composed();
 try{
  await unavailable.login('SYNTHETIC_NATIVE');unavailable.core.state.unavailable=true;
  await unavailable.execute();assert.equal(unavailable.f.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');assert.ok(unavailable.calls(IDENTITY).length>0);
 }finally{unavailable.close();}
 const refused=await composed();
 try{await refused.login('SYNTHETIC_NATIVE');refused.core.state.createStatus=403;await assert.rejects(refused.execute());assert.equal(refused.f.wire.length,0);assert.equal(refused.calls(IDENTITY).length,0);}
 finally{refused.close();}
});

test('an unattended occurrence reads under its active consent with no session and no bearer; a paused consent reads nothing',async()=>{
 const x=await composed({unattended:true});
 try{
  assert.deepEqual(x.composer.missing,[]);const raw=await x.execute();assert.deepEqual(JSON.parse(raw).binding,x.f.binding);
  const [create]=x.calls(/\/read-delegations$/u);assert.equal(create.headers.authorization,undefined,'no user bearer');
  const [d]=[...x.core.state.delegations.values()];assert.equal(d.mode,'unattended');assert.equal(d.request.occurrenceKey,'e'.repeat(64));
  assert.match(x.f.wire[0].options.headers.authorization,/^CapiroMeriRead /u);
 }finally{x.close();}
 const paused=await composed({unattended:true,consent:'paused'});
 try{await assert.rejects(paused.execute());assert.equal(paused.calls(DELEGATION_ROUTE).length,0);assert.equal(paused.f.wire.length,0);}
 finally{paused.close();}
});

test('delegation disabled keeps option A exactly',async()=>{
 const x=await composed({delegation:false});
 try{await x.login('SYNTHETIC_NATIVE');await x.execute();assert.equal(x.calls(DELEGATION_ROUTE).length,0);assert.equal(x.f.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');assert.equal(x.composer.readDelegation.enabled,false);}
 finally{x.close();}
});

test('Stop aborts the in-flight source request of the run itself, not only later issuance (dot 6248061000)',async()=>{
 const x=await composed({hangTools:true});
 try{
  await x.login('SYNTHETIC_NATIVE');const pending=x.execute();pending.catch(()=>{});
  for(let i=0;i<300&&!x.inflight.length;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(x.inflight.length,1,'the delegated tool request is in flight');
  const stoppedAt=Date.now();await x.composer.readDelegation.stopRun({binding:x.f.binding,reason:'cancelled'});
  await assert.rejects(pending);const [entry]=x.inflight;assert.notEqual(entry.abortedAt,null,'the transport aborted it');assert.ok(entry.abortedAt-stoppedAt<1000,'at Stop, not at a deadline');
 }finally{x.close();}
});

test('a lost token response is re-requested as retryOf the same canonical request and the read completes',async()=>{
 const x=await composed();
 try{
  await x.login('SYNTHETIC_NATIVE');x.core.state.dropTokenResponses=1;
  const raw=await x.execute();assert.deepEqual(JSON.parse(raw).binding,x.f.binding);
  const tokens=[...x.core.state.tokens.values()];assert.equal(tokens.filter(t=>t.superseded).length,1,'the unconsumed predecessor was superseded');
  const [[,slot]]=[...x.core.state.slots];assert.equal(Object.values(slot.reissues).reduce((a,b)=>a+b,0),1);
  assert.deepEqual(slot.counts,{current:(DISPATCH_OBSERVATIONS+CREDENTIAL_OBSERVATIONS)*OBSERVATION_CALLS.plain.current,tool:1,mode:0,reference:0},'a retry adds no count');
 }finally{x.close();}
});

test('lane RD: the composer offers the registry-facing stop hook (`runOptions`) only with delegation; it stops the run like stopRun and never throws',async()=>{
 const x=await composed();
 try{
  assert.deepEqual(Object.keys(x.composer.readDelegation).sort(),['consents','enabled','runOptions','stopRun']);
  await x.login('SYNTHETIC_NATIVE');await x.execute();
  assert.deepEqual(await x.composer.readDelegation.runOptions.stopRun({binding:x.f.binding,reason:'fenced'}),{stopped:true,revoked:true});
  assert.equal(x.calls(/\/revocations$/u).length,1);await assert.rejects(x.execute(),'the stopped run reads nothing');
  // A second stop (retirement after the stop route) is answered without another revoke; an unknown run is not stopped.
  assert.deepEqual(await x.composer.readDelegation.runOptions.stopRun({binding:x.f.binding,reason:'run_terminal'}),{stopped:true,revoked:false});assert.equal(x.calls(/\/revocations$/u).length,1);
  assert.deepEqual(await x.composer.readDelegation.runOptions.stopRun({binding:{...x.f.binding,runId:'f1234567-b123-4c12-8d12-e123456789ab'},reason:'cancelled'}),{stopped:false,revoked:false});
 }finally{x.close();}
 const off=await composed({delegation:false});
 try{assert.deepEqual(Object.keys(off.composer.readDelegation).sort(),['enabled','stopRun']);assert.equal(off.composer.readDelegation.enabled,false);}finally{off.close();}
});
