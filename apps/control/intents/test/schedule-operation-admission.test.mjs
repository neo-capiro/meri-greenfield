/** SYNTHETIC: the intent port's schedule operation declaration/admission over the real mount, the real schedule
 * preparer, the real schedule tool interface and the real contract family selector. The lifecycle is a recording
 * stub and the trusted context resolver returns the contract fixture's resolved context. Nothing here is PostgreSQL,
 * Temporal, S3, SDK or live-authority evidence. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createScheduleToolInterface} from '../../schedules/tool-interface.mjs';
import {scheduleToolValidators} from '../../schedules/schedule-validators.mjs';
import {fixture,validators,authority,NOW} from '../../../../packages/contracts/test/schedule-tool-interface-fixtures.mjs';
import {createScheduleIntentPreparer,SCHEDULE_INTENT_OPERATIONS,scheduleOperationDeclared} from '../schedule-preparer.mjs';
import {CURRENT_SCHEDULE_OPERATION_VERSION,LEGACY_SCHEDULE_OPERATION_VERSION,scheduleOperationFamily} from '../../../../packages/contracts/schedule-operation-family.mjs';
import {mount,delivery,id} from './fixture.mjs';
const binding={tenantId:'tenant',actorId:'delegate',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'client',policyRevision:'p1'}];
const code=c=>e=>e.code===c;
/** The real schedule preparers for one exact pin, over the real tool interface of that SAME family. */
function scheduleSetup(version){
 const lifecycle={calls:[],async execute(r){lifecycle.calls.push(r);return {operation:r.intent.operation,intentId:r.intent.intentId,generation:r.intent.generation,projection:r.intent.projection,outcome:'ACKNOWLEDGED',physicalStopProven:false};},async list(){throw Error('not used');}};
 const tool=createScheduleToolInterface({lifecycle,validators:version===CURRENT_SCHEDULE_OPERATION_VERSION?scheduleToolValidators:validators,authorize:authority,clock:()=>NOW});
 const resolved=[];
 const preparers=SCHEDULE_INTENT_OPERATIONS.map(operation=>createScheduleIntentPreparer({operation,tool,binding,version,resolveContext:async({operation:op})=>{resolved.push(op);return fixture(op).context;}}));
 return {lifecycle,resolved,...mount({binding,preparers,now:()=>NOW,scopes})};
}
test('a current-pin schedule declaration is admitted, advertised and prepared under that exact pin',async()=>{
 const s=scheduleSetup(CURRENT_SCHEDULE_OPERATION_VERSION);
 assert.deepEqual((await s.mount.readAvailability({})).operations,SCHEDULE_INTENT_OPERATIONS.map(id=>({id,version:CURRENT_SCHEDULE_OPERATION_VERSION})));
 const out=await s.mount.prepare({operation:{id:'schedule_task',version:CURRENT_SCHEDULE_OPERATION_VERSION},arguments:fixture('schedule_task').request,deliveryId:delivery(1)});
 assert.equal(out.status,'approval_required');assert.equal(out.proposal.operation,'schedule_task');
 assert.deepEqual(s.lifecycle.calls,[]);assert.equal(s.resolved.length,1);
 assert.deepEqual([...s.store.rows.values()][0].record.operation,{id:'schedule_task',version:CURRENT_SCHEDULE_OPERATION_VERSION});
});
test('a legacy-pin schedule declaration is unchanged: the retained pin stays retained',async()=>{
 const s=scheduleSetup(LEGACY_SCHEDULE_OPERATION_VERSION);
 assert.deepEqual((await s.mount.readAvailability({})).operations,SCHEDULE_INTENT_OPERATIONS.map(id=>({id,version:LEGACY_SCHEDULE_OPERATION_VERSION})));
 const out=await s.mount.prepare({operation:{id:'schedule_task',version:LEGACY_SCHEDULE_OPERATION_VERSION},arguments:fixture('schedule_task').request,deliveryId:delivery(1)});
 assert.equal(out.status,'approval_required');assert.deepEqual(s.lifecycle.calls,[]);
 assert.deepEqual([...s.store.rows.values()][0].record.operation,{id:'schedule_task',version:LEGACY_SCHEDULE_OPERATION_VERSION});
});
test('a request for a version the composed owner does not prepare is UNAVAILABLE before any context or effect',async()=>{
 for(const [declared,requested] of [[CURRENT_SCHEDULE_OPERATION_VERSION,LEGACY_SCHEDULE_OPERATION_VERSION],[LEGACY_SCHEDULE_OPERATION_VERSION,CURRENT_SCHEDULE_OPERATION_VERSION]]){
  const s=scheduleSetup(declared);
  await assert.rejects(s.mount.prepare({operation:{id:'schedule_task',version:requested},arguments:fixture('schedule_task').request,deliveryId:delivery(1)}),code('UNAVAILABLE'),`${declared} -> ${requested}`);
  assert.equal(s.resolved.length,0);assert.deepEqual(s.lifecycle.calls,[]);assert.equal(s.store.rows.size,0);
 }
});
test('an unsupported or non-canonical schedule declaration fails at construction, before any context',async()=>{
 for(const version of ['0.9.9','0.3','0.2.0.0','0.2.0 ','','v0.3.0',null,3]){
  let resolved=0;
  const tool=createScheduleToolInterface({lifecycle:{calls:[],async execute(){throw Error('unexpected tool call');},async list(){throw Error('unexpected lifecycle call');}},validators,authorize:authority,clock:()=>NOW});
  assert.throws(()=>createScheduleIntentPreparer({operation:'schedule_task',tool,binding,version,resolveContext:async()=>{resolved++;return fixture('schedule_task').context;}}),code('INTENT_CONFIGURATION'),`pin ${String(version)}`);
  assert.equal(resolved,0);
 }
});
test('the exact-pin declaration rule is the schedule kind only: every other kind keeps the current version-shape rule',async()=>{
 const stub=(version,owner='note',id='save_note')=>({owner,operation:{id,version},binding:{...binding},async prepare(){throw Error('unexpected preparation');}});
 const advertised=async version=>(await (await mount({binding,preparers:[stub(version)],now:()=>NOW,scopes})).mount.readAvailability({})).operations;
 // the schedule kind is admitted only by an exact family pin: a shape-valid but undeclared pin never becomes an operation
 for(const version of ['0.2.1','0.9.9','v0.3.0',null])assert.throws(()=>mount({binding,preparers:[stub(version,'schedule','schedule_task')],now:()=>NOW,scopes}),code('INTENT_CONFIGURATION'),`schedule ${String(version)}`);
 assert.deepEqual(await advertised(CURRENT_SCHEDULE_OPERATION_VERSION),[{id:'save_note',version:CURRENT_SCHEDULE_OPERATION_VERSION}]);
 // every other owner kind keeps the current canonical version-shape rule, unchanged by this leaf
 for(const version of [LEGACY_SCHEDULE_OPERATION_VERSION,CURRENT_SCHEDULE_OPERATION_VERSION,'0.9.9'])assert.deepEqual(await advertised(version),[{id:'save_note',version}],`note ${version}`);
 for(const version of ['v0.3.0','0.3',null])assert.throws(()=>mount({binding,preparers:[stub(version)],now:()=>NOW,scopes}),code('INTENT_CONFIGURATION'),`note ${String(version)}`);
});
test('the family selector admits exact canonical pins only — no shape, no range, no current-global fallback',()=>{
 for(const version of [LEGACY_SCHEDULE_OPERATION_VERSION,CURRENT_SCHEDULE_OPERATION_VERSION])assert.equal(scheduleOperationDeclared(version),true,String(version));
 for(const version of ['0.2','0.3','0.2.0.0','0.2.0 ',`${CURRENT_SCHEDULE_OPERATION_VERSION} `,'',null,undefined,3,'v0.3.0','0.4.0'])assert.equal(scheduleOperationDeclared(version),false,String(version));
 assert.equal(scheduleOperationFamily(LEGACY_SCHEDULE_OPERATION_VERSION).version,LEGACY_SCHEDULE_OPERATION_VERSION);
 assert.equal(scheduleOperationFamily(CURRENT_SCHEDULE_OPERATION_VERSION).version,CURRENT_SCHEDULE_OPERATION_VERSION);
});
