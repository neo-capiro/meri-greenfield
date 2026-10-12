import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract,scheduleToolValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createScheduleToolInterface} from '../schedules/tool-interface.mjs';
import {fixture,approve,authority,NOW} from '../../../packages/contracts/test/schedule-tool-interface-fixtures.mjs';
const operations=['schedule_task','update_scheduled_task','cancel_scheduled_task','list_scheduled_tasks'];
for(const operation of operations)test(`canonical ${operation} uses accepted tool entry and full trusted correlation`,async()=>{
 const f=fixture(operation),calls=[];
 const lifecycle={execute:async q=>{calls.push(q);return {operation:q.intent.operation,intentId:q.intent.intentId,generation:q.intent.generation,projection:q.intent.projection,outcome:'ACKNOWLEDGED',physicalStopProven:false};},list:async q=>{calls.push(q);return {operation:'list_scheduled_tasks',rows:[],hasMore:false,nextAfterScheduleId:null,originalRuns:{executions:[],coverage:{observedReferences:0,returned:0,omitted:0,historyComplete:false,currentRetryVerified:false}},coverage:{complete:false,currentRetryVerified:false}};}};
 const app=createScheduleToolInterface({lifecycle,validators:scheduleToolValidators,authorize:authority,clock:()=>NOW}),contract=resolveOperationContract({id:operation,version:'0.2.0'});
 const normalized=contract.normalizeInput(f.request,f.context);assert.deepEqual(normalized.input,f.request);
 const output=await app.execute(f);assert.deepEqual(contract.assertOutput(output,{...f.context,request:f.request}),output);
 if(operation!=='list_scheduled_tasks'){
  assert.equal(output.status,'approval_required');assert.equal(calls.length,0);
  const approved=approve(fixture(operation)),done=await app.execute(approved);
  assert.equal(done.status,'acknowledged');assert.equal(calls.length,1);
  assert.deepEqual(contract.assertOutput(done,{...approved.context,request:approved.request}),done);
  const changed=structuredClone(done);changed.receipt.generation++;
  assert.throws(()=>contract.assertOutput(changed,{...approved.context,request:approved.request}));
 }else {assert.equal(output.status,'listed');assert.equal(calls.length,1);assert.equal(output.page.originalRuns.coverage.historyComplete,false);}
 assert.throws(()=>contract.normalizeInput({...f.request,owner:{tenantId:'foreign',actorId:'foreign'}},f.context));
 assert.throws(()=>contract.normalizeInput(f.request,{...f.context,authorized:true}));
 assert.equal(contract.descriptor.handler,null);assert.equal(contract.descriptor.availability,'unimplemented');
});
