/** L1 hold/publication interleavings across the real worker activity + lifecycle reader and the actual
 * control lifecycle service, journal and store. Only the SDK transport and native checkpoint capture are
 * scripted; the SQL engine is the caller's pool (scripted protocol fixture by default, owned PostgreSQL opt-in). */
import assert from 'node:assert/strict';
import {lifecycleFixture,binding as fixtureBinding,id,versions} from './lifecycle-fixture.mjs';
import {createLifecycleRunOwner} from '../lifecycle/worker-owner.mjs';
import {createConversationActivity} from '../../../worker/conversation/activity.mjs';
const SESSION_ID=id(223); // the session the fixture's native capture records
export async function holdComposition({pool,binding=fixtureBinding,scopes,captureFails=false,captureCompletion,terminalAttemptMs}={}){
 const f=await lifecycleFixture(pool?{pool,binding,scopes}:{}),hooks={},counts={claims:0,captures:0,interrupts:0,closes:0,queries:0,reads:0},inputs=[],refusals=[];
 const owner=createLifecycleRunOwner({service:f.service,credentialForBinding:async()=>f.credential});
 const runOwner={...owner,
  async nextControls(args){const page=await owner.nextControls(args);counts.reads++;await hooks.afterRead?.(counts.reads,page);return page;},
  async claimControl(args){counts.claims++;const result=await owner.claimControl(args);await hooks.afterClaim?.(result);return result;},
  async append(args){await hooks.beforeAppend?.(args.event,args.signal);let result;try{result=await owner.append(args);}catch(error){refusals.push({type:args.event.type,data:args.event.data,code:error.code});hooks.refused?.(args.event,error);throw error;}await hooks.afterAppend?.(args.event,result);return result;}};
 async function captureCheckpoint({sessionId}){counts.captures++;if(captureFails)throw Error('synthetic native capture refusal');const proof=await f.capture(id(220)),cp=proof.checkpoint;
  return {checkpoint:cp,checkpointSha256:proof.checkpointSha256,sourceRequestSha256:proof.sourceRequestSha256,contextSha256:proof.contextSha256,sessionId,resumeSessionAt:null,verificationId:id(227),workspaceReadbackSha256:cp.workspaceSha256,opaqueSessionReadbackSha256:cp.opaqueSession.sha256,checkedAtMs:Date.now(),expiresAtMs:Date.now()+5000};}
 const prepareRuntime=async({binding:b})=>({binding:b,versions,cwd:`/workspace/conversations/${b.conversationId}`,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+4000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:4096});
 let n=0;const api={init:{type:'system',subtype:'init',session_id:SESSION_ID},text:text=>({type:'assistant',parent_tool_use_id:null,session_id:SESSION_ID,message:{id:`msg_${++n}`,content:[{type:'text',text}]}}),result:{type:'result',subtype:'success',is_error:false}};
 const h={f,hooks,counts,inputs,refusals,script:null};
 function query(args){counts.queries++;const stop=Promise.withResolvers();return {async *[Symbol.asyncIterator](){const iterator=args.prompt[Symbol.asyncIterator]();inputs.push((await iterator.next()).value);
   void (async()=>{for(;;){const next=await iterator.next();if(next.done)return;inputs.push(next.value);}})();yield* h.script({...api,stopped:stop.promise});},
  async interrupt(){counts.interrupts++;await hooks.interrupted?.();return {still_queued:[]};},close(){counts.closes++;stop.resolve();}};}
 const lifecycle={captureCheckpoint,pollMs:5,...(captureCompletion?{captureCompletion:input=>captureCompletion(h,input)}:{})};
 h.execute=async()=>{await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});await hooks.afterSubmit?.();return createConversationActivity({runOwner,prepareRuntime,query,lifecycle,...(terminalAttemptMs?{terminalAttemptMs}:{})})({binding});};
 h.control=intent=>f.control(intent==='pause'?{controlId:id(231),intent}:{controlId:id(232),intent,proposalId:f.proposal.proposalId});
 h.controlId=intent=>intent==='pause'?id(231):id(232);
 h.history=async()=>f.store.read(binding,{after:0,limit:100},()=>{});
 h.control_state=async intent=>(await f.store.lifecycle.get({binding,scopes:(await h.history()).run.scopes,selectedClientId:id(5),controlId:h.controlId(intent)},()=>{})).state;
 h.row=async()=>{if(pool){const r=(await pool.query('SELECT hold_control_id,projection FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[binding.tenantId,binding.conversationId,binding.runId])).rows[0];return {hold:r.hold_control_id,state:r.projection.state};}
  const r=[...f.state.runs.values()].find(row=>row.run_id===binding.runId);return {hold:r.hold_control_id??null,state:r.projection.state};};
 h.checkpointed=async()=>{if(pool)return Number((await pool.query('SELECT count(*) AS n FROM meri_conversations.checkpoints WHERE tenant_id=$1 AND run_id=$2',[binding.tenantId,binding.runId])).rows[0].n);return f.state.checkpoints.size;};
 return h;
}
/** The acceptance invariants every interleaving must satisfy. */
export async function assertHoldSettled(h,{intent='pause',outcome,deltas=[]}){
 const saved=await h.history(),row=await h.row(),statuses=saved.events.filter(e=>e.type==='run.status').map(e=>e.data);
 // No post-hold output: only text published before the hold committed is durable.
 assert.deepEqual(saved.events.filter(e=>e.type==='message.delta').map(e=>e.data.text),deltas);
 // No duplicated control input: the hold is claimed at most once and never enters the SDK input stream.
 assert(h.counts.claims<=1);assert.equal(h.inputs.length,1);assert.equal(h.counts.queries,1);
 // No permanently held-running row.
 assert.notEqual(row.state,'running');assert.equal(row.hold,h.controlId(intent));
 if(outcome==='checkpointed'){const state=intent==='pause'?'paused':'waiting-for-approval';
  assert.equal(row.state,state);assert.equal(await h.checkpointed(),1);assert.equal(await h.control_state(intent),'APPLIED');
  assert.deepEqual(saved.events.slice(-2).map(e=>e.type),['checkpoint.verified','run.status']);assert.deepEqual(statuses.at(-1),{state,reasonCode:'CONTROL_CHECKPOINTED'});}
 else{ // No uncheckpointed silent close: the closed SDK ends in an explicit, verified hold failure and an UNKNOWN barrier.
  assert.equal(row.state,'failed');assert.equal(await h.checkpointed(),0);assert.equal(await h.control_state(intent),'UNKNOWN');
  assert.deepEqual(statuses.at(-1),{state:'failed',reasonCode:'HOLD_CHECKPOINT_FAILED'});}
 assert(h.counts.closes>=1);
}
/** Each scenario receives a factory for a fresh composition. */
export const holdScenarios={
 'pause committed while the control read is in flight: refused text is fenced, claimed once and checkpointed':async make=>{
  const h=await make(),inFlight=Promise.withResolvers(),release=Promise.withResolvers(),committed=Promise.withResolvers(),refused=Promise.withResolvers();
  h.hooks.afterRead=async n=>{if(n===1){inFlight.resolve();await release.promise;}};h.hooks.refused=(event,error)=>{if(event.type==='message.delta')refused.resolve(error.code);};
  h.script=async function*({init,text,stopped}){yield init;yield text('before the hold');await committed.promise;yield text('after the hold');yield text('still after');await stopped;};
  const run=h.execute();await inFlight.promise;await h.control('pause');committed.resolve();assert.equal(await refused.promise,'RUN_HELD');release.resolve();
  assert.deepEqual(await run,{state:'paused'});assert.equal(h.counts.interrupts,1);assert.equal(h.counts.captures,1);
  assert.equal(h.refusals.filter(r=>r.type==='message.delta').length,1,'output is suppressed after the first refusal');
  await assertHoldSettled(h,{outcome:'checkpointed',deltas:['before the hold']});},
 'approval.wait committed while the control read is in flight settles waiting-for-approval through the checkpoint':async make=>{
  const h=await make(),inFlight=Promise.withResolvers(),release=Promise.withResolvers(),committed=Promise.withResolvers(),refused=Promise.withResolvers();
  h.hooks.afterRead=async n=>{if(n===1){inFlight.resolve();await release.promise;}};h.hooks.refused=event=>{if(event.type==='message.delta')refused.resolve();};
  h.script=async function*({init,text,stopped}){yield init;await committed.promise;yield text('after the hold');await stopped;};
  const run=h.execute();await inFlight.promise;await h.control('approval.wait');committed.resolve();await refused.promise;release.resolve();
  assert.deepEqual(await run,{state:'waiting-for-approval'});await assertHoldSettled(h,{intent:'approval.wait',outcome:'checkpointed'});},
 'text refused after the durable claim but before the worker learns of it still checkpoints the claimed pause':async make=>{
  const h=await make(),firstRead=Promise.withResolvers(),durable=Promise.withResolvers(),release=Promise.withResolvers(),refused=Promise.withResolvers();
  h.hooks.afterRead=n=>{if(n===1)firstRead.resolve();};h.hooks.afterClaim=async()=>{durable.resolve();await release.promise;};h.hooks.refused=event=>{if(event.type==='message.delta')refused.resolve();};
  h.script=async function*({init,text,stopped}){yield init;await durable.promise;yield text('raced the claim');await stopped;};
  const run=h.execute();await firstRead.promise;await h.control('pause');await refused.promise;release.resolve();
  assert.deepEqual(await run,{state:'paused'});assert.equal(h.counts.claims,1);await assertHoldSettled(h,{outcome:'checkpointed'});},
 'an append in flight when the local hold transition starts is refused and absorbed without a failure or second claim':async make=>{
  const h=await make(),firstRead=Promise.withResolvers(),committed=Promise.withResolvers(),interrupted=Promise.withResolvers();
  h.hooks.afterRead=n=>{if(n===1)firstRead.resolve();};h.hooks.interrupted=()=>interrupted.resolve();h.hooks.beforeAppend=async event=>{if(event.type==='message.delta')await interrupted.promise;};
  h.script=async function*({init,text,stopped}){yield init;await committed.promise;yield text('in flight across the claim');await stopped;};
  const run=h.execute();await firstRead.promise;await h.control('pause');committed.resolve();
  assert.deepEqual(await run,{state:'paused'});assert.deepEqual(h.refusals.map(r=>[r.type,r.code]),[['message.delta','RUN_HELD']]);await assertHoldSettled(h,{outcome:'checkpointed'});},
 'pause committed during completion publication records the explicit hold failure, never a held-running row':async make=>{
  const h=await make();h.hooks.beforeAppend=async event=>{if(event.type==='run.status'&&event.data.state==='completed')await h.control('pause');};
  h.script=async function*({init,text,result,stopped}){yield init;yield text('final answer');yield result;await stopped;};
  await assert.rejects(h.execute(),/EXECUTION_FAILED/);assert.equal(h.counts.claims,0);assert.equal(h.counts.captures,0);
  assert.deepEqual(h.refusals.map(r=>[r.data.state,r.code]),[['completed','RUN_HELD'],['failed','RUN_HELD']]);await assertHoldSettled(h,{outcome:'failed',deltas:['final answer']});},
 'pause committed during completion capture (synthetic capture refusal) records the explicit hold failure':async make=>{
  const h=await make({captureCompletion:async(h)=>{await h.control('pause');throw Object.assign(Error('COMPLETION_STATE_REFUSED'),{code:'COMPLETION_STATE_REFUSED'});}});
  h.script=async function*({init,text,result,stopped}){yield init;yield text('final answer');yield result;await stopped;};
  await assert.rejects(h.execute(),/EXECUTION_FAILED/);assert.equal(h.counts.claims,0);await assertHoldSettled(h,{outcome:'failed',deltas:['final answer']});},
 'checkpoint capture failure after the claimed pause records the explicit hold failure and UNKNOWN barrier':async make=>{
  const h=await make({captureFails:true}),inFlight=Promise.withResolvers(),release=Promise.withResolvers(),committed=Promise.withResolvers(),refused=Promise.withResolvers();
  h.hooks.afterRead=async n=>{if(n===1){inFlight.resolve();await release.promise;}};h.hooks.refused=event=>{if(event.type==='message.delta')refused.resolve();};
  h.script=async function*({init,text,stopped}){yield init;await committed.promise;yield text('after the hold');await stopped;};
  const run=h.execute();await inFlight.promise;await h.control('pause');committed.resolve();await refused.promise;release.resolve();
  await assert.rejects(run,/EXECUTION_FAILED/);assert.equal(h.counts.claims,1);assert.equal(h.counts.captures,1);assert.equal(h.counts.interrupts,1);await assertHoldSettled(h,{outcome:'failed'});},
 'a refused publication without any hold still fails as an ordinary execution failure':async make=>{
  const h=await make();h.hooks.beforeAppend=async event=>{if(event.type==='message.delta')throw Object.assign(Error('STORE_UNAVAILABLE'),{code:'STORE_UNAVAILABLE'});};
  h.script=async function*({init,text,stopped}){yield init;yield text('lost to a store outage');await stopped;};
  await assert.rejects(h.execute(),/EXECUTION_FAILED/);assert.equal(h.counts.claims,0);const saved=await h.history(),row=await h.row();
  assert.equal(row.state,'failed');assert.equal(row.hold,null);assert.deepEqual(saved.events.at(-1).data,{state:'failed',reasonCode:'EXECUTION_FAILED'});}
};
