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
 const state={rows:new Map(),commands:[]};let tail=Promise.resolve();
 const pool={async connect(){let local,unlock;return {async query(sql,p=[]){
  state.commands.push({sql,p});const rows=x=>({rows:structuredClone(x),rowCount:x.length});
  if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='COMMIT'){state.rows=local;return rows([]);}
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
 const journal=journalStore(),metadata=await metadataStore();
 const journalOwner=createExecutionJournal({tx:runStore().tx,rowRun:value=>value,now:()=>NOW});
 const browserPolicy=createRunBrowserPolicy({platform:DEFAULT_BROWSER_PLATFORM,store:{read:async()=>null},now:()=>NOW});
 const policySha=hash(await browserPolicy({binding,scopes,actorRole:'standard_user'}));
 const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',
  toolUseId:'toolu_01HZX',inputSha256:hash(input),pageOrigin:'https://app.capiro.example',policySha256:policySha};
 const request={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input,
  requestedAtMs:NOW-1000,expiresAtMs:NOW+60000};
 const intentJournal=createIntentJournal(journal.store);
 const build=()=>createBrowserApprovalOwner({journal:journalOwner,
  preparations:createBrowserApprovalPreparationOwner({journal:intentJournal}),
  consumption:createBrowserApprovalConsumptionOwner({journal:intentJournal}),pool:metadata.base.pool,
  store:metadata.store,
  readCapabilityRole:async()=>({actorRole:'standard_user',checkedAtMs:NOW,expiresAtMs:NOW+600000}),
  readBrowserPolicy:browserPolicy,ports:{status:async()=>{},consume:async()=>{}},now:()=>NOW,
  limits:{requestMs:3000}});
 return {journal,metadata,owner:build(),rebuild:build,request,subject,policySha};
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
