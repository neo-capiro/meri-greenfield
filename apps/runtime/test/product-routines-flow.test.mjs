/** Actual receiving feature/service/job/activity/history owners, with only named external protocol/resource boundaries synthetic. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
let forbiddenStarts=0;
mock.module('@temporalio/worker',{namedExports:{NativeConnection:{connect(){forbiddenStarts++;throw Error('worker connection forbidden');}},Worker:{create(){forbiddenStarts++;throw Error('worker start forbidden');}}}});
mock.module('../artifacts/composition.mjs',{namedExports:{runtimeArtifactRecovery(){return null;}}});
const links=registerHooks({resolve(specifier,context,next){return specifier==='@capiro/meri-contracts/node'?{url:new URL('../../../packages/contracts/validate.mjs',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
let productRoutinesFlowFixture;
try{({productRoutinesFlowFixture}=await import('./product-routines-flow-fixture.mjs'));}finally{links.deregister();}
import {ROUTINE_PATHS} from '../../control/schedules/application-http.mjs';
import {routineRequest} from '../../control/schedules/test/application-fixture.mjs';
import {workflowId} from '../../control/conversations/temporal-dispatch.mjs';
import {receiveConversationHistoryRequest,receiveConversationHistoryResponse} from '../../../packages/contracts/dist/conversation-history.mjs';

async function successful(f,path,body,credential){const response=await f.post(path,body,credential);const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;}
const decision=(prepared,request)=>({operation:prepared.proposal.operation,request,proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'});
async function history(f,conversationId){const body={conversationId},response=await f.post('/api/conversations/transcript',body,'synthetic-native');assert.equal(response.status,200);
 const admitted=receiveConversationHistoryRequest('transcript',Buffer.from(JSON.stringify(body)));return receiveConversationHistoryResponse('transcript',200,new Uint8Array(await response.arrayBuffer()),admitted);
}

for(const active of [false,true])test(active?'one actual factory flow publishes partial inbox output then explicitly cancels and retires its real job':'one actual factory flow completes inbox output then cancels future firings without inventing an active target',async t=>{
 const f=await productRoutinesFlowFixture();t.after(()=>f.close());const request=routineRequest();
 const prepared=await successful(f,ROUTINE_PATHS.prepare,{requestId:'receiving-create',operation:'schedule_task',request});assert.equal(prepared.status,'approval_required');assert.equal(f.temporal.calls.create,0);
 const created=await successful(f,ROUTINE_PATHS.approve,decision(prepared,request));assert.equal(created.status,'acknowledged');assert.equal(f.temporal.calls.create,1);
 const listed=await successful(f,ROUTINE_PATHS.list,{});assert.equal(listed.page.rows.length,1);assert.equal(listed.page.rows[0].inspectionState,'observed');assert.equal(listed.page.rows[0].projection.scheduleId,prepared.proposal.projection.scheduleId);
 const selected=await f.occurrence(prepared.proposal.proposalId),occurrence=selected.occurrence,binding=selected.identity.binding,key=binding.tenantId+':'+selected.identity.occurrenceKey;
 assert.equal((await f.dispatch.dispatch({occurrence})).outcome,'ACTIVE');assert.equal(f.h.bindings.size,1);assert.equal(f.h.conversations.state.runs.size,1);assert.equal(f.h.temporal.calls.start,1);assert.equal(f.h.scheduleSql.state.occurrences.get(key).state,'OPEN');
 assert.equal((await f.dispatch.dispatch({occurrence})).outcome,'ACTIVE');assert.equal(f.h.temporal.calls.start,1);
 const execution=await f.execute(binding,{active});if(!active)assert.deepEqual(await execution.work,{state:'completed'});
 const inbox=await successful(f,'/api/conversations/list',{},'synthetic-native');assert.equal(inbox.conversations.length,1);assert.equal(inbox.conversations[0].conversationId,binding.conversationId);
 const transcript=await history(f,binding.conversationId);assert.equal(transcript.latestRun.state,active?'running':'completed');assert.equal(transcript.events.filter(e=>e.event.type==='message.delta').map(e=>e.event.data.text).join(''),active?'Partial routine result.':'Completed routine result.');assert.equal(JSON.stringify(transcript).includes('PRIVATE_MODEL_REASONING'),false);
 assert.equal(f.state.fetches.filter(c=>c.path.endsWith('/context')&&c.body.conversationId===binding.conversationId).length,0);assert.equal(f.state.queries,1);
 if(!active){await f.h.retire(binding);assert.equal((await f.dispatch.reconcile({occurrence})).outcome,'DISPATCHED');}
 const cancelRequest={scheduleId:prepared.proposal.projection.scheduleId,mode:'delete',note:'Explicit receiving cancellation',running:'request_cancel',runs:[]};
 const cancel=await successful(f,ROUTINE_PATHS.prepare,{requestId:'receiving-cancel',operation:'cancel_scheduled_task',request:cancelRequest});assert.equal(cancel.status,'approval_required');
 const expected=active?[{workflowId:workflowId(binding),runId:f.executions.get(workflowId(binding))}]:[];assert.deepEqual(cancel.proposal.cancel.runs,expected);assert.deepEqual(cancelRequest.runs,[]);assert.equal(f.h.calls.cancel.length,0);
 const result=await successful(f,ROUTINE_PATHS.approve,decision(cancel,cancelRequest));assert.equal(result.status,'acknowledged');assert.equal(f.temporal.calls.delete,1);
 if(active){await assert.rejects(execution.work,e=>e.code==='EXECUTION_STOPPED');assert.deepEqual(f.h.calls.cancel,[binding]);assert.deepEqual(f.h.calls.retire,[binding]);assert.equal(f.state.nativeStops,1);}
 else{assert.deepEqual(f.h.calls.cancel,[]);assert.deepEqual(f.h.calls.retire,[]);assert.equal(f.state.nativeStops,0);}
 assert.equal(f.h.scheduleSql.state.occurrences.get(key).state,'DISPATCHED');assert.equal(f.state.queryCloses,1);
 const calls={sdk:f.state.queries,start:f.h.temporal.calls.start,cancel:f.h.calls.cancel.length,stop:f.state.nativeStops,delete:f.temporal.calls.delete};assert.deepEqual(await successful(f,ROUTINE_PATHS.approve,decision(cancel,cancelRequest)),result);assert.deepEqual({sdk:f.state.queries,start:f.h.temporal.calls.start,cancel:f.h.calls.cancel.length,stop:f.state.nativeStops,delete:f.temporal.calls.delete},calls);
 const saved=await history(f,binding.conversationId);assert.equal(saved.latestRun.state,active?'cancelled':'completed');assert.equal(saved.events.filter(e=>e.event.type==='message.delta').map(e=>e.event.data.text).join(''),active?'Partial routine result.':'Completed routine result.');assert.equal(f.h.conversations.state.runs.size,1);assert.equal(forbiddenStarts,0);
});
