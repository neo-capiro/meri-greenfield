/** Actual canonical journal + prepared-schedule reader over a scripted SQL pool. No DB, driver, schema or firing authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createPostgresIntentJournalStore,createPostgresPreparedScheduleReader} from '../postgres-journal.mjs';
import {createIntentJournal} from '../journal.mjs';
import {createPreparedSchedulePoolFixture} from './prepared-schedule-fixture.mjs';
import {fixture,validators,NOW,canonicalSha256} from '../../../../packages/contracts/test/schedule-tool-interface-fixtures.mjs';

const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,clone=structuredClone;
function preparation(operation='schedule_task'){
 const f=fixture(operation),prepared=validators.prepare(operation,f.request,f.context),identity=f.context.scheduleContext.callerIdentity;
 const binding={...identity,conversationId:id(10),runId:id(11),attemptId:id(12),workerId:id(13),writerFence:1};
 const deliveryId='sdk:'+'b'.repeat(64),record={operation:{id:operation,version:'0.2.0'},argumentsSha256:prepared.requestSha256};
 const outcome={result:{status:'approval_required',proposal:clone(prepared.proposal)},release:{binding,scopes:clone(prepared.intent.projection.scopes),expiresAtMs:NOW-10000}};
 const key={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId};
 return {prepared,binding,deliveryId,record,outcome,key,selection:{tenantId:binding.tenantId,proposalId:prepared.intent.intentId,intentSha256:prepared.intentSha256}};
}
async function setup(operation='schedule_task'){
 const sql=createPreparedSchedulePoolFixture(),store=createPostgresIntentJournalStore({pool:sql.pool}),journal=createIntentJournal(store),p=preparation(operation);
 await journal.begin(p);await journal.settle({...p,state:'PREPARED'});
 return {...p,...sql,store,journal,reader:createPostgresPreparedScheduleReader({pool:sql.pool}),row:()=>[...sql.state.rows.values()][0]};
}
const unknown=promise=>assert.rejects(promise,error=>error.code==='UNKNOWN'&&error.message==='UNKNOWN'&&Object.keys(error).join(',')==='code');
const selects=state=>state.queries.filter(q=>q.sql.includes("outcome->'result'->'proposal'->>'proposalId'"));

for(const operation of ['schedule_task','update_scheduled_task'])test(`reads exact ${operation} custody retained by the canonical journal`,async()=>{
 const s=await setup(operation),result=await s.reader.readPreparedSchedule(s.selection);
 assert.deepEqual(result,{key:s.key,record:s.record,state:'PREPARED',outcome:s.outcome});
 assert.notEqual(result.outcome.release.binding.actorId,result.outcome.result.proposal.projection.owner.actorId,'legitimate delegated preparation is not the firing owner');
 assert.ok(result.outcome.release.expiresAtMs<NOW,'historical expiry is custody, not current authority');
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.key)&&Object.isFrozen(result.outcome.result.proposal)&&Object.isFrozen(result.outcome.release.scopes));
 s.row().outcome.result.proposal.taskInstruction='late change';assert.equal(result.outcome.result.proposal.taskInstruction,s.prepared.input.taskInstruction);
 assert.equal(s.state.ends,0);assert.equal(s.state.releases.at(-1),undefined);
});

test('confirmed absence commits a read-only namespaced transaction; the journal facade remains closed and compatible',async()=>{
 const f=createPreparedSchedulePoolFixture(),store=createPostgresIntentJournalStore({pool:f.pool}),reader=createPostgresPreparedScheduleReader({pool:f.pool});
 assert.deepEqual(Object.keys(store),['claim','settle']);assert.deepEqual(Object.keys(reader),['readPreparedSchedule']);assert.ok(Object.isFrozen(store)&&Object.isFrozen(reader));
 const journal=createIntentJournal(store),p=preparation();assert.equal(f.state.connects,0);
 assert.equal(await reader.readPreparedSchedule(p.selection),null);
 assert.equal(f.state.queries[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.state.queries.at(-1).sql,'COMMIT');assert.equal(f.state.releases.at(-1),undefined);
 assert.deepEqual(selects(f.state)[0].params,[p.selection.tenantId,p.selection.proposalId]);
 assert.match(selects(f.state)[0].sql,/WHERE tenant_id=\$1 AND outcome->'result'->'proposal'->>'proposalId'=\$2 LIMIT 2$/u);
 assert.equal(f.state.queries.some(q=>/^(INSERT|UPDATE|DELETE|CREATE|ALTER) /u.test(q.sql)),false);
 assert.deepEqual(await journal.begin(p),{claimed:true});await journal.settle({...p,state:'PREPARED'});
 assert.deepEqual(await journal.begin(p),{replayed:true,result:p.outcome.result,release:p.outcome.release});
 assert.deepEqual((await reader.readPreparedSchedule(p.selection)).record,p.record);assert.equal(f.state.ends,0);
});

test('tenant and proposal ID are exact lookup boundaries, while wrong intent hash is refused rather than absence',async()=>{
 const s=await setup();assert.equal(await s.reader.readPreparedSchedule({...s.selection,tenantId:'foreign'}),null);
 assert.equal(await s.reader.readPreparedSchedule({...s.selection,proposalId:id(99)}),null);
 await unknown(s.reader.readPreparedSchedule({...s.selection,intentSha256:'c'.repeat(64)}));
 assert.equal(selects(s.state).at(-1).params.length,2,'hash is validated after selecting all matching proposal rows');
});

test('two retained rows for a proposal are ambiguous even when one has a wrong hash or non-PREPARED state',async()=>{
 for(const change of [row=>{},row=>{row.outcome.result.proposal.intentSha256='c'.repeat(64);},row=>{row.state='UNKNOWN';}]){
  const s=await setup(),other=clone(s.row());other.actor_id='another-delegate';other.delivery_id='sdk:'+'d'.repeat(64);change(other);
  s.state.rows.set(JSON.stringify([other.tenant_id,other.actor_id,other.conversation_id,other.delivery_id]),other);
  await unknown(s.reader.readPreparedSchedule(s.selection));assert.equal(s.state.rows.size,2);
 }
});

test('broader historical grants, multiple policy revisions and full-scope distinctions retain canonical subset semantics',async()=>{
 const s=await setup(),scope=s.row().outcome.release.scopes[0];
 s.row().outcome.release.scopes.push({...scope,resourceId:'historically-authorized-extra',policyRevision:'older-policy'}, {...scope,policyRevision:'another-historical-revision'});
 const result=await s.reader.readPreparedSchedule(s.selection);assert.equal(result.outcome.release.scopes.length,3);
 assert.equal(result.outcome.result.proposal.projection.scopes.length,1);
});

for(const [name,change] of [
 ['record hash corruption',row=>{row.record_sha256='f'.repeat(64);}],
 ['wrong record version',row=>{row.record.operation.version='0.1.0';row.record_sha256=canonicalSha256(row.record);}],
 ['invalid recorded arguments hash',row=>{row.record.argumentsSha256='invalid';row.record_sha256=canonicalSha256(row.record);}],
 ['different record operation',row=>{row.record.operation.id='update_scheduled_task';row.record_sha256=canonicalSha256(row.record);}],
 ['pending retained row',row=>{row.state='PENDING';}],
 ['unknown retained row',row=>{row.state='UNKNOWN';}],
 ['failed retained row',row=>{row.state='FAILED';}],
 ['missing original release',row=>{delete row.outcome.release;}],
 ['extra outer result field',row=>{row.outcome.result.private='PRIVATE-CUSTODY-CANARY';}],
 ['non-proposal result',row=>{row.outcome.result.status='acknowledged';}],
 ['noncanonical proposal',row=>{row.outcome.result.proposal.private='PRIVATE-CUSTODY-CANARY';}],
 ['different proposal ID',row=>{row.outcome.result.proposal.proposalId=id(99);}],
 ['foreign projection owner',row=>{row.outcome.result.proposal.projection.owner.tenantId='foreign';}],
 ['foreign release tenant',row=>{row.outcome.release.binding.tenantId='foreign';}],
 ['different release actor',row=>{row.outcome.release.binding.actorId='other';}],
 ['different release conversation',row=>{row.outcome.release.binding.conversationId=id(99);}],
 ['invalid release expiry',row=>{row.outcome.release.expiresAtMs=0;}],
 ['malformed row key',row=>{row.delivery_id='untrusted';}],
 ['foreign row key',row=>{row.tenant_id='foreign';}],
 ['foreign original scope',row=>{row.outcome.release.scopes[0].tenantId='foreign';}],
 ['foreign proposal scope',row=>{row.outcome.result.proposal.projection.scopes[0].tenantId='foreign';}],
 ['duplicate original full scope',row=>{row.outcome.release.scopes.push(clone(row.outcome.release.scopes[0]));}],
 ['duplicate proposal full scope',row=>{row.outcome.result.proposal.projection.scopes.push(clone(row.outcome.result.proposal.projection.scopes[0]));}],
 ['uncovered historic revision',row=>{row.outcome.release.scopes[0].policyRevision='unrelated-revision';}],
 ['uncovered proposal resource',row=>{row.outcome.result.proposal.projection.scopes[0].resourceId='uncovered';}],
 ['oversized original grant',row=>{row.outcome.release.scopes=Array.from({length:101},(_,i)=>({...row.outcome.release.scopes[0],resourceId:String(i)}));}],
])test(`withholds ${name} without erasing it or exposing private content`,async()=>{
 const s=await setup(),row=clone(s.row());change(row);s.state.selectRows=[row];
 const before=clone(s.state.rows);await unknown(s.reader.readPreparedSchedule(s.selection));
 assert.deepEqual(s.state.rows,before);assert.equal(s.state.queries.at(-1).sql,'ROLLBACK');assert.equal(s.state.ends,0);
});

test('a cancelled-schedule proposal cannot be consumed as instruction custody',async()=>{
 const s=await setup('cancel_scheduled_task');await unknown(s.reader.readPreparedSchedule(s.selection));
});

test('invalid, accessor and proxy selections are inert and never acquire a SQL client',async()=>{
 const f=createPreparedSchedulePoolFixture(),reader=createPostgresPreparedScheduleReader({pool:f.pool}),p=preparation();let reads=0;
 const hostile={...p.selection};Object.defineProperty(hostile,'tenantId',{enumerable:true,get(){reads++;throw Error('PRIVATE');}});
 for(const value of [hostile,new Proxy(p.selection,{ownKeys(){reads++;throw Error('PRIVATE');}}),{...p.selection,extra:true},{...p.selection,tenantId:''},{...p.selection,proposalId:'invalid'},{...p.selection,intentSha256:'invalid'},{...p.selection,signal:{}}])await assert.rejects(reader.readPreparedSchedule(value));
 assert.equal(reads,0);assert.equal(f.state.connects,0);
});

test('hostile retained row data is rejected without evaluating getters',async()=>{
 const s=await setup();let reads=0;const row=clone(s.row());Object.defineProperty(row,'outcome',{enumerable:true,get(){reads++;throw Error('PRIVATE');}});
 s.state.selectRows=[row];await unknown(s.reader.readPreparedSchedule(s.selection));assert.equal(reads,0);
 s.state.selectRows=[new Proxy(s.row(),{ownKeys(){reads++;throw Error('PRIVATE');}})];await unknown(s.reader.readPreparedSchedule(s.selection));assert.equal(reads,0);
});

test('pre-abort never acquires; abort during acquisition releases the late client without a transaction',async()=>{
 const s=await setup(),controller=new AbortController();controller.abort();const before=s.state.connects;
 await assert.rejects(s.reader.readPreparedSchedule({...s.selection,signal:controller.signal}),{code:'CANCELLED'});assert.equal(s.state.connects,before);
 let proceed,entered;const gate=new Promise(resolve=>{entered=resolve;});s.state.beforeConnect=()=>new Promise(resolve=>{proceed=resolve;entered();});
 const late=new AbortController(),queries=s.state.queries.length,pending=s.reader.readPreparedSchedule({...s.selection,signal:late.signal});
 await gate;late.abort();proceed();await assert.rejects(pending,{code:'CANCELLED'});
 assert.equal(s.state.queries.length,queries);assert.ok(s.state.releases.at(-1));assert.equal(s.state.ends,0);
});

for(const phase of ['SELECT','COMMIT','release'])test(`late cancellation at ${phase} cannot release retained text or absence`,async()=>{
 for(const retained of [true,false]){
  const s=await setup(),controller=new AbortController();if(!retained)s.state.rows.clear();
  if(phase==='release')s.state.onRelease=()=>controller.abort();
  else s.state.onQuery=sql=>{if(sql.startsWith(phase))controller.abort();};
  await assert.rejects(s.reader.readPreparedSchedule({...s.selection,signal:controller.signal}),{code:'CANCELLED'});assert.equal(s.state.ends,0);
 }
});

test('a caller deadline signal withholds a parked read and the client is eventually released', {timeout:1000},async()=>{
 const s=await setup(),signal=AbortSignal.timeout(10);s.state.onQuery=async sql=>{if(sql.startsWith('SELECT'))await delay(30);};
 await assert.rejects(s.reader.readPreparedSchedule({...s.selection,signal}),{code:'CANCELLED'});
 assert.equal(s.state.queries.at(-1).sql,'ROLLBACK');assert.equal(s.state.releases.at(-1),undefined);assert.equal(s.state.ends,0);
});

test('unavailable SQL is sanitized, and missing-row COMMIT or release uncertainty never becomes null',async()=>{
 const f=createPreparedSchedulePoolFixture(),reader=createPostgresPreparedScheduleReader({pool:f.pool}),p=preparation();
 f.state.onQuery=sql=>{if(sql.startsWith('SELECT'))throw Object.assign(Error('PRIVATE-SQL-CANARY'),{payload:'PRIVATE'});};
 await assert.rejects(reader.readPreparedSchedule(p.selection),error=>error.code==='UNAVAILABLE'&&error.message==='UNAVAILABLE'&&Object.keys(error).join(',')==='code');
 f.state.onQuery=null;f.state.commitError=Error('PRIVATE-ACK-CANARY');await unknown(reader.readPreparedSchedule(p.selection));
 assert.equal(f.state.queries.at(-1).sql,'COMMIT');assert.ok(f.state.releases.at(-1));
 f.state.releaseError=Error('PRIVATE-RELEASE-CANARY');await unknown(reader.readPreparedSchedule(p.selection));assert.equal(f.state.ends,0);
});
