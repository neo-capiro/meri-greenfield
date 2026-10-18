/** SYNTHETIC: the continuation authority over the actual conversation store (scripted SQL protocol fixture), the actual
 * lifecycle service/journal for the paused source, the actual allocation journal rows, and a scripted native stop. No
 * PostgreSQL, Temporal, ECS task, Core or credential is claimed. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {lifecycleFixture,binding,scopes,id,versions} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {allocateOriginal,recordRetired} from '../../../control/conversations/test/terminal-settlement-harness.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createContinuationAuthority,derivedUuid} from '../continuation-authority.mjs';
const check=()=>{},code=c=>e=>e?.code===c,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const status=(n,state)=>({eventId:id(n),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}});
/** A paused original with its claimed allocation, as the prepared kickoff leaves it; `stopMode` scripts the native stop owner. */
export async function pausedSource({pause=true,fork}={}){
 const f=await lifecycleFixture(),base=createPostgresConversationStore({pool:f.pool}),stops=[],state={stopMode:'record'};
 await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
 const allocation=await allocateOriginal(base,binding);
 let n=600;for(const s of ['starting','running'])await f.service.publish({credential:f.credential,binding,event:status(n++,s)});
 if(pause){await f.control({controlId:id(610),intent:'pause'});await f.claim(id(610));await f.checkpoint(id(610));}
 const stop=async({binding:b,signal})=>{stops.push({binding:b,aborted:signal?.aborted===true});if(state.stopMode==='record')await recordRetired(base,allocation);if(state.stopMode==='throw')throw Error('native stop uncertain');};
 const authority=createContinuationAuthority({store:base,stop,selectedClientId:id(5),policyRevision:'policy1',versions,now:Date.now,limits:{maxRequestMs:3000,authorityWindowMs:30000,admissionWindowMs:120000},...(fork?{fork}:{})});
 const proof=pause?f.proofs.get(id(220)):null,saved=await base.read(binding,{after:0,limit:1},check);
 const admitInput=(controlId,mode='resume')=>({controlId,mode,sourceBinding:binding,checkpoint:proof.checkpoint,checkpointSha256:proof.checkpointSha256,request:saved.request,scopes,selectedClientId:id(5),versions});
 return {f,base,allocation,stops,state,authority,proof,saved,admitInput,close:f.close};
}
test('readCurrent answers the durable currentness of the exact run with a Meri-stamped bounded fact',async t=>{
 const h=await pausedSource();t.after(h.close);const {readCurrent}=h.authority.transitionAuthority;
 const started=Date.now(),fact=await readCurrent({binding,scopes,selectedClientId:id(5),policyRevision:'policy1',deadlineMs:started+1000});
 assert.deepEqual(Object.keys(fact),['binding','scopes','selectedClientId','policyRevision','checkedAtMs','expiresAtMs']);assert.ok(Object.isFrozen(fact));
 assert.deepEqual(fact.binding,binding);assert.deepEqual(fact.scopes,scopes);assert.ok(fact.checkedAtMs>=started);assert.ok(fact.expiresAtMs>fact.checkedAtMs&&fact.expiresAtMs<=started+30000);
 for(const [name,expected] of [
  ['stale fence',{binding:{...binding,writerFence:2}}],['other scopes',{scopes:[{...scopes[0],resourceId:id(9)}]}],['other policy',{policyRevision:'policy2'}],
  ['other client',{selectedClientId:id(9)}],['scope revision drift',{scopes:[{...scopes[0],policyRevision:'policy2'}]}],['no deadline',{deadlineMs:undefined}],
 ])await assert.rejects(readCurrent({binding,scopes,selectedClientId:id(5),policyRevision:'policy1',deadlineMs:Date.now()+1000,...expected}),code('CONTINUATION_REFUSED'),name);
 // A terminal run is no longer current authority (a held run is cancelled through the lifecycle journal's terminal fence).
 await h.base.lifecycle.cancel(binding,{...status(620,'cancelled'),data:{state:'cancelled',reasonCode:'USER_CANCELLED'}},check,scopes);
 await assert.rejects(readCurrent({binding,scopes,selectedClientId:id(5),policyRevision:'policy1',deadlineMs:Date.now()+1000}),code('CONTINUATION_REFUSED'));
});
test('resume admission derives one target per control from the verified source and checkpoint, idempotently',async t=>{
 const h=await pausedSource();t.after(h.close);const {admit}=h.authority.continuationAdmission;
 const started=Date.now(),a=await admit(h.admitInput(id(630)));
 assert.deepEqual(Object.keys(a),['binding','scopes','selectedClientId','admissionReceiptId','targetSessionId','expiresAtMs']);
 assert.deepEqual({...a.binding,runId:null,attemptId:null,workerId:null},{...binding,writerFence:2,runId:null,attemptId:null,workerId:null});
 for(const k of ['runId','attemptId','workerId']){assert.match(a.binding[k],UUID);assert.notEqual(a.binding[k],binding[k]);}
 assert.equal(new Set([a.binding.runId,a.binding.attemptId,a.binding.workerId]).size,3);assert.match(a.admissionReceiptId,UUID);assert.equal(a.targetSessionId,null);
 assert.deepEqual(a.scopes,scopes);assert.equal(a.selectedClientId,id(5));assert.ok(a.expiresAtMs>started&&a.expiresAtMs<=started+120000+5);
 const again=await admit(h.admitInput(id(630)));assert.deepEqual({...again,expiresAtMs:0},{...a,expiresAtMs:0});
 const other=await admit(h.admitInput(id(631)));assert.notEqual(other.binding.runId,a.binding.runId);assert.notEqual(other.admissionReceiptId,a.admissionReceiptId);
 assert.equal(a.binding.runId,derivedUuid({controlId:id(630),mode:'resume',sourceBinding:binding,checkpointSha256:h.proof.checkpointSha256,field:'runId'}));
 assert.equal(h.stops.length,0,'admission never stops anything');
});
test('admission refuses every substitution of the source, checkpoint, request, scopes, client or versions',async t=>{
 const h=await pausedSource();t.after(h.close);const {admit}=h.authority.continuationAdmission,cp=h.proof.checkpoint;
 const cases={
  'checkpoint digest':{checkpointSha256:'a'.repeat(64)},'checkpoint of another run':{checkpoint:{...cp,binding:{...binding,runId:id(9)}}},
  'checkpoint scopes':{checkpoint:{...cp,scopes:[{...scopes[0],resourceId:id(9)}]}},'request':{request:{...h.saved.request,prompt:'other'}},
  'scopes':{scopes:[{...scopes[0],resourceId:id(9)}]},'client':{selectedClientId:id(9)},'versions':{versions:{...versions,sdk:'0.0.1'}},
  'mode':{mode:'restart'},'control id':{controlId:'control'},'stale source':{sourceBinding:{...binding,writerFence:2}},
 };
 for(const [name,extra] of Object.entries(cases)){const input={...h.admitInput(id(640)),...extra};if(extra.checkpoint&&!extra.checkpointSha256)input.checkpointSha256=hash(extra.checkpoint);await assert.rejects(admit(input),code('CONTINUATION_REFUSED'),name);}
 await assert.rejects(admit(h.admitInput(id(641),'fork')),code('CONTINUATION_FORK_UNAVAILABLE'),'fork without the initial-run-binding owners');
 assert.equal(h.stops.length,0);
});
test('a running (uncheckpointed) source is refused for resume',async t=>{
 const h=await pausedSource({pause:false});t.after(h.close);const paused=await pausedSource();t.after(paused.close);
 const input={...paused.admitInput(id(650)),request:h.saved.request};
 await assert.rejects(h.authority.continuationAdmission.admit(input),code('CONTINUATION_REFUSED'));
});
test('fork admission claims the new conversation through the initial-run-binding owner once and replays it',async t=>{
 const claims=[],reads=[];let record=null;
 const fork={configurationSha256:'c'.repeat(64),proposeInitialExpiry:()=>Date.now()+90000,initialBindings:{
  async readConversation(q){reads.push(q);return record&&record.binding.conversationId===q.conversationId?structuredClone(record):null;},
  async claim(v){claims.push(v);record={schemaVersion:1,state:'ADMITTED',binding:{tenantId:v.principal.tenantId,actorId:v.principal.actorId,conversationId:v.conversationId,runId:id(660),attemptId:id(661),workerId:id(662),writerFence:1},selectedClientId:v.selectedClientId,policyRevision:v.policyRevision,versions:v.versions,configurationSha256:v.configurationSha256,expiresAtMs:v.proposedExpiresAtMs,createdAtMs:Date.now()};return {record:structuredClone(record),created:true};}}};
 const h=await pausedSource({fork});t.after(h.close);const {admit}=h.authority.continuationAdmission;
 const a=await admit(h.admitInput(id(670),'fork'));
 assert.equal(a.binding.writerFence,1);assert.notEqual(a.binding.conversationId,binding.conversationId);assert.match(a.binding.conversationId,UUID);assert.equal(a.binding.runId,id(660));
 assert.match(a.targetSessionId,UUID);assert.notEqual(a.targetSessionId,h.proof.checkpoint.sessionId);assert.equal(a.expiresAtMs,record.expiresAtMs);
 assert.equal(claims.length,1);assert.deepEqual(claims[0],{principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:a.binding.conversationId,selectedClientId:id(5),policyRevision:'policy1',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:record.expiresAtMs});
 const again=await admit(h.admitInput(id(670),'fork'));assert.deepEqual(again,a);assert.equal(claims.length,1,'the replay reads the claimed conversation');
 record={...record,selectedClientId:id(9)};await assert.rejects(admit(h.admitInput(id(670),'fork')),code('CONTINUATION_REFUSED'),'a claimed record for another client is refused');
});
test('retirement asks the native stop once and trusts only the journal\'s RETIRED with the physical-stop proof',async t=>{
 const h=await pausedSource();t.after(h.close);const {retire}=h.authority.continuationAdmission,cp=h.proof.checkpoint;
 const started=Date.now(),r=await retire({controlId:id(680),binding,checkpoint:cp});
 assert.deepEqual(Object.keys(r),['binding','retirementReceiptId','expiresAtMs']);assert.deepEqual(r.binding,binding);assert.match(r.retirementReceiptId,UUID);assert.ok(r.expiresAtMs>started);
 assert.equal(h.stops.length,1);assert.deepEqual(h.stops[0].binding,binding);
 const saved=await h.base.allocations.read({binding,allocationKey:hash(binding)},check);assert.equal(saved.record.state,'RETIRED');assert.equal(saved.record.resource.physicalStopProven,true);
 const again=await retire({controlId:id(680),binding,checkpoint:cp});assert.equal(again.retirementReceiptId,r.retirementReceiptId);assert.equal(h.stops.length,1,'an already retired source is not stopped again');
 assert.notEqual((await retire({controlId:id(681),binding,checkpoint:cp})).retirementReceiptId,r.retirementReceiptId);
 await assert.rejects(retire({controlId:id(682),binding,checkpoint:{...cp,binding:{...binding,runId:id(9)}}}),code('CONTINUATION_REFUSED'));
});
for(const mode of ['silent','throw'])test(`an unproven native stop (${mode}) refuses without any receipt`,async t=>{
 const h=await pausedSource();t.after(h.close);h.state.stopMode=mode;
 await assert.rejects(h.authority.continuationAdmission.retire({controlId:id(690),binding,checkpoint:h.proof.checkpoint}),code('CONTINUATION_STOP_UNPROVEN'));
 assert.equal(h.stops.length,1);const saved=await h.base.allocations.read({binding,allocationKey:hash(binding)},check);assert.equal(saved.record.state,'ALLOCATED');
});
test('retirement refuses a running source and a source without an allocation row',async t=>{
 const running=await pausedSource({pause:false});t.after(running.close);const paused=await pausedSource();t.after(paused.close);
 await assert.rejects(running.authority.continuationAdmission.retire({controlId:id(700),binding,checkpoint:paused.proof.checkpoint}),code('CONTINUATION_REFUSED'));
 paused.f.state.allocations.clear();
 await assert.rejects(paused.authority.continuationAdmission.retire({controlId:id(701),binding,checkpoint:paused.proof.checkpoint}),code('CONTINUATION_REFUSED'));
 assert.equal(running.stops.length+paused.stops.length,0);
});
test('configuration is closed and inert',async t=>{
 const h=await pausedSource();t.after(h.close);
 const valid={store:h.base,stop:async()=>{},selectedClientId:id(5),policyRevision:'policy1',versions,now:Date.now};
 for(const bad of [{...valid,store:{}},{...valid,stop:'stop'},{...valid,selectedClientId:'client'},{...valid,policyRevision:''},{...valid,versions:{}},{...valid,fork:{}},{...valid,limits:{authorityWindowMs:0}},{...valid,extra:1}])
  assert.throws(()=>createContinuationAuthority(bad),code('CONTINUATION_CONFIGURATION'));
 const a=createContinuationAuthority(valid);assert.deepEqual(Object.keys(a),['transitionAuthority','continuationAdmission','fork','limits']);assert.equal(a.fork,false);assert.equal(h.f.state.calls.length>0,true);
});
