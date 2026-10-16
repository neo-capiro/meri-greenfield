/** SYNTHETIC: schedule preparer over the real schedule tool interface and contract validators; the lifecycle is a
 * recording stub and the trusted context resolver returns the contract fixture's resolved context. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createScheduleToolInterface} from '../../schedules/tool-interface.mjs';
import {fixture,approve,validators,authority,NOW} from '../../../../packages/contracts/test/schedule-tool-interface-fixtures.mjs';
import {createScheduleIntentPreparer,SCHEDULE_INTENT_OPERATIONS} from '../schedule-preparer.mjs';
import {mount,delivery,id} from './fixture.mjs';
const binding={tenantId:'tenant',actorId:'delegate',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const code=c=>e=>e.code===c;
function setup({authorize=authority,resolve=f=>f.context}={}){
 const lifecycle={calls:[],async execute(r){lifecycle.calls.push(r);return {operation:r.intent.operation,intentId:r.intent.intentId,generation:r.intent.generation,projection:r.intent.projection,outcome:'ACKNOWLEDGED',physicalStopProven:false};},async list(){throw Error('not used');}};
 const tool=createScheduleToolInterface({lifecycle,validators,authorize,clock:()=>NOW});const resolved=[];
 const preparers=SCHEDULE_INTENT_OPERATIONS.map(operation=>createScheduleIntentPreparer({operation,tool,binding,resolveContext:async({operation:op,request})=>{const f=fixture(op);resolved.push(request);return resolve(f);}}));
 return {lifecycle,resolved,...mount({binding,preparers,now:()=>NOW,scopes:[{tenantId:'tenant',kind:'client',resourceId:'client',policyRevision:'p1'}]})};
}
for(const op of SCHEDULE_INTENT_OPERATIONS)test(`${op}: prepare-only proposal under current authority, no lifecycle mutation`,async()=>{
 const s=setup(),out=await s.mount.prepare({operation:{id:op,version:'0.2.0'},arguments:fixture(op).request,deliveryId:delivery(1)});
 assert.equal(out.status,'approval_required');assert.equal(out.proposal.status,'approval_required');assert.equal(out.proposal.operation,op);assert.deepEqual(s.lifecycle.calls,[]);
});
test('a context that already carries an approval is refused before the tool: the intent path never applies a schedule',async()=>{
 const s=setup({resolve:f=>approve(f).context});
 await assert.rejects(s.mount.prepare({operation:{id:'schedule_task',version:'0.2.0'},arguments:fixture().request,deliveryId:delivery(1)}),code('REFUSED'));assert.deepEqual(s.lifecycle.calls,[]);
});
test('a resolved caller other than the run actor is refused (cross-actor/tenant)',async()=>{
 for(const callerIdentity of [{tenantId:'tenant',actorId:'someone-else'},{tenantId:'other',actorId:'delegate'}]){
  const s=setup({resolve:f=>{f.context.scheduleContext.callerIdentity=callerIdentity;return f.context;}});
  await assert.rejects(s.mount.prepare({operation:{id:'schedule_task',version:'0.2.0'},arguments:fixture().request,deliveryId:delivery(1)}),code('REFUSED'));assert.deepEqual(s.lifecycle.calls,[]);
 }
});
test('current authority revoked before release refuses with no effect and replays the refusal',async()=>{
 let revoked=true;const s=setup({authorize:q=>{if(revoked&&q.phase==='before_tool_release')throw Error('revoked');return authority(q);}});
 const request={operation:{id:'schedule_task',version:'0.2.0'},arguments:fixture().request,deliveryId:delivery(1)};
 await assert.rejects(s.mount.prepare(request),code('REFUSED'));revoked=false;await assert.rejects(s.mount.prepare(request),code('REFUSED'));
 assert.equal(s.resolved.length,1);assert.deepEqual(s.lifecycle.calls,[]);
});
test('a resolver failure prepares nothing; a tool disposition other than NOT_DISPATCHED is UNKNOWN',async()=>{
 const a=setup({resolve:()=>{throw Error('private resolver detail');}});
 await assert.rejects(a.mount.prepare({operation:{id:'schedule_task',version:'0.2.0'},arguments:fixture().request,deliveryId:delivery(1)}),code('REFUSED'));
 const tool={async execute(){throw Object.assign(Error('SCHEDULE_TOOL_FAILED'),{code:'SCHEDULE_TOOL_FAILED',outcome:'UNKNOWN'});}};
 const p=createScheduleIntentPreparer({operation:'schedule_task',tool,binding,resolveContext:async()=>fixture().context});
 const {mount:m}=mount({binding,preparers:[p],now:()=>NOW});const r={operation:{id:'schedule_task',version:'0.2.0'},arguments:fixture().request,deliveryId:delivery(2)};
 await assert.rejects(m.prepare(r),code('UNKNOWN'));await assert.rejects(m.prepare(r),code('UNKNOWN'));
});
