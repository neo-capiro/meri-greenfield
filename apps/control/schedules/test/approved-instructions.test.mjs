import test from 'node:test';
import assert from 'node:assert/strict';
import {createApprovedScheduleInstructions} from '../approved-instructions.mjs';
import {fixture,validators,NOW,canonicalSha256} from '../../../../packages/contracts/test/schedule-tool-interface-fixtures.mjs';
import {harness,occurrence,NOW as DISPATCH_NOW} from './scheduled-dispatch-harness.mjs';
import {createScheduledDispatch} from '../scheduled-dispatch.mjs';
import {createTemporalRunEvidence} from '../../conversations/temporal-run-evidence.mjs';
import {createTemporalConversationDispatcher} from '../../conversations/temporal-dispatch.mjs';
import {versions} from '../../conversations/test/store-fixture.mjs';
import {createPostgresIntentJournalStore,createPostgresPreparedScheduleReader} from '../../intents/postgres-journal.mjs';
import {createIntentJournal} from '../../intents/journal.mjs';
import {createPreparedSchedulePoolFixture} from '../../intents/test/prepared-schedule-fixture.mjs';

const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,clone=structuredClone;
function custody(prepared){
 const actorId='delegate',tenantId=prepared.intent.projection.owner.tenantId,conversationId=id(10);
 return {key:{tenantId,actorId,conversationId,deliveryId:`sdk:${'b'.repeat(64)}`},
  record:{operation:{id:prepared.intent.operation,version:'0.2.0'},argumentsSha256:prepared.requestSha256},state:'PREPARED',
  outcome:{result:{status:'approval_required',proposal:clone(prepared.proposal)},release:{
   binding:{tenantId,actorId,conversationId,runId:id(11),attemptId:id(12),workerId:id(13),writerFence:1},
   scopes:clone(prepared.intent.projection.scopes),expiresAtMs:NOW-10000}}};
}
function setup(operation='schedule_task',options={}){
 const f=fixture(operation),prepared=validators.prepare(operation,f.request,f.context),intent=prepared.intent;
 const state={row:{projection:clone(intent.projection),generation:intent.generation,activeIntent:null,intent:clone(intent)},entry:custody(prepared),calls:[],reads:0};
 const ports={scheduleOwner:{async readFiring(selection,check){state.calls.push(['firing',selection]);check();state.reads++;if(state.onFiring)return state.onFiring(selection,check);return state.row;}},
  preparations:{async readPreparedSchedule(selection){state.calls.push(['preparation',selection]);if(state.onLookup)return state.onLookup(selection);return state.entry;}}};
 const reader=createApprovedScheduleInstructions({...ports,now:()=>NOW,...options});
 const request={tenantId:intent.projection.owner.tenantId,scheduleId:intent.projection.scheduleId,generation:intent.generation,task:clone(intent.configuration.task),instructionSha256:intent.taskInstructionSha256};
 return {state,ports,reader,request,prepared,intent};
}
const rejected=call=>assert.rejects(call,error=>/^SCHEDULE_INSTRUCTION_[A-Z_]+$/u.test(error.code)&&error.message===error.code);

for(const operation of ['schedule_task','update_scheduled_task'])test(`reads exact canonical ${operation} instruction with historical delegated custody`,async()=>{
 const s=setup(operation);
 const out=await s.reader.read(s.request);
 assert.deepEqual(out,{instruction:s.prepared.input.taskInstruction});assert.ok(Object.isFrozen(out));
 assert.notEqual(s.state.entry.key.actorId,s.intent.projection.owner.actorId);
 assert.deepEqual(s.state.calls.map(([type])=>type),['firing','preparation','firing']);
 assert.deepEqual(Object.fromEntries(Object.entries(s.state.calls[1][1]).filter(([key])=>key!=='signal')),
  {tenantId:s.request.tenantId,proposalId:s.intent.intentId,intentSha256:canonicalSha256(s.intent)});
 assert.ok(s.state.calls[1][1].signal instanceof AbortSignal);
});

for(const [name,change] of [
 ['absent current schedule',s=>{s.state.row=null;}],
 ['PREPARED without acknowledged intent',s=>{s.state.row.intent=null;}],
 ['unresolved mutation',s=>{s.state.row.activeIntent=id(20);}],
 ['wrong generation',s=>{s.request.generation++;}],
 ['foreign tenant',s=>{s.request.tenantId='foreign';}],
 ['different schedule',s=>{s.request.scheduleId=id(21);}],
 ['different task manifest',s=>{s.request.task.manifestSha256='c'.repeat(64);}],
 ['different task version',s=>{s.request.task.version++;}],
 ['different instruction digest',s=>{s.request.instructionSha256='c'.repeat(64);}],
 ['torn projection',s=>{s.state.row.projection.destinationId='changed';}],
 ['paused acknowledged configuration',s=>{s.state.row.intent.configuration.paused=true;s.state.row.intent.projection.state='paused';s.state.row.projection.state='paused';}],
 ['extra current row field',s=>{s.state.row.state='ACKNOWLEDGED';}],
])test(`refuses ${name} before accessing preparation custody`,async()=>{
 const s=setup();change(s);await rejected(()=>s.reader.read(s.request));assert.equal(s.state.calls.some(([type])=>type==='preparation'),false);
});

for(const [name,change] of [
 ['missing custody',s=>{s.state.entry=null;}],
 ['ambiguous custody array',s=>{s.state.entry=[s.state.entry,clone(s.state.entry)];}],
 ['unknown custody',s=>{s.state.entry.state='UNKNOWN';s.state.entry.outcome=null;}],
 ['pending custody',s=>{s.state.entry.state='PENDING';s.state.entry.outcome=null;}],
 ['foreign key tenant',s=>{s.state.entry.key.tenantId='foreign';}],
 ['mismatched original actor',s=>{s.state.entry.key.actorId='other';}],
 ['mismatched original conversation',s=>{s.state.entry.key.conversationId=id(29);}],
 ['malformed delivery id',s=>{s.state.entry.key.deliveryId='sdk:not-a-digest';}],
 ['different operation',s=>{s.state.entry.record.operation.id='update_scheduled_task';}],
 ['different operation version',s=>{s.state.entry.record.operation.version='0.3.0';}],
 ['invalid arguments digest',s=>{s.state.entry.record.argumentsSha256='invalid';}],
 ['different proposal id',s=>{s.state.entry.outcome.result.proposal.proposalId=id(30);}],
 ['different intent digest',s=>{s.state.entry.outcome.result.proposal.intentSha256='c'.repeat(64);}],
 ['different proposal owner',s=>{s.state.entry.outcome.result.proposal.projection.owner.actorId='other';}],
 ['different proposal projection',s=>{s.state.entry.outcome.result.proposal.projection.destinationId='other';}],
 ['different approved policy',s=>{s.state.entry.outcome.result.proposal.policy.overlap='ALLOW_ALL';}],
 ['changed instruction text',s=>{s.state.entry.outcome.result.proposal.taskInstruction='unapproved private text';}],
 ['extra canonical proposal field',s=>{s.state.entry.outcome.result.proposal.private='not-public';}],
 ['extra result field',s=>{s.state.entry.outcome.result.private='not-public';}],
 ['invalid release binding',s=>{s.state.entry.outcome.release.binding.writerFence=0;}],
 ['invalid historical expiry',s=>{s.state.entry.outcome.release.expiresAtMs=NaN;}],
 ['foreign release scope',s=>{s.state.entry.outcome.release.scopes[0].tenantId='foreign';}],
 ['different resource scope',s=>{s.state.entry.outcome.release.scopes[0].resourceId='other';}],
 ['duplicate release scope',s=>{s.state.entry.outcome.release.scopes.push(clone(s.state.entry.outcome.release.scopes[0]));}],
 ['proposal policy revision absent from original release',s=>{s.state.entry.outcome.release.scopes[0].policyRevision='other';}],
 ['absent release envelope',s=>{delete s.state.entry.outcome.release;}],
])test(`does not release ${name}`,async()=>{const s=setup();change(s);await rejected(()=>s.reader.read(s.request));});

test('original release may cover more resources than the narrower retained proposal',async()=>{
 const s=setup();s.state.entry.outcome.release.scopes.push({...s.state.entry.outcome.release.scopes[0],resourceId:'another-original-resource'});
 assert.deepEqual(await s.reader.read(s.request),{instruction:s.prepared.input.taskInstruction});
});
test('historical superset preserves distinct full scopes rather than inventing a single policy revision',async()=>{
 const s=setup();s.state.entry.outcome.release.scopes.push({...s.state.entry.outcome.release.scopes[0],policyRevision:'older-policy'},
  {...s.state.entry.outcome.release.scopes[0],resourceId:'another-resource',policyRevision:'another-historical-policy'});
 assert.deepEqual(await s.reader.read(s.request),{instruction:s.prepared.input.taskInstruction});
});

test('generation changes while custody is read prevent release',async()=>{
 const s=setup();s.state.onLookup=()=>{s.state.row.activeIntent=id(40);return s.state.entry;};
 await assert.rejects(s.reader.read(s.request),{code:'SCHEDULE_INSTRUCTION_STALE'});assert.equal(s.state.reads,2);
});
test('a same-generation intent change on the final read prevents release',async()=>{
 const s=setup();s.state.onFiring=()=>{const row=clone(s.state.row);if(s.state.reads===2)row.intent.configuration.note='changed';return row;};
 await assert.rejects(s.reader.read(s.request),{code:'SCHEDULE_INSTRUCTION_STALE'});
});
test('input and owner-returned references cannot change captured text or binding',async()=>{
 const s=setup(),first=clone(s.state.row),last=clone(s.state.row),entry=s.state.entry;
 s.state.onFiring=()=>{if(s.state.reads===1)return first;entry.outcome.result.proposal.taskInstruction='late mutation';return last;};
 s.state.onLookup=()=>{first.intent.configuration.note='late mutation';return entry;};
 const pending=s.reader.read(s.request);s.request.tenantId='late tenant';s.request.task.manifestSha256='c'.repeat(64);
 assert.deepEqual(await pending,{instruction:s.prepared.input.taskInstruction});
 assert.equal(s.state.calls[0][1].tenantId,s.intent.projection.owner.tenantId);
 assert.ok(Object.isFrozen(s.state.calls[0][1]));
});
test('rejects hostile getters and proxies without evaluating them',async()=>{
 let accessed=0;const s=setup();Object.defineProperty(s.state.entry,'outcome',{enumerable:true,get(){accessed++;throw Error('private');}});
 await rejected(()=>s.reader.read(s.request));assert.equal(accessed,0);
 await rejected(()=>s.reader.read(new Proxy(s.request,{ownKeys(){accessed++;throw Error('private');}})));assert.equal(accessed,0);
});
test('custom-prototype requests and class instances are rejected before any owner call',async()=>{
 const s=setup(),custom=Object.assign(Object.create({inherited:true}),s.request);
 class Request{constructor(){Object.assign(this,s.request);}}
 await assert.rejects(s.reader.read(custom),{code:'SCHEDULE_INSTRUCTION_REQUEST'});
 await assert.rejects(s.reader.read(new Request()),{code:'SCHEDULE_INSTRUCTION_REQUEST'});assert.deepEqual(s.state.calls,[]);
});
test('sanitizes port failures without retaining private payloads',async()=>{
 const s=setup();s.state.onLookup=()=>{throw Object.assign(Error('PRIVATE-INSTRUCTION-CANARY'),{payload:s.state.entry});};
 await assert.rejects(s.reader.read(s.request),error=>{
  assert.deepEqual(Object.keys(error),['code']);assert.equal(error.code,'SCHEDULE_INSTRUCTION_UNAVAILABLE');
  assert.equal(JSON.stringify(error).includes('PRIVATE-INSTRUCTION-CANARY'),false);assert.equal(error.message.includes('CANARY'),false);return true;
 });
});
test('an already cancelled request never calls either owner',async()=>{
 const s=setup(),controller=new AbortController();controller.abort();
 await assert.rejects(s.reader.read({...s.request,signal:controller.signal}),{code:'SCHEDULE_INSTRUCTION_CANCELLED'});assert.deepEqual(s.state.calls,[]);
});
for(const phase of ['firing','preparation'])test(`cancels a parked ${phase} without releasing late custody`,{timeout:1000},async()=>{
 const s=setup(),controller=new AbortController();let resume,started;
 const parked=new Promise(resolve=>{started=resolve;});
 if(phase==='firing')s.state.onFiring=(_selection,check)=>new Promise(resolve=>{resume=()=>{assert.throws(check,{code:'SCHEDULE_INSTRUCTION_CANCELLED'});resolve(s.state.row);};started();});
 else s.state.onLookup=selection=>new Promise(resolve=>{resume=()=>{assert.equal(selection.signal.aborted,true);resolve(s.state.entry);};started();});
 const pending=s.reader.read({...s.request,signal:controller.signal});await parked;controller.abort();
 await assert.rejects(pending,{code:'SCHEDULE_INSTRUCTION_CANCELLED'});resume();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(s.state.reads,1);
});
test('a parked lookup reaches its actual operation deadline', {timeout:1000},async()=>{
 const s=setup('schedule_task',{maxRequestMs:15});let lookupSignal;s.state.onLookup=selection=>{lookupSignal=selection.signal;return new Promise(()=>{});};
 await assert.rejects(s.reader.read(s.request),{code:'SCHEDULE_INSTRUCTION_DEADLINE'});assert.equal(lookupSignal.aborted,true);assert.equal(s.state.reads,1);
});
test('abort during the final read prevents release after a successful lookup',async()=>{
 const s=setup(),controller=new AbortController();s.state.onFiring=()=>{if(s.state.reads===2)controller.abort();return s.state.row;};
 await assert.rejects(s.reader.read({...s.request,signal:controller.signal}),{code:'SCHEDULE_INSTRUCTION_CANCELLED'});
});
test('construction is inert and rejects extra configuration/accessors',()=>{
 const s=setup();assert.deepEqual(s.state.calls,[]);
 assert.throws(()=>createApprovedScheduleInstructions({...s.ports,extra:true}),{code:'SCHEDULE_INSTRUCTION_CONFIGURATION'});
 let read=0;const o={...s.ports};Object.defineProperty(o,'now',{enumerable:true,get(){read++;return Date.now;}});
 assert.throws(()=>createApprovedScheduleInstructions(o),{code:'SCHEDULE_INSTRUCTION_CONFIGURATION'});assert.equal(read,0);
});
test('construction captures borrowed methods without taking ownership of their objects',async()=>{
 const s=setup();s.ports.scheduleOwner.readFiring=()=>{throw Error('replacement');};s.ports.preparations.readPreparedSchedule=()=>{throw Error('replacement');};
 assert.deepEqual(await s.reader.read(s.request),{instruction:s.prepared.input.taskInstruction});
 assert.equal(typeof s.ports.scheduleOwner.readFiring,'function');
});

// Composition evidence traverses actual journal claim/settle -> PostgreSQL custody reader -> bridge -> schedule/conversation
// owners -> Temporal adapters over the shared scripted SQL/Temporal doubles. Authority is explicitly synthetic: this proves source
// integration, never native policy, PostgreSQL durability, network COMMIT behavior or Temporal operation.
for(const mode of ['retained','missing','corrupt','commit-unknown'])test(`scheduled dispatch consumes ${mode} custody through the actual journal and instruction bridge`,async()=>{
 const h=harness(),s=setup(),database=createPreparedSchedulePoolFixture();await h.acknowledge(s.intent);
 const entry=clone(s.state.entry);entry.outcome.release.expiresAtMs=DISPATCH_NOW-1000;
 if(mode!=='missing'){
  const journal=createIntentJournal(createPostgresIntentJournalStore({pool:database.pool}));
  const selected={binding:entry.outcome.release.binding,deliveryId:entry.key.deliveryId,record:entry.record};
  assert.deepEqual(await journal.begin(selected),{claimed:true});await journal.settle({...selected,state:'PREPARED',outcome:entry.outcome});
  if(mode==='corrupt')[...database.state.rows.values()][0].outcome.result.proposal.taskInstruction='unapproved instruction';
  if(mode==='commit-unknown')database.state.commitError=Error('synthetic lost custody COMMIT acknowledgement');
 }
 const preparations=createPostgresPreparedScheduleReader({pool:database.pool});
 const taskInstructions=createApprovedScheduleInstructions({scheduleOwner:h.scheduleOwner,preparations,now:()=>DISPATCH_NOW});
 const dispatcher=createTemporalConversationDispatcher({client:h.temporal.client,taskQueue:'meri-conversations',lifecycle:true,now:()=>DISPATCH_NOW});
 const dispatch=createScheduledDispatch({scheduleOwner:h.scheduleOwner,store:h.store,dispatcher,
  runs:createTemporalRunEvidence({client:h.temporal.client,now:()=>DISPATCH_NOW}),authority:h.authority.port,taskInstructions,versions,now:()=>DISPATCH_NOW});
 const firing=occurrence({projection:s.intent.projection,generation:s.intent.generation,task:s.intent.configuration.task,temporalScheduleId:s.intent.projection.temporalScheduleId});
 const result=await dispatch.dispatch({occurrence:firing});
 if(mode==='retained'){
  assert.equal(result.outcome,'DISPATCHED');assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
  const saved=await h.store.readOptional(result.binding,{after:0,limit:1},()=>{});assert.equal(saved.request.prompt,s.prepared.input.taskInstruction);
  assert.deepEqual(h.authority.state.calls.map(call=>call.phase),['before_admission','before_start']);
 }else{assert.equal(result.outcome,'UNKNOWN');assert.equal(h.runCount(),0);assert.equal(h.workflowCount(),0);assert.deepEqual(h.authority.state.calls,[]);}
 assert.equal(database.state.connects,database.state.releases.length);assert.equal(database.state.ends,0);
 assert.equal(database.state.queries.filter(({sql})=>sql.startsWith('SELECT tenant_id,actor_id,conversation_id,delivery_id,')).length,1);
});
