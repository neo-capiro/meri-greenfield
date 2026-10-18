/** SYNTHETIC: approval.wait settling through the ACTUAL lifecycle service, journal and conversation store (scripted SQL protocol
 * fixture), the ACTUAL action-session owner (`verifyTransition` over the journal's `readTransition`), the production continuation
 * authority (retirement over a scripted native stop, derived admission) and the Core P-INT-10 approval forwarder over a scripted
 * Core answering with the approver's live-session bearer. Then the lifecycle family composition over a candidate configuration.
 * No PostgreSQL, Temporal, ECS task, live Core, key material or credential provisioning. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {lifecycleFixture,binding,scopes,id,versions} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {allocateOriginal,recordRetired} from '../../../control/conversations/test/terminal-settlement-harness.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createConversationService} from '../../../control/conversations/service.mjs';
import {createConversationLifecycleService} from '../../../control/conversations/lifecycle/service.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createRoutinesServiceSecret} from '../../native-authority/routines-core-client.mjs';
import {createCoreApprovalForwarder,createReservedCredentialDigests,bindApprovalSessions} from '../../native-authority/approval-forwarder.mjs';
import {createContinuationAuthority} from '../../native-authority/continuation-authority.mjs';
import {approvalCore,CORE_ORIGIN,SECRET} from '../../native-authority/test/approval-core-fixture.mjs';
import {createProductPortsFactory} from '../index.mjs';
import {createLifecycleFamily,createLifecycleFamilyWith,NATIVE_STOP_OPERATION} from '../lifecycle.mjs';
import {createIntentsFamilyWith,intentsComposition} from '../intents.mjs';
import {captureRuntimePorts,composeRuntimePorts} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {candidateFixture} from '../../test/prepared-candidate-fixture.mjs';
const check=()=>{},NATIVE='synthetic-native',principal={tenantId:binding.tenantId,actorId:binding.actorId},UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const status=(n,state)=>({eventId:id(n),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}});
/** The production composition shape of assembleControl, over the scripted pool: store with the continuation authority, session
 * owner with the journal's transition reader, basic + lifecycle services; Temporal and the native stop are scripted. */
async function composition(){
 const f=await lifecycleFixture(),base=createPostgresConversationStore({pool:f.pool}),stops=[],calls={starts:[],continued:[],signals:0},state={stopMode:'record'};let n=700,allocation=null;
 const authority=createContinuationAuthority({store:base,stop:async({binding:b})=>{stops.push(b);if(state.stopMode==='record')await recordRetired(base,allocation);},selectedClientId:id(5),policyRevision:'policy1',versions,now:Date.now});
 const store=createPostgresConversationStore({pool:f.pool,transitionAuthority:authority.transitionAuthority});
 const context={binding,scopes,selectedClientId:id(5)};
 const sessions=createActionSessionOwner({mode:'process-local',limits:{maxSessions:20,maxRequestMs:3000,maxTtlMs:30000,maxFactBytes:65536},
  verifyIdentity:async()=>({principal,identityRevision:'identity1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000}),
  resolveContext:async({identity})=>({identitySha256:hash(identity),...context,contextRevision:'context1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000}),
  readTransition:input=>store.lifecycle.readTransition(input),
  resolveTransitionContext:async({identity,transition})=>{const current=await store.nextRuns.current(transition.targetBinding,check);return {identitySha256:hash(identity),binding:current.binding,scopes:current.scopes,selectedClientId:id(5),contextRevision:hash({binding:current.binding,policyRevision:current.policyRevision}),checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};}});
 const credential=(await sessions.issue({identityCredential:NATIVE})).credential;
 const core={requests:[],bearers:{[NATIVE]:{tenantId:binding.tenantId,userId:binding.actorId}},coreNow:()=>7,rewrite:null},synthetic=approvalCore(core);
 const readSecret=async path=>Buffer.from(path==='/run/meri/control'?'synthetic-control':SECRET);
 const forwarder=createCoreApprovalForwarder({origin:CORE_ORIGIN,nativeCredentials:sessions,getServiceSecret:createRoutinesServiceSecret({file:'/run/meri/core',reservedFiles:['/run/meri/control'],readSecret}),
  reservedCredentials:createReservedCredentialDigests({files:['/run/meri/control'],readSecret}),readProposal:async({proposalId})=>proposalId===f.proposal.proposalId?structuredClone(f.proposal):null,now:Date.now,fetchImpl:synthetic.fetchImpl,maxRequestMs:5000});
 const dispatcher={async start(v){calls.starts.push(v.binding);},async cancel(){},async continued(v){calls.continued.push(v.input);},async signal(){calls.signals++;}};
 const basic=createConversationService({sessions,store,dispatcher,versions,newId:()=>id(n++)});
 const approvals={async read({proposalId}){if(proposalId!==f.proposal.proposalId)throw Object.assign(Error('APPROVAL_REFUSED'),{code:'APPROVAL_REFUSED'});return structuredClone(f.proposal);},readDecision:v=>forwarder.readDecision(v)};
 const service=createConversationLifecycleService({service:basic,store,dispatcher,checkpoints:f.checkpoints,nativeAdmission:authority.continuationAdmission,approvals,sessions,newId:()=>id(n++)});
 const control=input=>service.control({credential,input});
 async function waiting(){
  await basic.allocateInput({credential,input:f.input});await basic.submit({credential,input:f.input});allocation=await allocateOriginal(base,binding);
  for(const s of ['starting','running'])await basic.publish({credential,binding,event:status(n++,s)});
  const W=id(750);await control({controlId:W,intent:'approval.wait',proposalId:f.proposal.proposalId});
  const page=await service.nextControls({credential,binding}),pending=page.controls.find(p=>p.command.controlId===W);
  await service.claimControl({credential,binding,input:{controlId:W,commandSha256:pending.commandSha256}});
  const proof=await f.capture(id(220));await service.recordCheckpoint({credential,binding,input:{controlId:W,checkpointId:id(220),checkpointSha256:proof.checkpointSha256}});
  return proof;
 }
 const decide=decision=>forwarder.record({proposal:f.proposal,decision,approver:principal,binding});
 const resume=(controlId,proof)=>control({controlId,intent:'resume',checkpointId:proof.checkpoint.checkpointId,checkpointSha256:proof.checkpointSha256});
 const history=()=>basic.history({credential,after:0,limit:1});
 const projection=controlId=>f.state.controls.get(`${binding.tenantId}:${controlId}`)?.projection;
 return {f,base,store,sessions,credential,core,synthetic,forwarder,authority,stops,state,calls,service,basic,waiting,decide,resume,history,projection,close:()=>{sessions.close();f.close();}};
}
test('approval.wait settles: the approved decision read from Core with the live session, the source retired and the derived successor APPLIED',async t=>{
 const c=await composition();t.after(c.close);
 const proof=await c.waiting();assert.equal((await c.history()).run.state,'waiting-for-approval');
 const recorded=await c.decide('approved');assert.equal(recorded.decision.decision,'approved');assert.equal(c.core.requests[0].headers.authorization,'Bearer '+NATIVE);
 const R=id(760),receipt=await c.resume(R,proof);
 assert.equal(receipt.state,'APPLIED');assert.equal(receipt.intent,'resume');assert.deepEqual(receipt.sourceBinding,binding);
 const t2=receipt.targetBinding;assert.equal(t2.writerFence,2);assert.equal(t2.conversationId,binding.conversationId);for(const k of ['runId','attemptId','workerId']){assert.match(t2[k],UUID);assert.notEqual(t2[k],binding[k]);}
 assert.match(receipt.admissionReceiptId,UUID);assert.match(receipt.retirementReceiptId,UUID);assert.equal(receipt.checkpointId,id(220));
 // One native stop, proven in the allocation journal; one Temporal start of the target and one continued signal to the source.
 assert.deepEqual(c.stops,[binding]);const saved=await c.base.allocations.read({binding,allocationKey:hash(binding)},check);assert.equal(saved.record.state,'RETIRED');assert.equal(saved.record.resource.physicalStopProven,true);
 assert.deepEqual(c.calls.starts,[binding,t2],'the original submit, then exactly the target');assert.equal(c.calls.continued.length,1);assert.deepEqual(c.calls.continued[0],{controlId:R,sourceRunId:binding.runId,targetRunId:t2.runId,admissionReceiptId:receipt.admissionReceiptId,retirementReceiptId:receipt.retirementReceiptId});
 assert.equal(c.f.state.runs.size,2);const row=[...c.f.state.runs.values()].find(r=>r.run_id===t2.runId);assert.equal(row.projection.state,'queued');assert.equal(row.continuation.continuation.checkpointSha256,proof.checkpointSha256);
 // The decision was read from Core for exactly this proposal and run, with the approver's bearer, after the approval was recorded.
 const decisionReads=c.core.requests.filter(r=>r.url.endsWith('/decision'));assert.ok(decisionReads.length>=1);for(const r of decisionReads){assert.equal(r.headers.authorization,'Bearer '+NATIVE);assert.deepEqual(r.body,{proposalId:c.f.proposal.proposalId,commandSha256:c.f.proposal.commandSha256,binding});}
 // The target's session verification and a replay of the same control are effect-free.
 const verified=await c.sessions.verifyTransition({credential:c.credential,controlId:R,sourceBinding:binding,targetBinding:t2,admissionReceiptId:receipt.admissionReceiptId,retirementReceiptId:receipt.retirementReceiptId,purpose:'receipt-readback',deadlineMs:Date.now()+1000});
 assert.match(verified.transitionSha256,/^[a-f0-9]{64}$/);
 const replay=await c.resume(R,proof);assert.equal(replay.state,'APPLIED');assert.equal(replay.replayed,true);assert.deepEqual(c.stops,[binding]);assert.equal(c.calls.starts.length,2);
});
test('a rejected or undecided proposal never retires, admits or dispatches',async t=>{
 for(const decision of [null,'rejected']){
  const c=await composition();t.after(c.close);const proof=await c.waiting();if(decision)await c.decide(decision);
  await assert.rejects(c.resume(id(770),proof),/LIFECYCLE_EFFECT_UNKNOWN/);
  assert.equal(c.projection(id(770)).state,'UNKNOWN');assert.equal(c.stops.length,0);assert.equal(c.calls.starts.length,1,'only the original submit started a workflow');assert.equal(c.f.state.runs.size,1);
  assert.equal((await c.base.allocations.read({binding,allocationKey:hash(binding)},check)).record.state,'ALLOCATED');
 }
});
test('an unproven native stop is a barrier: no admission, no target run, the control UNKNOWN',async t=>{
 const c=await composition();t.after(c.close);const proof=await c.waiting();await c.decide('approved');c.state.stopMode='silent';
 await assert.rejects(c.resume(id(780),proof),/LIFECYCLE_EFFECT_UNKNOWN/);
 assert.equal(c.stops.length,1);assert.equal(c.projection(id(780)).state,'UNKNOWN');assert.equal(c.projection(id(780)).target,null);assert.equal(c.calls.starts.length,1,'only the original submit started a workflow');assert.equal(c.f.state.runs.size,1);
});
test('without a live approver session the decision read refuses before Core and nothing is dispatched',async t=>{
 const c=await composition();t.after(c.close);const proof=await c.waiting();await c.decide('approved');
 c.sessions.revoke(c.credential);
 await assert.rejects(c.resume(id(790),proof),/SESSION_REFUSED/);assert.equal(c.stops.length,0);assert.equal(c.calls.starts.length,1,'only the original submit started a workflow');
 const reads=c.core.requests.filter(r=>r.url.endsWith('/decision'));assert.equal(reads.length,0,'the revoked session reaches neither the lifecycle nor Core');
});
/** The lifecycle family over a candidate configuration with `intents.core`: all three ports compose, Core and the native stop
 * are reached only through the forwarder and the trusted native client, the relay binds once. */
function familyContext({core=true,calls=[]}={}){
 const {configuration}=candidateFixture();
 const native={async call(operation,input){calls.push({operation,input});if(operation===NATIVE_STOP_OPERATION)return {binding:input.binding,executionId:input.executionId,expiresAtMs:Date.now()+1000};throw Error('unexpected native operation '+operation);}};
 const pool={async connect(){return {async query(text){if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|SELECT pg_advisory)/u.test(text))return {rows:[]};if(text.includes('FROM meri_intents.preparations'))return {rows:[]};throw Error('unexpected statement: '+text);},release(){}};}};
 const gate={async admit(){throw Error('not used');},async recheck(){throw Error('not used');}};
 return Object.freeze({configuration:{...configuration,intents:{enabled:true,...(core?{core:{origin:CORE_ORIGIN,serviceSecretFile:'/run/secrets/core-approvals'}}:{})}},pool,client:{},native,now:Date.now,canonicalProductPorts:captureRuntimePorts({conversationMembership:gate})});
}
const states=(ctx,ports)=>Object.fromEntries(productReadiness({ports:composeRuntimePorts(ctx.canonicalProductPorts,captureRuntimePorts(ports)),sourceEnabled:false}).owners.filter(o=>o.name.startsWith('lifecycle.')).map(o=>[o.name,o.state]));
test('with a candidate and intents.core the family composes current authority, admission/retirement and approvals; the relay binds once',async()=>{
 const calls=[],ctx=familyContext({calls}),fetches=[],reads=[];
 const transport={fetchImpl:async(url,init)=>{fetches.push({url,headers:{...init.headers}});return new Response(JSON.stringify({decision:null,checkedAtMs:1,revoked:false}),{status:200,headers:{'content-type':'application/json'}});},readSecret:async path=>{reads.push(path);return Buffer.from(path==='/run/secrets/core-approvals'?SECRET:'candidate-'+path);}};
 const ports=createProductPortsFactory({families:[['intents',createIntentsFamilyWith({transport})],['lifecycle',createLifecycleFamily]]})(ctx);
 assert.deepEqual(Object.keys(ports).sort(),['approvals','continuationAdmission','intentApplication','transitionAuthority']);
 assert.deepEqual(states(ctx,ports),{'lifecycle.currentAuthority':'composed','lifecycle.admissionRetirement':'composed','lifecycle.approvals':'composed'});
 assert.deepEqual(calls,[]);assert.deepEqual(fetches,[]);assert.deepEqual(reads,[],'inert composition');
 const shared=intentsComposition(ctx);assert.equal(shared.approvalSessions(),'unbound');assert.equal(shared.core.origin,CORE_ORIGIN);
 // Unbound: a decision read refuses before Core (no live session); bound to a session owner: Core is reached with its bearer.
 const selection={proposalId:id(201),commandSha256:'a'.repeat(64),binding};
 await assert.rejects(ports.approvals.readDecision(selection),e=>e?.code==='ACCESS_DENIED');assert.deepEqual(fetches,[]);
 const f=await lifecycleFixture();
 try{
  assert.equal(bindApprovalSessions(ctx,f.sessions),true);assert.equal(shared.approvalSessions(),'bound');
  // The custody reader answers from the scripted (empty) intents journal: an unknown proposal is refused before Core.
  await assert.rejects(ports.approvals.readDecision(selection),e=>e?.code==='ACCESS_DENIED');assert.deepEqual(fetches,[]);
  // The scripted pool answers no run row: a store outage is UNAVAILABLE, never authority.
  await assert.rejects(ports.transitionAuthority.readCurrent({binding,scopes:[{...scopes[0],policyRevision:'a'.repeat(64)}],selectedClientId:id(5),policyRevision:'a'.repeat(64),deadlineMs:Date.now()+1000}),e=>e?.code==='CONTINUATION_UNAVAILABLE');
  await assert.rejects(ports.continuationAdmission.retire({controlId:id(1),binding,checkpoint:{}}),e=>e?.code==='CONTINUATION_REFUSED');assert.deepEqual(calls,[],'nothing native before a verified source');
 }finally{f.close();}
});
test('without intents.core the decision adapter stays on the provider seam and only approvals compose without a candidate',()=>{
 const calls=[],ctx=familyContext({core:false,calls});
 const ports=createProductPortsFactory({families:[['intents',createIntentsFamilyWith()],['lifecycle',createLifecycleFamily]]})(ctx);
 assert.deepEqual(Object.keys(ports).sort(),['approvals','continuationAdmission','intentApplication','transitionAuthority']);assert.equal(intentsComposition(ctx).approvalSessions(),'absent');assert.equal(intentsComposition(ctx).core,null);
 const {nativeCandidate,...rest}=ctx.configuration;const bare=Object.freeze({...ctx,configuration:rest});
 const only=createProductPortsFactory({families:[['intents',createIntentsFamilyWith()],['lifecycle',createLifecycleFamily]]})(bare);
 assert.deepEqual(Object.keys(only).sort(),['approvals','intentApplication']);
 assert.deepEqual(states(bare,only),{'lifecycle.currentAuthority':'unavailable','lifecycle.admissionRetirement':'unavailable','lifecycle.approvals':'composed'});
});
test('the continuation seam substitutes trusted owners and refuses malformed ones',()=>{
 for(const continuation of [{fork:{}},{stop:'stop'},{store:null},{extra:1}])assert.throws(()=>createLifecycleFamilyWith({continuation}),e=>e?.code==='LIFECYCLE_CONFIGURATION');
 const stops=[],ctx=familyContext(),ports=createLifecycleFamilyWith({continuation:{stop:async v=>{stops.push(v);}}})(ctx).ports;
 assert.deepEqual(Object.keys(ports).sort(),['approvals','continuationAdmission','transitionAuthority']);
});
