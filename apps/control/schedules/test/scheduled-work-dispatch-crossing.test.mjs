// The approved Work definition crossing: a normal routines request carrying a Work definition is admitted at the
// ordinary entry, the visible approval states that exact definition, the definition is covered by the immutable intent
// digest, the real approval passes the journal's custody shape, and the approved occurrence carries it into the REAL
// dispatch owner over the synthetic external transport. The proposal is validated by the family the RECORDED delivery
// pin names — the routines family records 0.3.0 — so the retained 0.2 family still refuses a Work definition while the
// current family admits it; the content never selects the family.
// No live provider/model/Core HTTP/DB/browser; the session credential is the fixture's own.
import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFixture,binding,routineRequest} from './application-fixture.mjs';
import {harness,occurrence,createIntent,configuration,instruction,owner} from './scheduled-dispatch-harness.mjs';
import {snapshotOccurrence,occurrenceIdentity} from '../scheduled-occurrence.mjs';
import {assertWorkSelection} from '../../../../packages/contracts/work-selection.mjs';
import {CURRENT_SCHEDULE_OPERATION_VERSION,LEGACY_SCHEDULE_OPERATION_VERSION,scheduleOperationDeclared,scheduleOperationFamily} from '../../../../packages/contracts/schedule-operation-family.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {createIntentMount} from '../../intents/mount.mjs';
import {createScheduleIntentPreparer} from '../../intents/schedule-preparer.mjs';
import {createScheduleToolInterface} from '../tool-interface.mjs';
import {createScheduleLifecycle} from '../schedule-lifecycle.mjs';
import {legacyScheduleToolValidators} from '../schedule-validators.mjs';

/** The PREVIOUS actual producer of a retained preparation: the same canonical owners (the real journal store, the real
 * intent mount, the schedule preparer and the frozen 0.2 tool interface) declaring the retained 0.2.0 pin, which is what
 * a composition without an explicit version prepared under before this join. The retained row is therefore the authentic
 * historical record, not a patched current one: the mount validates the declared pin through the family owner and the
 * journal store writes the row. */
async function retainLegacyPreparation(f,{request,requestId,operation='schedule_task'}){
 const resolve=storageMethod(f.context,'resolve'),deadlineMs=f.now()+4500;
 const resolved=await resolve({credential:f.session.credential,operation,request,deadlineMs});
 const authorize=resolved.authorize;
 const tool=createScheduleToolInterface({lifecycle:createScheduleLifecycle({scheduleOwner:f.owner,scheduleClient:f.client.schedule,
  workflowClient:f.client.workflow,authorize,clock:f.now}),validators:legacyScheduleToolValidators,authorize,clock:f.now});
 const preparer={operation:{id:operation,version:LEGACY_SCHEDULE_OPERATION_VERSION},owner:'schedule',binding,async prepare(input){
  return createScheduleIntentPreparer({operation,binding,tool,resolveContext:async()=>resolved.context})
   .prepare({...input,arguments:resolved.prepared.input});
 }};
 const resultRelease={async check({selection,selectionSha256}){
  if(selectionSha256!==hash(selection)||selection.operation.id!==operation||selection.operation.version!==LEGACY_SCHEDULE_OPERATION_VERSION)throw Error('ROUTINES_ACCESS_DENIED');
  return {authorized:true,selectionSha256,binding,scopes:f.scopes(),checkedAtMs:f.now(),expiresAtMs:f.now()+5000};
 }};
 const mount=createIntentMount({binding,preparers:[preparer],journalStore:f.config.journalStore,resultRelease,now:f.now,limits:{maxRequestMs:5000},enabled:true});
 const deliveryId='sdk:'+hash({protocol:'meri.routines.delivery/1',requestId,operation});
 return await mount.prepare({operation:preparer.operation,arguments:request,deliveryId});
}

const work={entry:'start-work',jobKind:'research',deliverables:['committee brief'],dependencies:['intake']};
const withWork=(changes={})=>({...routineRequest(),work:{...work,...changes}});
const workIntent=()=>({...createIntent(),configuration:{...configuration(),task:{...configuration().task,work}}});
const workOccurrence=(changes={})=>occurrence({task:{...configuration().task,work},...changes});

test('a normal schedule carrying a Work definition shows that exact definition in the approval',async()=>{
 const f=await applicationFixture();
 const prepared=await f.prepare(withWork());
 assert.equal(prepared.status,'approval_required');
 // The visible approval states the exact definition the request carried, member for member: entry, jobKind,
 // deliverables and dependencies, not a summary and not a hidden field.
 assert.deepEqual(prepared.proposal.work,work);
 assert.deepEqual(Object.keys(prepared.proposal),['operation','status','proposalId','intentSha256','taskInstruction','projection','policy','cancel','work']);
 // An ordinary request states no definition at all — no member, never a defaulted, inherited or derived one, and its
 // proposal stays byte-identical to the retained family's.
 const plain=await (await applicationFixture()).prepare(routineRequest());
 assert.equal(Object.hasOwn(plain.proposal,'work'),false);
 // The canonical owner's own assertion accepts exactly the definition the request carried, and nothing more.
 assert.deepEqual(assertWorkSelection(work),work);
 assert.throws(()=>assertWorkSelection({...work,entry:'not-an-entry'}),{code:'WORK_SELECTION'});
});

test('the Work definition is covered by the immutable intent digest and an unsupported one never reaches an approval',async()=>{
 const a=await (await applicationFixture()).prepare(withWork());
 const b=await (await applicationFixture()).prepare(withWork({deliverables:['a different brief']}));
 const c=await (await applicationFixture()).prepare(withWork({jobKind:'audit'}));
 // A different definition is a different immutable intent: the Work is inside the digest, not decoration.
 assert.notEqual(a.proposal.intentSha256,b.proposal.intentSha256);
 assert.notEqual(a.proposal.intentSha256,c.proposal.intentSha256);
 // An unsupported entry, kind, extra member or non-canonical list is refused at the normal request boundary.
 for(const bad of [{entry:'not-an-entry'},{jobKind:'not-a-kind'},{origin:{}},{deliverables:['x','x']},{dependencies:'not-a-list'},{entry:'start-work',jobKind:'research',deliverables:[],dependencies:[],extra:true}]){
  await assert.rejects((await applicationFixture()).prepare(withWork(bad)),{code:'ROUTINES_INVALID_REQUEST'},JSON.stringify(bad));
 }
});

test('the retained 0.2 family refuses a Work proposal while the recorded 0.3 pin admits it',async()=>{
 const prepared=await (await applicationFixture()).prepare(withWork());
 const legacy=scheduleOperationFamily(LEGACY_SCHEDULE_OPERATION_VERSION),current=scheduleOperationFamily(CURRENT_SCHEDULE_OPERATION_VERSION);
 // The recorded pin selects the family; the content never does. Only an exact pin the owner declares resolves, the
 // retained family's own owner refuses the definition, and the current family's own owner admits it.
 assert.equal(scheduleOperationDeclared(LEGACY_SCHEDULE_OPERATION_VERSION),true);
 assert.equal(scheduleOperationDeclared(CURRENT_SCHEDULE_OPERATION_VERSION),true);
 assert.equal(scheduleOperationDeclared('0.9.9'),false);
 assert.throws(()=>legacy.toolShape('ScheduleMutationOutput',prepared.proposal));
 assert.deepEqual(current.toolShape('ScheduleMutationOutput',prepared.proposal),prepared.proposal);
});

test('the real approval of a Work proposal passes the journal custody shape and reaches the schedule owner once',async()=>{
 const f=await applicationFixture();
 const prepared=await f.prepare(withWork());
 // The stored proposal is read back through the journal's own custody shape (the family the recorded pin names) and
 // the explicit approval then traverses the real lifecycle: this is the leg the retained shape refused.
 const result=await f.approve(prepared,withWork());
 assert.equal(result.status,'acknowledged');
 assert.equal(f.temporal.calls.create,1);
 assert.deepEqual(await f.approve(prepared,withWork()),result);
 assert.equal(f.temporal.calls.create,1);
});

test('the approved Work definition is carried into the occurrence and dispatched exactly once as the original owner',async()=>{
 const h=harness();await h.acknowledge(workIntent());
 const occ=workOccurrence();
 // The occurrence's task carries the canonical definition and nothing else was widened.
 assert.deepEqual(snapshotOccurrence(occ).task.work,work);
 const id=occurrenceIdentity(snapshotOccurrence(occ)),r=await h.scheduled.dispatch({occurrence:occ});
 assert.deepEqual({outcome:r.outcome,code:r.code,admitted:r.admitted},{outcome:'DISPATCHED',code:null,admitted:true});
 assert.equal(r.occurrenceKey,id.occurrenceKey);assert.deepEqual(r.binding,id.binding);
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
 assert.deepEqual({tenantId:id.binding.tenantId,actorId:id.binding.actorId},owner);
 assert.equal(h.instructions.calls[0].instructionSha256,workIntent().taskInstructionSha256);
 // Replay of the same approved occurrence never issues a second run.
 assert.equal((await h.scheduled.dispatch({occurrence:occ})).outcome,'DISPATCHED');
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
});

test('an altered, unsupported or refused Work definition cannot dispatch, and UNKNOWN stays replayable',async()=>{
 const h=harness();await h.acknowledge(workIntent());
 // An altered definition (unknown entry, extra member, or a non-canonical list) is refused without identity.
 for(const altered of [{...work,entry:'not-an-entry'},{...work,jobKind:'scheduled',origin:{}},{...work,deliverables:['a','a']},{...work,dependencies:'not-a-list'}]){
  const r=await h.scheduled.dispatch({occurrence:workOccurrence({task:{...configuration().task,work:altered}})});
  assert.deepEqual(r,{outcome:'REFUSED',occurrenceKey:null,binding:null,code:'SCHEDULE_OCCURRENCE',admitted:false},JSON.stringify(altered));
 }
 assert.equal(h.runCount(),0);assert.equal(h.workflowCount(),0);
 // A refused owner authority is no evidence: nothing runs for the approved Work occurrence either.
 h.authority.state.mode='revoked';
 assert.equal((await h.scheduled.dispatch({occurrence:workOccurrence()})).code,'SCHEDULE_AUTHORITY_REFUSED');
 assert.equal(h.runCount(),0);
 // A lost acknowledgement stays UNKNOWN and replayable: the same identity completes once, with no second run.
 const g=harness();await g.acknowledge(workIntent());g.temporal.faults.start.push('before');
 assert.equal((await g.scheduled.dispatch({occurrence:workOccurrence()})).outcome,'UNKNOWN');
 assert.equal((await g.scheduled.reconcile({occurrence:workOccurrence()})).outcome,'ADMITTED');
 assert.equal((await g.scheduled.dispatch({occurrence:workOccurrence()})).outcome,'DISPATCHED');
 assert.equal(g.runCount(),1);assert.equal(g.workflowCount(),1);
});

test('a genuinely retained ordinary 0.2 preparation replays identically through the current 0.3 composition',async()=>{
 const f=await applicationFixture(),request=routineRequest(),requestId='legacy-replay';
 // The previous producer's own retained row: an ordinary timed request under the retained 0.2.0 pin.
 const retained=await retainLegacyPreparation(f,{request,requestId});
 assert.equal(retained.status,'approval_required');
 assert.equal(Object.hasOwn(retained.proposal,'work'),false);
 const stored=[...f.preparations.state.rows.values()];
 assert.deepEqual(stored.map(row=>row.record.operation.version),[LEGACY_SCHEDULE_OPERATION_VERSION]);
 // The recorded pin is the one the retained family owner declares, and that family's own owner admits this ordinary
 // content: the delivery is genuinely replayable, which is exactly what the current-only gate refused.
 assert.equal(scheduleOperationDeclared(LEGACY_SCHEDULE_OPERATION_VERSION),true);
 assert.deepEqual(scheduleOperationFamily(LEGACY_SCHEDULE_OPERATION_VERSION).toolShape('ScheduleMutationOutput',retained.proposal),retained.proposal);
 const retainedRows=()=>[...f.preparations.state.rows.values()].map(row=>({sha:row.record_sha256,state:row.state,outcome:JSON.stringify(row.outcome)}));
 const before=retainedRows(),scheduleQueries=f.state.scheduleQueries.length,creates=f.temporal.calls.create;
 // The identical prepare under the CURRENT composition and fresh current authority is the same delivery: the retained
 // proposal comes back byte for byte, the retained row is untouched (no remint, no new identity), and no provider or
 // schedule effect is produced. The fresh current-authority read itself is required and is not a retained mutation.
 const replayed=await f.prepare(request,'schedule_task',requestId);
 assert.deepEqual(replayed,retained);
 assert.deepEqual(retainedRows(),before);
 assert.equal(f.state.scheduleQueries.length,scheduleQueries);
 assert.equal(f.temporal.calls.create,creates);
});

test('a new preparation still declares the current 0.3 pin and replays identically',async()=>{
 const f=await applicationFixture(),request=routineRequest(),requestId='current-pin';
 const first=await f.prepare(request,'schedule_task',requestId);
 assert.deepEqual([...f.preparations.state.rows.values()].map(row=>row.record.operation.version),[CURRENT_SCHEDULE_OPERATION_VERSION]);
 const before=[...f.preparations.state.rows.values()].map(row=>row.record_sha256),creates=f.temporal.calls.create;
 const replayed=await f.prepare(request,'schedule_task',requestId);
 assert.deepEqual(replayed,first);
 assert.deepEqual([...f.preparations.state.rows.values()].map(row=>row.record_sha256),before);
 assert.equal(f.temporal.calls.create,creates);
});

test('a stored pin no family declares, or a changed request, is refused on replay',async()=>{
 const f=await applicationFixture(),request=routineRequest(),requestId='undeclared-pin';
 await retainLegacyPreparation(f,{request,requestId});
 // A record whose pin no family declares cannot be written by the mount, so the row is made self-consistent by hand:
 // the retained proposal text is untouched and only the recorded pin stops being a pin the owner declares. The
 // canonical journal's own record admission refuses it before any proposal text is re-admitted, and the journal's
 // existing fault mapping is what surfaces that refusal (unchanged by this correction, which narrows no admission).
 for(const row of f.preparations.state.rows.values()){row.record.operation.version='0.9.9';row.record_sha256=hash(row.record);}
 await assert.rejects(f.prepare(request,'schedule_task',requestId),{code:'UNKNOWN'});
 // The same delivery with different request bytes is not the retained delivery.
 for(const row of f.preparations.state.rows.values()){row.record.operation.version=LEGACY_SCHEDULE_OPERATION_VERSION;row.record_sha256=hash(row.record);}
 await assert.rejects(f.prepare({...request,taskInstruction:'a different instruction'},'schedule_task',requestId),{code:'ROUTINES_STALE'});
});
