/** SYNTHETIC: task routes over the canonical operational-read validators with a scripted `operationalReads` port. The page builder
 * mirrors the literal synthetic data of packages/contracts/test/retrieval-operational-reads.test.mjs. No gateway or source access. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {assertTaskReadInput} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {createTaskRoutes} from '../routes.mjs';
const uuid='11111111-1111-4111-8111-111111111111',taskId='22222222-2222-4222-8222-222222222222',clientId='client-synthetic';
const tenantId='synthetic',actorId='reader',nowMs=Date.parse('2026-01-02T00:00:00.000Z');
const sha256=v=>createHash('sha256').update(v,'utf8').digest('hex');
const principal=Object.freeze({tenantId,actorId,role:'member',permissions:[],clientIds:[],membershipRevision:'m1'});
function taskPage(input,{tenant=tenantId}={}){
 const {selection}=assertTaskReadInput(input,{nowMs,actorId});
 const row={id:taskId,title:'Synthetic task',body:null,status:'todo',ownerUserId:actorId,dueDate:'2026-01-05T00:00:00.000Z',clientId,clientName:'Synthetic Client',meetingId:null,meetingTitle:null,
  contactId:null,mailThreadId:null,sourceType:'manual',sourceId:null,createdByUserId:actorId,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T12:00:00.000Z',recordKind:'native_task',recommendation:false};
 row.nativeCompletion={completed:false,evidence:null,establishesDeliveryOrAcceptance:false,note:'The native task does not claim completion.'};
 const canon=JSON.stringify(Object.fromEntries(['id','title','body','status','ownerUserId','dueDate','clientId','clientName','meetingId','meetingTitle','contactId','mailThreadId','sourceType','sourceId','createdByUserId','createdAt','updatedAt'].map(k=>[k,row[k]])));
 row.sourceProof={version:1,owner:'engagement_tasks',sourceRecordId:row.id,currentClientId:row.clientId,sourceVersion:row.updatedAt,contentSha256:sha256(canon),linkedSources:[]};
 const scope={tenantId:tenant,kind:'client',resourceId:clientId,policyRevision:'policy-v1'};
 return {kind:'task-read-page',contractVersion:'0.2.0',operation:{id:'query_tasks',version:'0.2.0'},requestId:uuid,traceId:uuid,
  binding:{tenantId:tenant,actorId,conversationId:uuid,runId:uuid,attemptId:uuid,workerId:uuid,writerFence:1},
  subject:{kind:'client',entityType:'client',entityIds:[clientId],tenantId:tenant,actorId,authorizationDecisionId:uuid,policyRevision:'policy-v1',scopes:[scope],rosterVersionId:null},
  window:{basis:'unbounded'},argumentsSha256:canonicalSha256(selection),appliedFilters:[],generatedAt:'2026-01-02T00:00:05.000Z',
  sources:[{sourceId:'engagement_tasks',authority:'authoritative',snapshotVersionId:null,adapterVersion:'0.2.0',status:'partial',synchronizedAt:null,asOf:null,retrievedAt:'2026-01-02T00:00:05Z',freshness:'unknown'}],
  coverage:{sourcesRequested:['engagement_tasks'],sourcesChecked:['engagement_tasks'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:null,returnedCount:1,truncated:false,historySupport:'bounded',limitations:['Synthetic pending operational-read transport; snapshot and record immutability unknown.']},
  selection,snapshotVersionId:null,continuation:{cursor:null,requiredReads:[],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'},
  order:'owner-order-unconfirmed',clientId,
  scope:{kind:'client',tenantId:tenant,actorUserId:actorId,ownerUserId:null,taskId:null,status:null,dueBefore:null,offset:0,limit:selection.limit,cursorApplied:false},
  total:1,returned:1,tasks:[row],
  pageCoverage:{sourceStatus:'healthy',sourceReason:null,complete:true,partial:false,paginationComplete:true,hasMore:false,nextCursor:null,totalIsExactForScope:true,absenceSupported:false,note:'All currently authorized native tasks matching the declared scope and filters were returned.'}};
}
function setup(answer){const calls=[];const routes=createTaskRoutes({now:()=>nowMs,operationalReads:{async read(call){calls.push(call);return answer(call);}}});
 const call=(path,body)=>routes[path].handle({principal,body,signal:undefined,deadlineMs:nowMs+1000});return {calls,call};}
const failed=async(promise,code)=>assert.rejects(promise,e=>productFailure(e)?.code===code);

test('task list validates canonical input, delegates to the operational-read owner and releases a matching page',async()=>{
 const t=setup(({input})=>taskPage(input));
 const page=await t.call('/api/tasks/list',{clientId});
 assert.equal(page.tasks[0].id,taskId);assert.deepEqual(t.calls.map(c=>[c.operation,c.input,c.principal.actorId]),[['query_tasks',{clientId},'reader']]);
 await failed(t.call('/api/tasks/list',{clientId,tenantId:'other'}),'TASKS_REQUEST_INVALID');
 await failed(t.call('/api/tasks/list',{limit:'5'}),'TASKS_REQUEST_INVALID');assert.equal(t.calls.length,1);
});
test('a page for another tenant or actor, or an inconsistent page, is never released',async()=>{
 await failed(setup(({input})=>taskPage(input,{tenant:'other-tenant'})).call('/api/tasks/list',{clientId}),'TASKS_ACCESS_DENIED');
 await failed(setup(({input})=>({...taskPage(input),total:5})).call('/api/tasks/list',{clientId}),'TASKS_RESULT_INVALID');
 await failed(setup(()=>{throw Error('gateway down');}).call('/api/tasks/list',{clientId}),'TASKS_UNAVAILABLE');
});
test('client-less action-item listing has no validated page contract and refuses before dispatch',async()=>{
 const t=setup(()=>{throw Error('unreached');});
 await failed(t.call('/api/tasks/action-items',{}),'TASKS_REQUEST_INVALID');await failed(t.call('/api/tasks/action-items',{clientId,extra:1}),'TASKS_REQUEST_INVALID');
 assert.equal(t.calls.length,0);
 const s=setup(()=>({kind:'bogus'}));await failed(s.call('/api/tasks/action-items',{clientId}),'TASKS_RESULT_INVALID');assert.equal(s.calls[0].operation,'query_action_items');
});
