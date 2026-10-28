/** The worker's admission of a prepared schedule intent, one contract family per EXACT operation pin, over the real
 * schedule tool owners: the 0.2 owner for the legacy pin and the 0.3 owner for the current pin (both frozen factories
 * over their own frozen schemas). The lifecycle is a recording stub and authority is synthetic, so preparation is
 * proven to dispatch no schedule effect; no provider, AWS, model, database or network is reachable (ambient
 * credentials are scrubbed before the module graph loads).
 *
 * This is the worker leaf only. The real application crossing (application.mjs request/approve family composition)
 * and the central intent acceptance that still accepts only the legacy version are NOT exercised and NOT claimed.
 */
for(const key of Object.keys(process.env))if(/^(AWS_|AMAZON_|ANTHROPIC_|CLAUDE_CODE_)/u.test(key))delete process.env[key];
import test from 'node:test';
import assert from 'node:assert/strict';
const {canonicalSha256:hash}=await import('../../../../../packages/contracts/validate.mjs');
const {fixture,validators:legacyValidators,authority,NOW}=await import('../../../../../packages/contracts/test/schedule-tool-interface-fixtures.mjs');
const {scheduleToolValidators:currentValidators}=await import('../../../../../packages/contracts/schedules-0.3/tool-validators.mjs');
const {SCHEDULE_OPERATION_VERSIONS,LEGACY_SCHEDULE_OPERATION_VERSION,CURRENT_SCHEDULE_OPERATION_VERSION,scheduleOperationFamily}=await import('../../../../../packages/contracts/schedule-operation-family.mjs');
const {createScheduleToolInterface}=await import('../../../../control/schedules/tool-interface.mjs');
const {assertPreparedResult}=await import('../prepared.mjs');

const WORK={entry:'start-work',jobKind:'scheduled',deliverables:['Committee activity brief'],dependencies:[]};
const SCOPE={tenantId:'tenant',kind:'client',resourceId:'client',policyRevision:'p1'};
const binding={tenantId:'tenant',actorId:'owner',conversationId:'33333333-3333-4333-8333-333333333333'};
const current={scopes:[SCOPE],nowMs:NOW};
const pin=version=>({id:'schedule_task',version});
/** One prepared value produced by the REAL tool owner of the given family, with a recording lifecycle stub. */
async function prepared(validators,work){
 const f=fixture('schedule_task'),request=work===undefined?f.request:{...f.request,work};
 const base=f.context.scheduleContext;
 // A request that carries the definition has a digest that covers it and an approved task that carries it, exactly
 // as the schedule runtime context resolves both.
 const context=work===undefined?f.context:{scheduleContext:{...base,requestSha256:hash(request),taskResolution:{...base.taskResolution,task:{...base.taskResolution.task,work}}}};
 const lifecycle={calls:[],async execute(value){lifecycle.calls.push(value);throw Error('unexpected schedule effect');},async list(){throw Error('unexpected list');}};
 const tool=createScheduleToolInterface({lifecycle,validators,authorize:authority,clock:()=>NOW});
 const proposal=await tool.execute({operation:'schedule_task',request,context});
 assert.deepEqual(lifecycle.calls,[],'preparation dispatches no schedule effect');
 return {request,proposal,value:{status:proposal.status,proposal,request}};
}

test('an ordinary prepared schedule is admitted under the legacy pin through the real 0.2 owner',async()=>{
 const {value}=await prepared(legacyValidators);
 const out=assertPreparedResult('schedule',pin(LEGACY_SCHEDULE_OPERATION_VERSION),value,binding,current);
 assert.equal(out.status,'approval_required');assert.equal(out.reference,value.proposal.proposalId);
});

test('the current pin admits the same ordinary value; an unsupported pin is refused, never resolved to a family',async()=>{
 const {value}=await prepared(legacyValidators);
 assert.equal(assertPreparedResult('schedule',pin(CURRENT_SCHEDULE_OPERATION_VERSION),value,binding,current).status,'approval_required');
 assert.deepEqual([...SCHEDULE_OPERATION_VERSIONS],[LEGACY_SCHEDULE_OPERATION_VERSION,CURRENT_SCHEDULE_OPERATION_VERSION]);
 for(const version of ['0.9.9','0.3','0.2.0.0','0.2.0 ','','0.2.1','v0.3.0',1,null,undefined])
  assert.throws(()=>assertPreparedResult('schedule',pin(version),value,binding,current),{code:'INVALID_RESULT'},`pin ${String(version)}`);
 assert.equal(scheduleOperationFamily('0.9.9'),null);
 assert.equal(scheduleOperationFamily(CURRENT_SCHEDULE_OPERATION_VERSION).validators,currentValidators,'one 0.3 owner, by reference');
});

test('the current pin admits the approved Work definition the legacy pin still refuses',async()=>{
 const {value}=await prepared(currentValidators,WORK);
 assert.deepEqual(value.proposal.projection.scopes,[SCOPE]);
 const out=assertPreparedResult('schedule',pin(CURRENT_SCHEDULE_OPERATION_VERSION),value,binding,current);
 assert.equal(out.status,'approval_required');assert.equal(out.reference,value.proposal.proposalId);
 assert.throws(()=>assertPreparedResult('schedule',pin(LEGACY_SCHEDULE_OPERATION_VERSION),value,binding,current),{code:'INVALID_RESULT'},
  'the frozen 0.2 family still refuses the definition carried by the request');
});

test('a noncanonical definition is refused by the 0.3 owner and by the worker, never repaired',async()=>{
 for(const work of [{...WORK,deliverables:Array.from({length:21},(_,i)=>`d${i}`)},{...WORK,deliverables:['x','x']},{...WORK,extra:true},{...WORK,entry:'deploy'}])
  await assert.rejects(prepared(currentValidators,work),{code:'SCHEDULE_TOOL_FAILED'},JSON.stringify(work));
 const {value}=await prepared(currentValidators,WORK);
 const bad={...value,request:{...value.request,work:{...WORK,deliverables:Array.from({length:32},(_,i)=>`d${i}`)}}};
 assert.throws(()=>assertPreparedResult('schedule',pin(CURRENT_SCHEDULE_OPERATION_VERSION),bad,binding,current),{code:'INVALID_RESULT'});
});

test('a foreign, non-current or wrong-operation prepared schedule is refused under either pin',async()=>{
 const {value}=await prepared(currentValidators,WORK);
 for(const version of SCHEDULE_OPERATION_VERSIONS){
  for(const foreign of [{...binding,tenantId:'other'},{...binding,actorId:'other'}])
   assert.throws(()=>assertPreparedResult('schedule',pin(version),value,foreign,current),{code:'INVALID_RESULT'},'another run');
  for(const stale of [{scopes:[{...SCOPE,policyRevision:'p2'}],nowMs:NOW},{scopes:[],nowMs:NOW}])
   assert.throws(()=>assertPreparedResult('schedule',pin(version),value,binding,stale),{code:'INVALID_RESULT'},'a scope the run no longer holds');
 }
 assert.throws(()=>assertPreparedResult('schedule',{id:'update_scheduled_task',version:CURRENT_SCHEDULE_OPERATION_VERSION},value,binding,current),{code:'INVALID_RESULT'},'another operation');
});
