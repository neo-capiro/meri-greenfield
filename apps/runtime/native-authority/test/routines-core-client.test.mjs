/** SYNTHETIC: Core wire A/B clients over the actual action-session owner (live native credential relay), the actual schedule
 * runtime context policy() as the acceptance oracle, and a scripted Core that follows the PR #84 @32cf3ca7 decision rules.
 * No socket, live Core, key material outside this process or credential provisioning. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createScheduleRuntimeContext} from '../../../control/schedules/runtime-context.mjs';
import {applicationFixture,routineRequest,binding,clientId,NOW,id} from '../../../control/schedules/test/application-fixture.mjs';
import {createRoutinesCoreClient,createRoutinesServiceSecret,ROUTINES_CORE_ROUTES} from '../routines-core-client.mjs';
import {coreRoutes,coreSigner,CORE_ORIGIN,ROUTINE_LIMITS} from './routines-core-fixture.mjs';

const SECRET='synthetic-routines-service-secret',code=c=>e=>e?.code===c;
const request=()=>({...routineRequest(),destinationReference:'meri-inbox'});
async function harness(){
 const f=await applicationFixture(),core={requests:[],serviceSecret:SECRET,bearer:'synthetic-native',principal:{tenantId:binding.tenantId,actorId:binding.actorId},signer:coreSigner(),coreNow:()=>f.state.now,
  membership:()=>({tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId],expiresAtMs:NOW+60000}),rewrite:null};
 const reads=[],getServiceSecret=createRoutinesServiceSecret({file:'/run/meri/routines-service-secret',reservedFiles:['/run/meri/identity'],readSecret:async path=>{reads.push(path);return Buffer.from(path==='/run/meri/identity'?'native-candidate-credential':SECRET+'\n');}});
 const client=createRoutinesCoreClient({origin:CORE_ORIGIN,nativeCredentials:f.sessions,getServiceSecret,now:f.now,fetchImpl:coreRoutes(core),maxRequestMs:5000});
 const context=policy=>createScheduleRuntimeContext({...f.contextConfiguration,policy});
 const resolve=(policy,operation='schedule_task',value=request())=>context(policy).resolve({credential:f.session.credential,operation,request:value,deadlineMs:f.now()+4000});
 return {f,core,reads,client,context,resolve,close:f.close};
}

test('wire A answers runtime-context policy() exactly: attended headers, digest echo, byte-exact destination and allocation limits',async t=>{
 const h=await harness();t.after(h.close);
 const created=await h.resolve({check:h.client.policyCheck});const p=created.prepared.intent.projection;
 assert.equal(p.destinationId,'meri-inbox');assert.equal(created.context.scheduleContext.destinationResolution.reference,'meri-inbox');
 // Meri re-applies min(requested, receipt, allocation): the receipt is a ceiling only.
 assert.ok(p.maxCostMicrousd<=ROUTINE_LIMITS.maxCostMicrousd&&p.maxRuntimeSeconds<=ROUTINE_LIMITS.maxRuntimeSeconds&&p.retryLimit===0);
 const sent=h.core.requests[0];assert.equal(sent.url,CORE_ORIGIN+ROUTINES_CORE_ROUTES.policy);
 assert.equal(sent.headers.authorization,'Bearer synthetic-native');assert.equal(sent.headers['x-internal-service-secret'],SECRET);assert.ok(!JSON.stringify(sent).includes(h.f.session.credential));
 assert.deepEqual(Object.keys(sent.body).sort(),['selection','selectionSha256']);assert.equal(sent.body.selectionSha256,hash(sent.body.selection));
 assert.deepEqual(sent.body.selection.current.binding,binding);assert.equal(sent.body.selection.current.selectedClientId,clientId);
 assert.deepEqual(h.reads,['/run/meri/identity','/run/meri/routines-service-secret']);
 const listed=await h.resolve({check:h.client.policyCheck},'list_scheduled_tasks',{});assert.equal(listed.prepared.operation??'list_scheduled_tasks','list_scheduled_tasks');
 assert.equal(h.core.requests.at(-1).body.selection.operation,'list_scheduled_tasks');
});

test('acceptance oracle: no tampered Core answer passes the client that the raw policy() would refuse',async t=>{
 const h=await harness();t.after(h.close);
 const mutations={
  unauthorized:r=>({...r,authorized:false}),digest:r=>({...r,selectionSha256:'0'.repeat(64)}),binding:r=>({...r,binding:{...r.binding,writerFence:2}}),
  scopes:r=>({...r,scopes:r.scopes.map(s=>({...s,policyRevision:'p2'}))}),client:r=>({...r,selectedClientId:id(99)}),
  reference:r=>({...r,destinationResolution:{...r.destinationResolution,reference:'meri-inbox '}}),referenceCase:r=>({...r,destinationResolution:{...r.destinationResolution,reference:'Meri-inbox'}}),
  destinationId:r=>({...r,destinationResolution:{...r.destinationResolution,destinationId:'email'}}),destinationNull:r=>({...r,destinationResolution:null}),
  limitsNull:r=>({...r,limits:null}),limitsZero:r=>({...r,limits:{...r.limits,maxCostMicrousd:0}}),limitsText:r=>({...r,limits:{...r.limits,retryLimit:'0'}}),
  limitsExtra:r=>({...r,limits:{...r.limits,maxTurns:1}}),extraKey:r=>({...r,grant:true}),missingKey:r=>{const {limits,...rest}=r;return rest;},
  expired:r=>({...r,expiresAtMs:r.checkedAtMs}),
 };
 const valid=[];
 h.core.rewrite=(status,body)=>{valid.push(body);return [status,body];};await h.resolve({check:h.client.policyCheck});const receipt=valid[0];
 for(const [name,mutate] of Object.entries(mutations)){
  h.core.rewrite=(status,body)=>[status,mutate(body)];
  const viaClient=await h.resolve({check:h.client.policyCheck}).then(()=>true,()=>false);
  const viaRaw=await h.resolve({check:async({selectionSha256})=>mutate({...receipt,selectionSha256,checkedAtMs:h.f.now(),expiresAtMs:h.f.now()+10000})}).then(()=>true,()=>false);
  // Parity: the raw receipt is refused by policy() itself, and the client refuses it before policy() sees it.
  assert.deepEqual([viaClient,viaRaw],[false,false],name);
 }
 // list/cancel: Core must answer null destination and limits; any value refuses.
 h.core.rewrite=(status,body)=>[status,{...body,limits:{...ROUTINE_LIMITS}}];await assert.rejects(h.resolve({check:h.client.policyCheck},'list_scheduled_tasks',{}));
 h.core.rewrite=(status,body)=>[status,{...body,destinationResolution:{reference:'meri-inbox',destinationId:'meri-inbox'}}];await assert.rejects(h.resolve({check:h.client.policyCheck},'list_scheduled_tasks',{}));
});

test('Core refusals, non-JSON answers, a different destination reference and an over-long lease all refuse',async t=>{
 const h=await harness();t.after(h.close);
 // Core accepts only the literal 'meri-inbox' reference (draft section 4.5); Meri echoes the normalized request value byte for byte.
 await assert.rejects(h.resolve({check:h.client.policyCheck},'schedule_task',routineRequest()),code('ROUTINES_CORE_REFUSED'));
 for(const status of [400,403,409])h.core.rewrite=()=>[status,{}],await assert.rejects(h.resolve({check:h.client.policyCheck}),code('ROUTINES_CORE_REFUSED'));
 for(const status of [201,500,503])h.core.rewrite=()=>[status,{}],await assert.rejects(h.resolve({check:h.client.policyCheck}),code('ROUTINES_CORE_UNAVAILABLE'));
 h.core.rewrite=null;h.core.contentType='text/plain';await assert.rejects(h.resolve({check:h.client.policyCheck}),code('ROUTINES_CORE_UNAVAILABLE'));delete h.core.contentType;
 h.core.rewrite=(status,body)=>[status,{...body,expiresAtMs:body.checkedAtMs+30001}];await assert.rejects(h.resolve({check:h.client.policyCheck}),code('ROUTINES_CORE_INVALID_RESULT'));
 h.core.rewrite=null;h.core.serviceSecret='rotated';await assert.rejects(h.resolve({check:h.client.policyCheck}),code('ROUTINES_CORE_REFUSED'));
});

test('Meri stamps its own observation: Core clock skew can neither backdate, extend nor outlive the native session',async t=>{
 const h=await harness();t.after(h.close);const seen=[];
 const policy={async check(call){const r=await h.client.policyCheck(call);seen.push(r);return r;}};
 for(const skew of [-20000,0,20000]){h.core.coreNow=()=>h.f.now()+skew;await h.resolve(policy);}
 for(const r of seen){assert.equal(r.checkedAtMs,h.f.now());assert.ok(r.expiresAtMs<=h.f.now()+30000);}
 // The membership (native session) expiry bounds Core's lease; Core's own lease length is re-based on Meri's clock.
 h.core.coreNow=()=>h.f.now()-50000;h.core.membership=()=>({tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId],expiresAtMs:h.f.now()-45000});
 const short=await h.client.policyCheck({selection:seen[0]&&h.core.requests.at(-1).body.selection,selectionSha256:h.core.requests.at(-1).body.selectionSha256});
 assert.equal(short.expiresAtMs,h.f.now()+5000);
});

test('attended only: without a live session for the exact run and client nothing is sent; the bearer is never the service secret',async t=>{
 const h=await harness();t.after(h.close);const before=h.core.requests.length;
 const selection=(await (async()=>{h.core.rewrite=(s,b,record)=>[s,b];await h.resolve({check:h.client.policyCheck});return h.core.requests.at(-1).body;})());
 for(const current of [{...selection.selection.current,binding:{...binding,runId:id(77)}},{...selection.selection.current,selectedClientId:id(78)}]){
  const changed={...selection.selection,current},count=h.core.requests.length;
  await assert.rejects(h.client.policyCheck({selection:changed,selectionSha256:hash(changed)}),code('ROUTINES_CORE_SESSION_UNAVAILABLE'));assert.equal(h.core.requests.length,count);
 }
 await assert.rejects(h.client.policyCheck({selection:selection.selection,selectionSha256:'0'.repeat(64)}),code('ROUTINES_CORE_REQUEST'));
 const same=createRoutinesCoreClient({origin:CORE_ORIGIN,nativeCredentials:h.f.sessions,getServiceSecret:async()=>'synthetic-native',now:h.f.now,fetchImpl:coreRoutes(h.core)});
 await assert.rejects(same.policyCheck(selection),code('ROUTINES_CORE_UNAVAILABLE'));
 const candidate=createRoutinesServiceSecret({file:'/run/meri/s',reservedFiles:['/run/meri/identity'],readSecret:async()=>Buffer.from('same-bytes')});await assert.rejects(candidate(),code('ROUTINES_CORE_UNAVAILABLE'));
 h.f.sessions.close();const count=h.core.requests.length;
 await assert.rejects(h.client.policyCheck(selection),code('ROUTINES_CORE_SESSION_UNAVAILABLE'));assert.equal(h.core.requests.length,count);assert.ok(count>before);
});

test('wire B sends the exact intent, digest, decision and targets over the attended session and returns only a JWS',async t=>{
 const h=await harness();t.after(h.close);
 const intent={intentId:id(301),operation:'cancel_scheduled_task',expectedGeneration:1,generation:2,previousProjectionSha256:'e'.repeat(64),configuration:null,
  projection:{scheduleId:id(302),owner:{tenantId:binding.tenantId,actorId:binding.actorId},temporalScheduleId:'meri/schedules/'+id(302),timezone:'UTC',scopes:h.f.scopes(),state:'paused',maxCostMicrousd:1,maxRuntimeSeconds:1,retryLimit:0,destinationId:'meri-inbox',createdAt:new Date(NOW).toISOString()},
  cancel:{mode:'pause',note:'n',running:'request_cancel',runs:[{workflowId:'meri:x',runId:id(303)}]}};
 const decision={proposalId:intent.intentId,commandSha256:hash(intent),decision:'approved',approver:{tenantId:binding.tenantId,actorId:binding.actorId},policyRevision:'p1',decidedAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+20000).toISOString()};
 const targets=[{...binding,conversationId:id(310)}],attended={binding,selectedClientId:clientId};
 const issued=await h.client.cancellationProof({attended,intent,intentSha256:hash(intent),decision,targets,deadlineMs:h.f.now()+5000});
 assert.deepEqual(Object.keys(issued),['proof','jti']);assert.equal(issued.proof.split('.').length,3);
 const sent=h.core.requests.at(-1);assert.equal(sent.url,CORE_ORIGIN+ROUTINES_CORE_ROUTES.cancellationProof);assert.deepEqual(sent.body,{intent,intentSha256:hash(intent),decision,targets});
 assert.equal(sent.headers.authorization,'Bearer synthetic-native');assert.equal(sent.headers['x-internal-service-secret'],SECRET);
 const count=h.core.requests.length;
 for(const bad of [{intentSha256:'0'.repeat(64)},{targets:[{...binding,actorId:'other'}]},{targets:[]},{attended:{binding:{...binding,actorId:'other'},selectedClientId:clientId}}])
  await assert.rejects(h.client.cancellationProof({attended,intent,intentSha256:hash(intent),decision,targets,deadlineMs:h.f.now()+5000,...bad}));
 assert.equal(h.core.requests.length,count);
 h.core.rewrite=(status,body)=>[status,{...body,proof:'not a jws'}];await assert.rejects(h.client.cancellationProof({attended,intent,intentSha256:hash(intent),decision,targets,deadlineMs:h.f.now()+5000}),code('ROUTINES_CORE_INVALID_RESULT'));
 h.core.rewrite=()=>[503,{message:'Routine cancellation proofs are not enabled'}];await assert.rejects(h.client.cancellationProof({attended,intent,intentSha256:hash(intent),decision,targets,deadlineMs:h.f.now()+5000}),code('ROUTINES_CORE_UNAVAILABLE'));
});
