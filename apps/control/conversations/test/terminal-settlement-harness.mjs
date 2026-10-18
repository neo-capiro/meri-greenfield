/** Terminal settlement over the real worker activity, lifecycle service/journal/store and run reconciler. The SDK transport,
 * native checkpoint capture and the native stop owner are scripted; the stop owner records retirement in the canonical
 * allocation journal exactly as the allocator does. The SQL engine is the caller's pool (scripted fixture by default). */
import assert from 'node:assert/strict';
import {holdComposition,assertHoldSettled} from './lifecycle-hold-harness.mjs';
import {id,binding as fixtureBinding,allocateOriginal,recordRetired} from './lifecycle-fixture.mjs';
import {createRunReconciler,ATTEMPT_LOST} from '../run-reconciler.mjs';
export {allocateOriginal,recordRetired};
const terminalEvent=event=>event.type==='run.status'&&['failed','cancelled'].includes(event.data.state);
/** Finite simulated recording/transport latency that honours the caller's abort signal, as in the review reproduction. */
export function delay(ms,signal){return new Promise((resolve,reject)=>{if(signal?.aborted)return reject(signal.reason);const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});}
export async function settlementComposition(options={}){
 const h=await holdComposition(options),f=h.f,binding=options.binding??fixtureBinding;h.retirements=0;h.retireMode='record';
 h.allocate=async()=>{h.allocation=await allocateOriginal(f.store,(await h.history()).run.binding);};
 // Synthetic native stop owner: 'record' retires through the canonical journal; 'silent' and 'throw' leave the stop unproven.
 const retirement={async retire({binding:b}){h.retirements++;assert.deepEqual(b,h.allocation?.key.binding??b);if(h.retireMode==='throw')throw Error('synthetic native stop uncertain');if(h.retireMode==='record')await recordRetired(f.store,h.allocation);}};
 h.reconciler=createRunReconciler({store:f.store,retirement});
 h.reconcile=(b=binding)=>h.reconciler.reconcile({binding:b});
 h.terminals=async()=>(await h.history()).events.filter(e=>e.type==='run.status'&&['failed','cancelled','completed'].includes(e.data.state));
 return h;
}
const captureFailureScript=h=>{const inFlight=Promise.withResolvers(),release=Promise.withResolvers(),committed=Promise.withResolvers(),refused=Promise.withResolvers();
 h.hooks.afterRead=async n=>{if(n===1){inFlight.resolve();await release.promise;}};h.hooks.refused=event=>{if(event.type==='message.delta')refused.resolve();};
 h.script=async function*({init,text,stopped}){yield init;await committed.promise;yield text('after the hold');await stopped;};
 return async run=>{await inFlight.promise;await h.control('pause');committed.resolve();await refused.promise;release.resolve();return run;};};
const completionWindowScript=h=>{h.script=async function*({init,text,result,stopped}){yield init;yield text('final answer');yield result;await stopped;};};
/** Every scenario receives a factory for a fresh composition. */
export const settlementScenarios={
 'native capture refuses after the pause claim and terminal recording takes 45 ms: ends failed/HOLD_CHECKPOINT_FAILED with the UNKNOWN barrier':async make=>{
  const h=await make({captureFails:true}),drive=captureFailureScript(h);h.hooks.beforeAppend=async(event,signal)=>{if(terminalEvent(event))await delay(45,signal);};
  await assert.rejects(drive(h.execute()),/EXECUTION_FAILED/);assert.equal(h.counts.claims,1);await assertHoldSettled(h,{outcome:'failed'});},
 'pause commits during completed publication and terminal recording takes 45 ms: the PENDING hold ends failed/HOLD_CHECKPOINT_FAILED and UNKNOWN':async make=>{
  const h=await make();completionWindowScript(h);h.hooks.beforeAppend=async(event,signal)=>{if(event.type==='run.status'&&event.data.state==='completed')await h.control('pause');if(terminalEvent(event))await delay(45,signal);};
  await assert.rejects(h.execute(),/EXECUTION_FAILED/);assert.equal(h.counts.claims,0);await assertHoldSettled(h,{outcome:'failed',deltas:['final answer']});},
 'an ordinary failure whose terminal recording takes 250 ms is acknowledged as failed/EXECUTION_FAILED':async make=>{
  const h=await make();h.hooks.beforeAppend=async(event,signal)=>{if(event.type==='message.delta')throw Object.assign(Error('STORE_UNAVAILABLE'),{code:'STORE_UNAVAILABLE'});if(terminalEvent(event))await delay(250,signal);};
  h.script=async function*({init,text,stopped}){yield init;yield text('lost to a store outage');await stopped;};
  await assert.rejects(h.execute(),/EXECUTION_FAILED/);const row=await h.row();assert.equal(row.state,'failed');assert.equal(row.hold,null);
  assert.deepEqual((await h.terminals()).map(e=>e.data),[{state:'failed',reasonCode:'EXECUTION_FAILED'}]);},
 'a committed terminal write whose acknowledgement is lost is read back by replaying the same event, never a second terminal event':async make=>{
  const h=await make({captureFails:true}),drive=captureFailureScript(h);let lost=0;h.hooks.afterAppend=async event=>{if(terminalEvent(event)&&lost++===0)throw Error('synthetic lost acknowledgement');};
  const appended=[];h.hooks.beforeAppend=async event=>{if(terminalEvent(event))appended.push(event);};
  await assert.rejects(drive(h.execute()),/EXECUTION_FAILED/);await assertHoldSettled(h,{outcome:'failed'});
  const terminals=await h.terminals();assert.equal(terminals.length,1);assert.equal(lost,2,'the replay was acknowledged');
  assert.deepEqual(appended.map(e=>e.data.reasonCode),['HOLD_CHECKPOINT_FAILED','EXECUTION_FAILED','HOLD_CHECKPOINT_FAILED']);
  assert.equal(appended[2].eventId,terminals[0].eventId,'the acknowledged replay reused the committed event ID');assert.equal(appended[0].eventId,terminals[0].eventId);},
 'terminal writes never acknowledged within any attempt leave the run running; reconciliation after retirement settles HOLD_CHECKPOINT_FAILED once':async make=>{
  const h=await make({captureFails:true,terminalAttemptMs:20}),drive=captureFailureScript(h);h.hooks.afterSubmit=()=>h.allocate();h.hooks.beforeAppend=async(event,signal)=>{if(terminalEvent(event))await delay(60,signal);};
  await assert.rejects(drive(h.execute()),/EXECUTION_FAILED/);await delay(80);
  assert.deepEqual(await h.row(),{hold:h.controlId('pause'),state:'running'},'durable evidence: the original left the run nonterminal');assert.equal(await h.control_state('pause'),'UNKNOWN');assert.equal(await h.checkpointed(),0);
  h.hooks.beforeAppend=undefined;assert.deepEqual(await h.reconcile(),{outcome:'reconciled',state:'failed',reasonCode:'HOLD_CHECKPOINT_FAILED'});assert.equal(h.retirements,1);
  await assertHoldSettled(h,{outcome:'failed'});assert.deepEqual(await h.reconcile(),{outcome:'settled',state:'failed'},'a replayed reconciliation is idempotent');
  assert.equal(h.retirements,1);assert.equal((await h.terminals()).length,1);},
 'a completion-window PENDING hold never acknowledged is reconciled to HOLD_CHECKPOINT_FAILED and UNKNOWN':async make=>{
  const h=await make({terminalAttemptMs:20});completionWindowScript(h);h.hooks.afterSubmit=()=>h.allocate();
  h.hooks.beforeAppend=async(event,signal)=>{if(event.type==='run.status'&&event.data.state==='completed')await h.control('pause');if(terminalEvent(event))await delay(60,signal);};
  await assert.rejects(h.execute(),/EXECUTION_FAILED/);await delay(80);assert.deepEqual(await h.row(),{hold:h.controlId('pause'),state:'running'});assert.equal(await h.control_state('pause'),'PENDING');
  h.hooks.beforeAppend=undefined;assert.equal((await h.reconcile()).reasonCode,'HOLD_CHECKPOINT_FAILED');await assertHoldSettled(h,{outcome:'failed',deltas:['final answer']});},
 'an ordinary failure never acknowledged is reconciled to failed/ATTEMPT_LOST':async make=>{
  const h=await make({terminalAttemptMs:20});h.hooks.afterSubmit=()=>h.allocate();h.hooks.beforeAppend=async(event,signal)=>{if(event.type==='message.delta')throw Object.assign(Error('STORE_UNAVAILABLE'),{code:'STORE_UNAVAILABLE'});if(terminalEvent(event))await delay(60,signal);};
  h.script=async function*({init,text,stopped}){yield init;yield text('lost');await stopped;};await assert.rejects(h.execute(),/EXECUTION_FAILED/);await delay(80);assert.equal((await h.row()).state,'running');
  h.hooks.beforeAppend=undefined;assert.deepEqual(await h.reconcile(),{outcome:'reconciled',state:'failed',reasonCode:ATTEMPT_LOST});assert.deepEqual((await h.row()),{hold:null,state:'failed'});},
 'an unproven physical stop is a barrier: nothing is written and the hold stays UNKNOWN':async make=>{
  for(const mode of ['silent','throw']){const h=await make({captureFails:true,terminalAttemptMs:20}),drive=captureFailureScript(h);h.hooks.afterSubmit=()=>h.allocate();h.hooks.beforeAppend=async(event,signal)=>{if(terminalEvent(event))await delay(60,signal);};
   await assert.rejects(drive(h.execute()),/EXECUTION_FAILED/);await delay(80);h.hooks.beforeAppend=undefined;h.retireMode=mode;
   assert.deepEqual(await h.reconcile(),{outcome:'unknown',state:'running'});assert.deepEqual(await h.row(),{hold:h.controlId('pause'),state:'running'});assert.equal(await h.control_state('pause'),'UNKNOWN');assert.equal((await h.terminals()).length,0);}},
 'only the exact original binding settles: a stale attempt or fence is refused without a write':async make=>{
  const h=await make({terminalAttemptMs:20});h.hooks.afterSubmit=()=>h.allocate();h.hooks.beforeAppend=async(event,signal)=>{if(event.type==='message.delta')throw Object.assign(Error('STORE_UNAVAILABLE'),{code:'STORE_UNAVAILABLE'});if(terminalEvent(event))await delay(60,signal);};
  h.script=async function*({init,text,stopped}){yield init;yield text('lost');await stopped;};await assert.rejects(h.execute(),/EXECUTION_FAILED/);await delay(80);h.hooks.beforeAppend=undefined;
  const b=(await h.history()).run.binding;for(const stale of [{...b,attemptId:id(250)},{...b,writerFence:b.writerFence+1}])await assert.rejects(h.reconcile(stale),/STALE_WRITER/);
  assert.equal(h.retirements,0);assert.equal((await h.row()).state,'running');},
 'a queued run whose attempt ended before any allocation claim is failed, and a later claim is refused':async make=>{
  const h=await make();await h.f.service.allocateInput({credential:h.f.credential,input:h.f.input});await h.f.service.submit({credential:h.f.credential,input:h.f.input});
  assert.deepEqual(await h.reconcile(),{outcome:'reconciled',state:'failed',reasonCode:ATTEMPT_LOST});assert.equal(h.retirements,0);
  await assert.rejects(h.allocate(),/NATIVE_PREPARATION_STATE_REFUSED/);assert.deepEqual(await h.reconcile(),{outcome:'settled',state:'failed'});},
 'success still converges: 45 ms recording on every publication completes and reconciliation leaves it untouched':async make=>{
  const h=await make();h.hooks.afterSubmit=()=>h.allocate();h.hooks.beforeAppend=async(event,signal)=>{if(event.type==='run.status')await delay(45,signal);};
  h.script=async function*({init,text,result,stopped}){yield init;yield text('answer');yield result;await stopped;};
  assert.deepEqual(await h.execute(),{state:'completed'});h.hooks.beforeAppend=undefined;assert.deepEqual(await h.reconcile(),{outcome:'settled',state:'completed'});assert.equal(h.retirements,1);
  assert.deepEqual((await h.terminals()).map(e=>e.data.state),['completed']);}
};
