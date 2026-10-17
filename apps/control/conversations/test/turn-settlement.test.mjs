/** Synthetic (scripted SQL protocol fixture): an explicit second turn racing the source's settlement, over the canonical next-run owner
 * and journal, lifecycle store and history facade. Retirement/revocation ports read the canonical allocation journal and a synthetic receipt. */
import test from 'node:test';import assert from 'node:assert/strict';
import {binding} from './lifecycle-fixture.mjs';
import {fixture,check} from './next-run-recovery-fixture.mjs';
import {hash} from '../boundary.mjs';
import {createConversationHistoryService} from '../history/service.mjs';
import {productFailure} from '../../product-access/errors.mjs';
const principal={tenantId:binding.tenantId,actorId:binding.actorId},turn=x=>x.owner.admitTurn({principal,conversationId:binding.conversationId,sourceRunId:binding.runId});

test('a completed source still retiring its original refuses an explicit turn as unsettled without reserving; the retry after retirement reserves once',async()=>{const x=await fixture();try{
 await x.first();await x.complete(binding);
 await assert.rejects(turn(x),error=>error.code==='NEXT_RUN_SOURCE_UNSETTLED'&&/NEXT_RUN_RETIREMENT_REQUIRED/.test(error.cause?.message));assert.equal(x.f.state.nextRuns.size,0);
 // The session path keeps the precise refusal code.
 await assert.rejects(x.select(),/NEXT_RUN_RETIREMENT_REQUIRED/);assert.equal(x.f.state.nextRuns.size,0);
 await x.retire(binding);const first=await turn(x),again=await turn(x);
 assert.equal(first.state,'RESERVED');assert.equal(first.replayed,false);assert.equal(first.targetBinding.writerFence,2);
 assert.deepEqual(again.targetBinding,first.targetBinding);assert.equal(again.replayed,true);assert.equal(x.f.state.nextRuns.size,1);
}finally{x.f.close();}});

test('a still-live source is not a turn source; once failed, its unretired original keeps an explicit turn unsettled',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);
 await assert.rejects(turn(x),error=>error.code==='NEXT_RUN_SOURCE_NOT_TERMINAL');
 await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);
 const a=await x.f.store.allocations.read({binding,allocationKey:hash(binding)},check);assert.equal(a.record.state==='RETIRED',false);
 await assert.rejects(turn(x),error=>error.code==='NEXT_RUN_SOURCE_UNSETTLED');assert.equal(x.f.state.nextRuns.size,0);
}finally{x.f.close();}});

test('an aborted explicit turn stays an abort, not an unsettled conflict',async()=>{const x=await fixture();try{
 await x.first();await x.complete(binding);const controller=new AbortController();controller.abort();
 await assert.rejects(x.owner.admitTurn({principal,conversationId:binding.conversationId,sourceRunId:binding.runId,signal:controller.signal}),error=>error.code!=='NEXT_RUN_SOURCE_UNSETTLED');
}finally{x.f.close();}});

/** History facade mapping, over a scripted transcript port: the canonical store paging is covered by history-http. */
function facade(admitTurn){
 const latestRun={binding,state:'completed'},conversation={conversationId:binding.conversationId,scopes:[]};
 return createConversationHistoryService({store:{history:{async list(){return {conversations:[]};},async transcript(){return {latestRun,conversation};}}},nextRunOwner:{admitTurn},gate:{async recheck(){}}});
}
const call=service=>service.nextTurn({principal:{...principal,clientIds:[]},request:{conversationId:binding.conversationId,sourceRunId:binding.runId},recheckConversation:async()=>{}});
test('the next-turn facade reports an unsettled or still-live source as a definite retryable conflict and anything later as UNKNOWN',async()=>{
 for(const code of ['NEXT_RUN_SOURCE_UNSETTLED','NEXT_RUN_SOURCE_NOT_TERMINAL'])
  await assert.rejects(call(facade(async()=>{throw Object.assign(Error(code),{code});})),error=>{const f=productFailure(error);return f.code==='CONVERSATION_TURN_CONFLICT'&&f.outcome==='NOT_DISPATCHED';});
 await assert.rejects(call(facade(async()=>{throw Object.assign(Error('STORE_UNAVAILABLE'),{code:'STORE_UNAVAILABLE'});})),error=>productFailure(error).outcome==='UNKNOWN');
});
