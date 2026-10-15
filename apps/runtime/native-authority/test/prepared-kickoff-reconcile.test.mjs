/** Synthetic (scripted SQL protocol fixture): the prepared kickoff's independent stop settles a run its original left
 * nonterminal, through the real control store and run reconciler. The controller is scripted; its close plays the native
 * stop owner by recording RETIRED in the canonical allocation journal, or leaves the stop unproven. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createExecutionBinding} from '../../../control/conversations/execution-boundary.mjs';
import {lifecycleFixture,binding,id,versions} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {allocateOriginal,recordRetired} from '../../../control/conversations/test/terminal-settlement-harness.mjs';
import {createPreparedTaskKickoff} from '../prepared-kickoff.mjs';
async function fixture(t,{proven=true,reconcile=true,state='running'}={}){
 const f=await lifecycleFixture();t.after(()=>f.close());await f.service.submit({credential:f.credential,input:f.input});const allocation=await allocateOriginal(f.store,binding);let n=600,closes=0;
 for(const s of ['starting','running'].slice(0,state==='running'?2:state==='starting'?1:0))await f.service.publish({credential:f.credential,binding,event:{eventId:id(n++),createdAt:new Date().toISOString(),type:'run.status',data:{state:s,reasonCode:null}}});
 const original=createExecutionBinding({binding,versions,plan:{synthetic:'kickoff-reconcile'},expiresAtMs:Date.now()+30000});
 const controller={allocate:async()=>{throw Error('not dispatched in this test');},close:async()=>{closes++;if(proven)await recordRetired(f.store,allocation);}};
 const owner=createPreparedTaskKickoff({original,controller,store:f.store,runner:{readiness:async()=>{throw Error('unused');},release:async()=>{throw Error('unused');}},enabled:true,maxWaitMs:1000,pollMs:10,cleanupMs:1000,...(reconcile?{reconcile:true}:{})});
 const history=async()=>(await f.store.read(binding,{after:0,limit:100},()=>{}));
 return {f,owner,original,history,closes:()=>closes,stop:()=>owner.stop({binding,executionId:original.executionId})};
}
for(const state of ['queued','starting','running'])test(`stop after the original left a ${state} run settles it failed/ATTEMPT_LOST once the stop is proven`,async t=>{
 const k=await fixture(t,{state});const receipt=await k.stop();assert.equal(receipt.executionId,k.original.executionId);assert.equal(k.closes(),1);
 const saved=await k.history();assert.equal(saved.run.state,'failed');assert.deepEqual(saved.events.at(-1).data,{state:'failed',reasonCode:'ATTEMPT_LOST'});
 await k.stop();assert.equal((await k.history()).events.filter(e=>e.data?.state==='failed').length,1,'a repeated stop is idempotent');});
test('an unproven physical stop rejects the stop receipt and writes nothing (barrier)',async t=>{
 const k=await fixture(t,{proven:false});await assert.rejects(k.stop(),/KICKOFF_UNKNOWN/);const saved=await k.history();assert.equal(saved.run.state,'running');assert.equal(saved.events.at(-1).data.state,'running');});
test('a run that already published its own terminal outcome is left untouched',async t=>{
 const k=await fixture(t);await k.f.service.publish({credential:k.f.credential,binding,event:{eventId:id(700),createdAt:new Date().toISOString(),type:'run.status',data:{state:'completed',reasonCode:null}}});
 await k.stop();const saved=await k.history();assert.equal(saved.run.state,'completed');assert.equal(saved.events.filter(e=>e.type==='run.status'&&['failed','completed'].includes(e.data.state)).length,1);});
test('without reconciliation configured, stop keeps the earlier behaviour and the run stays running',async t=>{
 const k=await fixture(t,{reconcile:false});await k.stop();assert.equal((await k.history()).run.state,'running');});
