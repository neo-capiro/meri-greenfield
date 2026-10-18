/** Real run/lifecycle/retirement/schedule owners over SQL and provider protocol doubles; no live worker or native stop. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createScheduledRunCancellation} from '../scheduled-run-cancellation.mjs';
import {scheduledJobFixture,id,hash} from './scheduled-job-fixture.mjs';
import {workflowId} from '../../conversations/temporal-dispatch.mjs';
import {snapshotScheduleCall} from '../../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {scheduleSdkOptions} from '../temporal-schedule-mutations.mjs';
async function fixture(){
 const h=await scheduledJobFixture();await h.scheduled.dispatch({occurrence:h.occurrence});await h.running();
 const connect=h.scheduleSql.pool.connect;h.scheduleSql.pool.connect=async()=>{const sql=await connect();return {...sql,async query(text,args=[]){
  if(text.startsWith('SELECT tenant_id,generation,occurrence_key,schedule_id,occurrence,effect,effect_sha256,state FROM meri_schedules.occurrences')&&text.includes('LIMIT 2'))return {rows:structuredClone([...h.scheduleSql.state.occurrences.values()].filter(r=>r.tenant_id===args[0]&&r.schedule_id===args[1]&&r.state==='OPEN').slice(0,2))};
  return sql.query(text,args);
 }};};
 const observed=[],executions=new Map(),hooks={};
 const client={connection:h.temporal.client.connection,workflow:{getHandle(id){observed.push(id);return {async describe(){await hooks.describe?.(id);return {workflowId:id,runId:executions.get(id),startTime:new Date(h.now()),extra:undefined};}};}}};
 const execution=b=>{const runId=id(5000+executions.size);executions.set(workflowId(b),runId);return {workflowId:workflowId(b),runId};};execution(h.identity.binding);
 const owner=createScheduledRunCancellation({scheduleOwner:h.scheduleOwner,store:h.store,runControl:h.options.runControl,retirement:h.options.retirement,client,now:h.now,maxRequestMs:1000});
 const request={scheduleId:h.occurrence.projection.scheduleId,mode:'pause',running:'request_cancel',runs:[],note:'Explicit approved cancellation'};
 const prepare=()=>owner.prepare({callerIdentity:h.template.principal,scopes:h.scopes,request,deadlineMs:h.now()+1000});
 function approved(runs){const intent={intentId:id(5800),operation:'cancel_scheduled_task',expectedGeneration:1,generation:2,previousProjectionSha256:hash(h.intent.projection),projection:{...h.intent.projection,state:'paused'},configuration:null,cancel:{...request}};delete intent.cancel.scheduleId;intent.cancel.runs=runs;
  return snapshotScheduleCall('Execute',{intent,callerIdentity:h.template.principal,deadlineMs:h.now()+1000,approval:{proposalId:intent.intentId,commandSha256:hash(intent),decision:'approved',approver:h.template.principal,policyRevision:h.template.policyRevision,decidedAt:new Date(h.now()).toISOString(),expiresAt:new Date(h.now()+1000).toISOString()}},h.now());}
 return {...h,client,owner,observed,executions,providerHooks:hooks,execution,request,prepare,approved};
}
test('the schedule wrapper never automatically restarts model work even when a request asks for retries',async t=>{
 const h=await fixture();t.after(h.close);const intent=structuredClone(h.intent);intent.projection.retryLimit=4;assert.equal(scheduleSdkOptions(intent).action.retry.maximumAttempts,1);
});
test('proposal targets actual effect and explicit cancel uses canonical run control plus proven retirement',async t=>{
 const h=await fixture();t.after(h.close);const runs=await h.prepare();assert.deepEqual(runs,[{workflowId:workflowId(h.identity.binding),runId:id(5000)}]);
 await h.owner.cancel({binding:h.approved(runs),deadlineMs:h.now()+1000});
 assert.deepEqual(h.calls.cancel,[h.identity.binding]);assert.deepEqual(h.calls.retire,[h.identity.binding]);assert.equal(h.row(h.identity.binding).projection.state,'cancelled');
 assert.equal(h.scheduleSql.state.occurrences.get(h.template.principal.tenantId+':'+h.identity.occurrenceKey).state,'DISPATCHED');
 assert(h.observed.every(id=>id===workflowId(h.identity.binding)));assert(!h.observed.includes(h.occurrence.workflowId));
});
test('an approved wrapper or arbitrary execution is rejected before actual cancellation',async t=>{
 const h=await fixture();t.after(h.close);await assert.rejects(h.owner.cancel({binding:h.approved([{workflowId:h.occurrence.workflowId,runId:id(5000)}]),deadlineMs:h.now()+1000}));assert.equal(h.calls.cancel.length,0);assert.equal(h.calls.retire.length,0);
});
test('resume after proposal makes old targets stale rather than cancelling a different effect',async t=>{
 const h=await fixture();t.after(h.close);const original=await h.prepare();await h.pause();const target=await h.resume();h.execution(target);
 await assert.rejects(h.owner.cancel({binding:h.approved(original),deadlineMs:h.now()+1000}));assert.equal(h.calls.cancel.length,0);
 const runs=await h.prepare();assert.equal(runs.length,2);await h.owner.cancel({binding:h.approved(runs),deadlineMs:h.now()+1000});assert.deepEqual(h.calls.cancel,[target]);assert.equal(h.row(target).projection.state,'cancelled');
});
test('a resume between approved reference selection and actual job cancellation cannot retarget the human approval',async t=>{
 const h=await fixture();t.after(h.close);await h.pause();const runs=await h.prepare();let target;
 h.providerHooks.describe=async()=>{if(target)return;target=await h.resume();h.execution(target);};
 await assert.rejects(h.owner.cancel({binding:h.approved(runs),deadlineMs:h.now()+1000}));
 assert(target);assert.equal(h.calls.cancel.length,0);assert.equal(h.calls.retire.length,0);assert.equal(h.row(target).projection.state,'queued');
 assert.equal(h.scheduleSql.state.occurrences.get(h.template.principal.tenantId+':'+h.identity.occurrenceKey).state,'OPEN');
});
test('execution identity drift at the actual control boundary releases no unapproved cancellation',async t=>{
 const h=await fixture();t.after(h.close);const runs=await h.prepare();let reads=0;
 h.providerHooks.describe=()=>{if(++reads===2)h.executions.set(workflowId(h.identity.binding),id(5999));};
 await assert.rejects(h.owner.cancel({binding:h.approved(runs),deadlineMs:h.now()+1000}));assert.equal(h.calls.cancel.length,0);assert.equal(h.calls.retire.length,0);
});
test('provider execution identity must be observed; missing/malformed/unsafe fields never become targets',async t=>{
 const h=await fixture();t.after(h.close);h.executions.clear();await assert.rejects(h.prepare());assert.equal(h.calls.cancel.length,0);
 h.executions.set(workflowId(h.identity.binding),'not-an-execution');await assert.rejects(h.prepare());assert.equal(h.calls.cancel.length,0);
 const bad={connection:h.client.connection,workflow:{getHandle(){return {describe:async()=>({get workflowId(){assert.fail('getter ran');},runId:id(5000)})};}}};
 const owner=createScheduledRunCancellation({scheduleOwner:h.scheduleOwner,store:h.store,runControl:h.options.runControl,retirement:h.options.retirement,client:bad,now:h.now,maxRequestMs:1000});await assert.rejects(owner.prepare({callerIdentity:h.template.principal,scopes:h.scopes,request:h.request,deadlineMs:h.now()+1000}));
});
test('foreign owner/scope and origin drift cannot select an actual job',async t=>{
 const h=await fixture();t.after(h.close);
 for(const change of [{callerIdentity:{...h.template.principal,actorId:'foreign'}},{scopes:[{...h.scopes[0],policyRevision:'foreign'}]}])await assert.rejects(h.owner.prepare({callerIdentity:h.template.principal,scopes:h.scopes,request:h.request,deadlineMs:h.now()+1000,...change}));
 h.providerHooks.describe=()=>{h.scheduleSql.state.occurrences.get(h.template.principal.tenantId+':'+h.identity.occurrenceKey).state='DISPATCHED';};await assert.rejects(h.prepare());assert.equal(h.calls.cancel.length,0);
});
test('lost or unproven native retirement keeps the occurrence OPEN and never claims completed cancellation',async t=>{
 const h=await fixture();t.after(h.close);const runs=await h.prepare();h.hooks.retire=()=>{throw Error('synthetic stop acknowledgement unavailable');};await assert.rejects(h.owner.cancel({binding:h.approved(runs),deadlineMs:h.now()+1000}));
 assert.equal(h.scheduleSql.state.occurrences.get(h.template.principal.tenantId+':'+h.identity.occurrenceKey).state,'OPEN');assert.equal(h.calls.cancel.length,1);assert.equal(h.row(h.identity.binding).projection.state,'cancelled');
});
