/** Durable browser approval PREPARATION through the REAL owners: createIntentJournal, the real preparation
 * producer, the real execution journal and the real metadata store. The journal's store is an inert row
 * fixture implementing the documented claim/settle/read protocol (no database, no socket). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {BROWSER_APPROVAL_REQUEST_SCHEMA,BROWSER_APPROVAL_PREPARATION_SCHEMA}
 from '../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {createExecutionJournal} from '../../control/conversations/execution-journal.mjs';
import {createRunBrowserPolicy,DEFAULT_BROWSER_PLATFORM} from '../product-ports/browser-policy.mjs';
import {createIntentJournal} from '../../control/intents/journal.mjs';
import {createBrowserApprovalPreparationOwner} from '../../control/commands/approval-metadata/browser-preparation-journal.mjs';
import {createBrowserApprovalConsumptionOwner} from '../../control/commands/approval-metadata/browser-approval-consumption.mjs';
import {createBrowserApprovalOwner} from '../browser-approval.mjs';
import {createMetadataPoolFixture,id,NOW} from '../../control/commands/approval-metadata/test/fixture.mjs';

const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy-1'}];
const input={tool:'browser_click',arguments:{selector:'#confirm'}};

function runStore(){const runs=[{projection:{binding,scopes,policyRevision:'policy-1',state:'waiting-for-approval'}}];
 const record={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'c'.repeat(64),
  expiresAtMs:NOW+60000,runtimeSessionId:'s'.repeat(40),phase:'started',native:null};
 const client={async query(statement,values){
  if(statement.includes('native_executions'))return {rows:[{tenant_id:values[0],conversation_id:values[1],
   run_id:values[2],execution_key:record.executionKey,execution_id:record.executionId,record,record_sha256:hash(record)}]};
  return {rows:runs.map(run=>({...run.projection,projection:run.projection,projection_sha256:hash(run.projection)}))};
 }};
 return {tx:async(_binding,_check,effect)=>effect(client),runs,client};}

/** The documented journal store protocol: claim/settle/read over an in-memory row. */
function inertJournalStore(){
 const rows=new Map();const state={settleThrows:false};
 const ports={
  async claim({key,record}){const k=JSON.stringify(key),saved=rows.get(k);
   if(saved)return {claimed:false,entry:{record:saved.record,state:saved.state,outcome:saved.outcome}};
   rows.set(k,{record,state:'PENDING',outcome:null});return {claimed:true};},
  async settle({key,record,state:next,outcome}){
   const saved=rows.get(JSON.stringify(key));
   if(state.settleThrows){state.settleThrows=false;throw Error('SYNTHETIC_ACK_LOST');}
   if(!saved)throw Error('MISSING');
   saved.state=next;saved.outcome=outcome;
   return {record:saved.record,state:saved.state,outcome:saved.outcome};},
  async read({key}){const saved=rows.get(JSON.stringify(key));
   return saved?{record:saved.record,state:saved.state,outcome:saved.outcome}:null;}};
 return {ports,state,rows};
}

async function fixture(){
 const sql=createMetadataPoolFixture(),journal=runStore();
 const journalOwner=createExecutionJournal({tx:journal.tx,rowRun:value=>value,now:()=>NOW});
 const browserPolicy=createRunBrowserPolicy({platform:DEFAULT_BROWSER_PLATFORM,store:{read:async()=>null},now:()=>NOW});
 const policySha=hash(await browserPolicy({binding,scopes,actorRole:'standard_user'}));
 const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',
  toolUseId:'toolu_01HZX',inputSha256:hash(input),pageOrigin:'https://app.capiro.example',policySha256:policySha};
 const request={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input,
  requestedAtMs:NOW-1000,expiresAtMs:NOW+60000};
 const state={role:'standard_user',roleCalls:0};
 const box=inertJournalStore(),intentJournal=createIntentJournal(box.ports);
 const build=()=>createBrowserApprovalOwner({journal:journalOwner,
  preparations:createBrowserApprovalPreparationOwner({journal:intentJournal}),
  consumption:createBrowserApprovalConsumptionOwner({journal:intentJournal}),pool:sql.pool,
  readCapabilityRole:async()=>{state.roleCalls++;
   // The first read pins the role; later authority passes see the changed one.
   const role=state.roleAfterFirst!==undefined&&state.roleCalls>1?state.roleAfterFirst:state.role;
   return {actorRole:role,checkedAtMs:NOW,expiresAtMs:NOW+600000};},
  readBrowserPolicy:browserPolicy,ports:{status:async()=>{},consume:async()=>{}},now:()=>NOW,
  limits:{requestMs:3000}});
 const owner=build();
 return {sql,owner,rebuild:build,request,state,subject,store:box,policySha};
}

test('the first prepare claims, writes metadata and settles PREPARED',async()=>{
 const f=await fixture();
 const prepared=await f.owner.prepare({request:f.request,binding});
 assert.equal(typeof prepared.proposalId,'string');
 assert.equal(prepared.subjectSha256,hash(f.subject));
 assert.equal(f.sql.rows.size,1);
 const stored=[...f.sql.rows.values()][0].payload;
 assert.equal(stored.record.request.schema,BROWSER_APPROVAL_PREPARATION_SCHEMA);
 assert.equal(stored.record.request.subject.policySha256,f.policySha);
 assert.equal(stored.record.proposalId,prepared.proposalId);
 assert.equal(stored.record.request.requestedAtMs,NOW-1000);
 const rows=[...f.store.rows.values()];
 assert.equal(rows.length,1);
 assert.equal(rows[0].state,'PREPARED');
 assert.equal(rows[0].outcome.result.record.proposalId,prepared.proposalId);
});

test('a NEW owner recovers the identical preparation without a second write',async()=>{
 const f=await fixture();
 const first=await f.owner.prepare({request:f.request,binding});
 const second=await f.rebuild().prepare({request:f.request,binding});
 assert.equal(second.recovered,true);
 assert.equal(second.proposalId,first.proposalId);
 assert.equal(second.record.proposalId,first.proposalId);
 assert.equal(f.sql.rows.size,1,'no second metadata row');
});

test('an altered request under the same SDK tool use conflicts and writes nothing new',async()=>{
 const f=await fixture();
 await f.owner.prepare({request:f.request,binding});
 const altered={...f.request,input:{tool:'browser_click',arguments:{selector:'#other'}},subject:
  {...f.request.subject,inputSha256:hash({tool:'browser_click',arguments:{selector:'#other'}})}};
 altered.subjectSha256=hash(altered.subject);
 await assert.rejects(f.rebuild().prepare({request:altered,binding}),/CONFLICT|BROWSER_PREPARATION_REFUSED/u);
 assert.equal(f.sql.rows.size,1,'no second metadata row');
});

test('a changed canonical role refuses before any metadata write',async()=>{
 const f=await fixture();
 f.state.roleAfterFirst='user_admin';
 await assert.rejects(f.owner.prepare({request:f.request,binding}),
  /BROWSER_PREPARATION_AUTHORITY_CHANGED|BROWSER_PREPARATION_REFUSED/u);
 assert.equal(f.sql.rows.size,0);
});

test('a lost settle acknowledgement is UNKNOWN and a new owner never runs the producer again',async()=>{
 const f=await fixture();
 f.store.state.settleThrows=true;
 await assert.rejects(f.owner.prepare({request:f.request,binding}),/BROWSER_APPROVAL_UNKNOWN|UNKNOWN/u);
 assert.equal(f.sql.rows.size,1,'the metadata row was written');
 const rows=[...f.store.rows.values()];
 assert.equal(rows[0].state,'PENDING');
 // A second owner finds the retained PENDING row: unresolved, never a second producer run.
 await assert.rejects(f.rebuild().prepare({request:f.request,binding}),/UNKNOWN/u);
 assert.equal(f.sql.rows.size,1);
});

test('a malformed request refuses before claiming',async()=>{
 const f=await fixture();
 await assert.rejects(f.owner.prepare({request:{schema:'other/1'},binding}),/BROWSER_APPROVAL_REFUSED/u);
 assert.equal(f.store.rows.size,0);
 assert.equal(f.sql.rows.size,0);
});

test('the module exposes no approval or consume path',async()=>{
 const f=await fixture();
 assert.equal(f.owner.settle,undefined);
});
