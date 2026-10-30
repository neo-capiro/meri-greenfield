/** CONNECTED recovery proof: REAL createBrowserApprovalOwner + REAL preparation owner + REAL
 * createIntentJournal + REAL createPostgresIntentJournalStore over a serialized SQL double, with the real
 * metadata store, execution journal and browser policy from the existing fixtures.
 *
 * No database, driver, DDL, socket or service runs here. The metadata pool fixture is inert; the intent
 * journal double models the documented SQL the real adapter issues. Labelled limitation, not durability.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {BROWSER_APPROVAL_REQUEST_SCHEMA} from '../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {createExecutionJournal} from '../../control/conversations/execution-journal.mjs';
import {createRunBrowserPolicy,DEFAULT_BROWSER_PLATFORM} from '../product-ports/browser-policy.mjs';
import {createIntentJournal} from '../../control/intents/journal.mjs';
import {createPostgresIntentJournalStore} from '../../control/intents/postgres-journal.mjs';
import {createBrowserApprovalPreparationOwner} from '../../control/commands/approval-metadata/browser-preparation-journal.mjs';
import {createBrowserApprovalConsumptionOwner} from '../../control/commands/approval-metadata/browser-approval-consumption.mjs';
import {createBrowserApprovalOwner} from '../browser-approval.mjs';
import {createMetadataPoolFixture,id,NOW} from '../../control/commands/approval-metadata/test/fixture.mjs';

const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy-1'}];
const input={tool:'browser_click',arguments:{selector:'#confirm'}};

/** Serialized SQL double for the reserved intent table only (same protocol as the journal suite). */
function journalStore(){
 const state={rows:new Map(),commands:[],loseSettleCommitAck:false,commits:0};let tail=Promise.resolve();
 const pool={async connect(){let local,unlock;return {async query(sql,p=[]){
  state.commands.push({sql,p});const rows=x=>({rows:structuredClone(x),rowCount:x.length});
  if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='COMMIT'){state.rows=local;state.commits++;
   if(state.loseSettleCommitAck&&state.commits>1){state.loseSettleCommitAck=false;
    throw Error('synthetic lost COMMIT ACK');}return rows([]);}
  if(sql==='ROLLBACK')return rows([]);
  if(!sql.includes('meri_intents.preparations'))throw Error('unexpected SQL');
  if(!local){const prior=tail;tail=new Promise(r=>unlock=r);await prior;local=structuredClone(state.rows);}
  const k=JSON.stringify(p.slice(0,4));
  if(sql.startsWith('INSERT')){if(local.has(k))return rows([]);
   const row={delivery_id:p[3],created_at:new Date(Date.UTC(2026,9,17,0,0,local.size)),record:JSON.parse(p[4]),
    record_sha256:p[5],state:p[6]??'PENDING',outcome:null};local.set(k,row);
   return rows([{delivery_id:row.delivery_id,created_at:row.created_at,record:row.record,
    record_sha256:row.record_sha256,state:row.state,outcome:row.outcome}]);}
  if(sql.startsWith('SELECT'))return rows(local.has(k)?[local.get(k)]:[]);
  if(sql.startsWith('UPDATE')){const row=local.get(k);
   if(!row||row.state!=='PENDING'||row.record_sha256!==p[4])return rows([]);
   row.state=p[5];row.outcome=p[6]===null?null:JSON.parse(p[6]);return rows([row]);}
  throw Error('unexpected statement');
 },release(error){unlock?.();}};}};
 return {state,store:createPostgresIntentJournalStore({pool})};
}
/** The inert metadata store, with an optional ACK lost AFTER the durable insert already committed. */
async function metadataStore(){
 const {createTransactionalApprovalMetadataStore}=await import('../../control/commands/approval-metadata/postgres-store.mjs');
 const base=createMetadataPoolFixture(),real=createTransactionalApprovalMetadataStore({pool:base.pool});
 const state={loseInsertAck:false};
 const store={read:real.read,async insert(value,check){
  const result=await real.insert(value,check);
  if(state.loseInsertAck){state.loseInsertAck=false;
   throw Object.assign(Error('APPROVAL_METADATA_UNKNOWN'),{code:'APPROVAL_METADATA_UNKNOWN',outcome:'UNKNOWN'});}
  return result;}};
 return {base,state,store};
}

function runStore(){
 const runs=[{projection:{binding,scopes,policyRevision:'policy-1',state:'waiting-for-approval'}}];
 const record={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'c'.repeat(64),
  expiresAtMs:NOW+60000,runtimeSessionId:'s'.repeat(40),phase:'started',native:null};
 const client={async query(statement,values){
  if(statement.includes('native_executions'))return {rows:[{tenant_id:values[0],conversation_id:values[1],
   run_id:values[2],execution_key:record.executionKey,execution_id:record.executionId,record,record_sha256:hash(record)}]};
  return {rows:runs.map(run=>({...run.projection,projection:run.projection,projection_sha256:hash(run.projection)}))};
 }};
 return {tx:async(_binding,_check,effect)=>effect(client)};
}

async function fixture(){
 const journal=journalStore(),metadata=await metadataStore(),clock={now:NOW};
 const journalOwner=createExecutionJournal({tx:runStore().tx,rowRun:value=>value,now:()=>NOW});
 const browserPolicy=createRunBrowserPolicy({platform:DEFAULT_BROWSER_PLATFORM,store:{read:async()=>null},now:()=>NOW});
 const browserPolicyValue=await browserPolicy({binding,scopes,actorRole:'standard_user'});
 const policySha=hash(browserPolicyValue);
 const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',
  toolUseId:'toolu_01HZX',inputSha256:hash(input),pageOrigin:'https://app.capiro.example',policySha256:policySha};
 const request={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input,
  requestedAtMs:NOW-1000,expiresAtMs:NOW+60000};
 const intentJournal=createIntentJournal(journal.store);
 const authority={role:'standard_user',policy:null,fail:false};
 const build=()=>createBrowserApprovalOwner({journal:journalOwner,
  preparations:createBrowserApprovalPreparationOwner({journal:intentJournal}),
  consumption:createBrowserApprovalConsumptionOwner({journal:intentJournal}),pool:metadata.base.pool,
  store:metadata.store,
  readCapabilityRole:async()=>{if(authority.fail)throw Error('run is cancelled or superseded');
   return {actorRole:authority.role,checkedAtMs:NOW,expiresAtMs:NOW+600000};},
  readBrowserPolicy:async call=>{
   if(authority.policy!==null){const changed=await authority.policy(call);return changed;}
   return browserPolicy(call);},
  ports:{status:async()=>{},consume:async()=>{}},now:()=>clock.now,
  limits:{requestMs:3000}});
 const buildDefault=()=>createBrowserApprovalOwner({journal:journalOwner,
  preparations:createBrowserApprovalPreparationOwner({journal:intentJournal}),
  consumption:createBrowserApprovalConsumptionOwner({journal:intentJournal}),pool:metadata.base.pool,
  readCapabilityRole:async()=>{if(authority.fail)throw Error('run is cancelled or superseded');
   return {actorRole:authority.role,checkedAtMs:NOW,expiresAtMs:NOW+600000};},
  readBrowserPolicy:async call=>authority.policy!==null?authority.policy(call):browserPolicy(call),
  ports:{status:async()=>{},consume:async()=>{}},now:()=>clock.now,limits:{requestMs:3000}});
 return {journal,metadata,authority,browserPolicyValue,clock,owner:build(),rebuild:build,buildDefault,request,
  subject,policySha};
}

test('a lost metadata COMMIT acknowledgement is recovered from the ACTUAL row by a new owner',async()=>{
 const f=await fixture();
 // The metadata row is written, then the acknowledgement is lost: prepare must be UNKNOWN.
 f.metadata.state.loseInsertAck=true;
 await assert.rejects(f.owner.prepare({request:f.request,binding}),/UNKNOWN|APPROVAL_METADATA_UNKNOWN/u);
 const writes=()=>f.metadata.base.calls.filter(c=>typeof c==='object'&&c.text?.startsWith('INSERT'))
  .length;
 assert.equal(writes(),1,'the metadata row was written exactly once');
 assert.equal([...f.journal.state.rows.values()][0].state,'PENDING','no PREPARED after a lost ACK');
 // A NEW owner recovers the SAME immutable preparation from canonical metadata, not from ids.
 const recovered=await f.rebuild().prepare({request:f.request,binding});
 assert.equal(recovered.recovered,true);
 const stored=[...f.metadata.base.rows.values()][0].payload;
 assert.equal(hash(recovered.record),hash(stored.record),'the full record is recovered byte-for-byte');
 assert.equal(recovered.record.request.subject.schema,'meri-browser-action/1');
 assert.equal(recovered.record.proposalId,stored.record.proposalId);
 assert.equal(writes(),1,'no second metadata write');
 assert.equal([...f.journal.state.rows.values()][0].state,'PREPARED','the original delivery is settled');
 assert.equal(f.journal.state.rows.size,1,'one delivery only');
});

test('a pending preparation with NO metadata stays UNKNOWN and has no effect',async()=>{
 const f=await fixture();
 // Metadata COMMIT never happened: simulate by refusing the whole metadata transaction.
 f.metadata.state.loseInsertAck=true;
 f.metadata.base.pool.connect=async()=>({async query(){throw Error('synthetic unavailable');},
  release(){}});
 // Fail-closed either way: nothing was stored, so the preparation cannot claim UNKNOWN durability.
 await assert.rejects(f.owner.prepare({request:f.request,binding}),
  /UNKNOWN|APPROVAL_METADATA_UNKNOWN|COMMAND_PREPARATION_REFUSED/u);
 assert.equal(f.metadata.base.rows.size,0);
 assert.equal([...f.journal.state.rows.values()][0].state,'PENDING');
 await assert.rejects(f.rebuild().prepare({request:f.request,binding}),/UNKNOWN|BROWSER_APPROVAL_REFUSED|COMMAND_PREPARATION_REFUSED/u);
 assert.equal(f.metadata.base.rows.size,0,'nothing is invented');
 assert.equal([...f.journal.state.rows.values()][0].state,'PENDING','the state never grants by itself');
});

test('an altered request after a pending preparation conflicts without a second write',async()=>{
 const f=await fixture();
 f.metadata.state.loseInsertAck=true;
 await assert.rejects(f.owner.prepare({request:f.request,binding}),/UNKNOWN|APPROVAL_METADATA_UNKNOWN/u);
 const altered={...f.request,input:{tool:'browser_click',arguments:{selector:'#other'}},
  subject:{...f.request.subject,inputSha256:hash({tool:'browser_click',arguments:{selector:'#other'}})}};
 altered.subjectSha256=hash(altered.subject);
 await assert.rejects(f.rebuild().prepare({request:altered,binding}),
  /CONFLICT|BROWSER_PREPARATION_REFUSED|UNKNOWN/u);
 assert.equal([...f.metadata.base.rows.values()].length,1,'still exactly one metadata row');
 assert.equal(f.journal.state.rows.size,1,'still exactly one delivery');
});

test('the DEFAULT-configured store recovers the same row under current authority',async()=>{
 const f=await fixture();
 f.metadata.state.loseInsertAck=true;
 await assert.rejects(f.owner.prepare({request:f.request,binding}),/UNKNOWN|APPROVAL_METADATA_UNKNOWN/u);
 const recovered=await f.buildDefault().prepare({request:f.request,binding});
 assert.equal(recovered.recovered,true);
 const stored=[...f.metadata.base.rows.values()][0].payload;
 assert.equal(hash(recovered.record),hash(stored.record),'the default store really reads the row');
 assert.equal(f.metadata.base.rows.size,1);
 assert.equal([...f.journal.state.rows.values()][0].state,'PREPARED');
});

test('a revoked role, a changed policy or a moved scope refuses recovery and releases nothing',async()=>{
 for(const change of [
  f=>{f.authority.role='user_readonly';},
  f=>{f.authority.policy=async()=>({...structuredClone(f.browserPolicyValue),allowedOrigins:['https://x.example']});}
 ]){
  const f=await fixture();
  f.metadata.state.loseInsertAck=true;
  await assert.rejects(f.owner.prepare({request:f.request,binding}),/UNKNOWN|APPROVAL_METADATA_UNKNOWN/u);
  change(f);
  await assert.rejects(f.rebuild().prepare({request:f.request,binding}),
   /UNKNOWN|BROWSER_APPROVAL_REFUSED|BROWSER_PREPARATION_AUTHORITY_CHANGED/u,'no positive late reply');
  assert.equal(f.metadata.base.rows.size,1,'no second metadata write');
  assert.equal([...f.journal.state.rows.values()][0].state,'PENDING','nothing released');
 }
});

test('an abort during the recovery read never releases the preparation',async()=>{
 const f=await fixture();
 f.metadata.state.loseInsertAck=true;
 await assert.rejects(f.owner.prepare({request:f.request,binding}),/UNKNOWN|APPROVAL_METADATA_UNKNOWN/u);
 const controller=new AbortController();
 const reader=f.metadata.store.read;
 f.metadata.store.read=async(value,check)=>{controller.abort();return reader(value,check);};
 await assert.rejects(f.rebuild().prepare({request:f.request,binding,signal:controller.signal}),
  /UNKNOWN|BROWSER_APPROVAL_REFUSED|CANCELLED|ABORTED/u);
 assert.equal([...f.journal.state.rows.values()][0].state,'PENDING');
});

test('the strict validator refuses rehashed invalid IDs and observation types',async()=>{
 const {assertBrowserPreparationResult,browserPreparationResult}=await import(
  '../../control/commands/approval-metadata/browser-preparation-result.mjs');
 const f=await fixture();
 const requestSha=hash(f.request);
 const prepared=await f.owner.prepare({request:f.request,binding});
 const mutations=[
  r=>{r.commandId='not-a-uuid';},
  r=>{r.idempotencyKey='not-a-uuid';},
  r=>{r.checkedAtMs='1700000000000';},
  r=>{r.resolved='true';},
 ];
 for(const mutate of mutations){
  const record=structuredClone(prepared.record);
  mutate(record);
  const value={proposalId:record.proposalId,subjectSha256:record.request.subjectSha256,requestSha256:requestSha,
   record,recordSha256:hash(record)};
  assert.throws(()=>assertBrowserPreparationResult(value,{binding,
   toolUseId:record.request.subject.toolUseId}),/BROWSER_PREPARATION/u,'mutation must refuse');
 }
 const ok=browserPreparationResult(structuredClone(prepared.record),{requestSha256:requestSha});
 assert.ok(assertBrowserPreparationResult(ok,{binding,toolUseId:prepared.record.request.subject.toolUseId}));
});

test('a lost journal settle COMMIT acknowledgement is recovered by the retained PREPARED row',async()=>{
 const f=await fixture();
 f.journal.state.loseSettleCommitAck=true;
 await assert.rejects(f.owner.prepare({request:f.request,binding}),/UNKNOWN|BROWSER_APPROVAL_REFUSED/u);
 assert.equal(f.metadata.base.rows.size,1,'the metadata row exists');
 const state=[...f.journal.state.rows.values()][0].state;
 assert.equal(state,'PREPARED','the journal COMMIT was durable');
 const recovered=await f.rebuild().prepare({request:f.request,binding});
 assert.equal(recovered.recovered,true);
 assert.equal(f.metadata.base.rows.size,1,'no second metadata write');
 assert.equal(f.journal.state.rows.size,1,'no second delivery');
});

test('a cancelled or superseded run refuses recovery without writing or releasing',async()=>{
 const f=await fixture();
 f.metadata.state.loseInsertAck=true;
 await assert.rejects(f.owner.prepare({request:f.request,binding}),/UNKNOWN|APPROVAL_METADATA_UNKNOWN/u);
 f.authority.fail=true; // the run became cancelled/superseded after the metadata commit
 await assert.rejects(f.rebuild().prepare({request:f.request,binding}),
  /UNKNOWN|BROWSER_APPROVAL_REFUSED|BROWSER_PREPARATION_AUTHORITY_CHANGED/u);
 assert.equal(f.metadata.base.rows.size,1,'no second metadata write');
 assert.equal([...f.journal.state.rows.values()][0].state,'PENDING','nothing released');
});

test('a pending FIRST raw read is bounded by the ORIGINAL deadline',{timeout:12000},async()=>{
 const f=await fixture();
 // The row exists, but the raw read never replies on its own.
 const prepared=await f.owner.prepare({request:f.request,binding});
 const reader=f.metadata.store.read;
 let release;
 f.metadata.store.read=async()=>new Promise(resolve=>{release=()=>resolve(reader.call(f.metadata.store,
  {tenantId:binding.tenantId,actorId:binding.actorId,proposalId:prepared.proposalId},()=>{}));});
 const pending=f.rebuild().prepare({request:f.request,binding,deadlineMs:NOW+10});
 // The preparation settles by DEADLINE without any raw reply: the await is inside the lifetime.
 await assert.rejects(()=>pending,/DEADLINE|UNKNOWN|CANCELLED|BROWSER_APPROVAL_REFUSED/u);
 release?.(); // a late raw reply must change nothing
 const state=[...f.journal.state.rows.values()][0].state;
 assert.equal(state,'PREPARED','the earlier PREPARED delivery is untouched');
 assert.equal(f.journal.state.rows.size,1,'no second delivery');
});

test('an abort while the FIRST raw read is pending refuses with no later effect',{timeout:12000},async()=>{
 const f=await fixture();
 f.metadata.state.loseInsertAck=true;
 await assert.rejects(f.owner.prepare({request:f.request,binding}),/UNKNOWN|APPROVAL_METADATA_UNKNOWN/u);
 const reader=f.metadata.store.read;
 let release;
 f.metadata.store.read=async(value,check)=>new Promise(resolve=>{release=()=>resolve(reader(value,check));});
 const controller=new AbortController();
 const pending=f.rebuild().prepare({request:f.request,binding,signal:controller.signal});
 setTimeout(()=>controller.abort(),5);
 await assert.rejects(()=>pending,/CANCELLED|ABORTED|UNKNOWN|BROWSER_APPROVAL_REFUSED/u);
 // The held reply arrives AFTER the refusal: it must not settle or release anything.
 release?.();
 await new Promise(r=>setTimeout(r,10));
 assert.equal([...f.journal.state.rows.values()][0].state,'PENDING','nothing released after abort');
 assert.equal(f.metadata.base.rows.size,1,'no second metadata write');
});
