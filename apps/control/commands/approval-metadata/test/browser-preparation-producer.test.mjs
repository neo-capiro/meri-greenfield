import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {BROWSER_APPROVAL_REQUEST_SCHEMA,BROWSER_APPROVAL_PREPARATION_SCHEMA,browserPreparationFromRequest}
 from '../../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {createExecutionJournal} from '../../../conversations/execution-journal.mjs';
import {createRunBrowserPolicy,DEFAULT_BROWSER_PLATFORM} from '../../../../runtime/product-ports/browser-policy.mjs';
import {createPostgresApprovalMetadataStore} from '../postgres-store.mjs';
import {createBrowserPreparationProducer} from '../browser-preparation-producer.mjs';
import {createMetadataPoolFixture,id,NOW} from './fixture.mjs';

const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy-1'}];
const approver={tenantId:'tenant',actorId:'reviewer'};
const input={tool:'browser_click',arguments:{selector:'#confirm'}};

/** Synthetic SQL boundary in front of the REAL execution journal; no socket, no database. */
function runStore({state='waiting-for-approval',runScopes=scopes,policyRevision='policy-1'}={}){
 const runs=[{projection:{binding,scopes:runScopes,policyRevision,state}}];
 let record={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'c'.repeat(64),
  expiresAtMs:NOW+60000,runtimeSessionId:'s'.repeat(40),phase:'started',native:null};
 const executions=[record];
 const client={async query(statement,values){
  if(statement.includes('native_executions'))return {rows:executions.map(saved=>({tenant_id:values[0],
   conversation_id:values[1],run_id:values[2],execution_key:saved.executionKey,execution_id:saved.executionId,
   record:saved,record_sha256:hash(saved)}))};
  const rows=values.length===3?runs:runs;
  return {rows:rows.map(run=>({...run.projection,projection:run.projection,projection_sha256:hash(run.projection)}))};
 }};
 return {tx:async(_binding,_check,effect)=>effect(client),runs,client};
}

function setup({journal,request,policyDigest}={}){
 const sql=createMetadataPoolFixture(),store=createPostgresApprovalMetadataStore({pool:sql.pool});
 const j=journal??runStore();
 const journalOwner=createExecutionJournal({tx:j.tx,rowRun:value=>value,now:()=>NOW});
 const browserPolicy=createRunBrowserPolicy({platform:DEFAULT_BROWSER_PLATFORM,store:{read:async()=>null},now:()=>NOW});
 const producer=createBrowserPreparationProducer({journal:journalOwner,browserPolicy,store,approver,actorRole:'standard_user',
  now:()=>NOW,maxRequestMs:30000});
 const make=async digest=>{
  const sha=digest??hash(await browserPolicy({binding,scopes,actorRole:'standard_user'}));
  const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',
   toolUseId:'toolu_01HZX',inputSha256:hash(input),pageOrigin:'https://app.capiro.example',policySha256:sha};
  return {schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input,requestedAtMs:NOW-1000,
   expiresAtMs:NOW+60000};
 };
 return {sql,store,journal:j,producer,make};
}

test('the producer prepares through the real journal, the canonical browser policy and the existing store',async()=>{
 const f=setup(),request=await f.make();
 const record=await f.producer.prepare({request,binding});
 assert.equal(record.action,'browser.action');assert.deepEqual(record.operation,{id:'browser_action',version:'0.2.0'});
 assert.deepEqual(record.binding,binding);assert.equal(record.resolved,false);
 assert.deepEqual(record.scopes,scopes);
 const stored=[...f.sql.rows.values()][0].payload;
 assert.equal(stored.record.request.schema,BROWSER_APPROVAL_PREPARATION_SCHEMA);
 assert.equal(stored.record.request.subject.policySha256,request.subject.policySha256);
 assert.deepEqual(stored.record.request.input,input);
 assert.equal(stored.record.request.subject.binding.writerFence,binding.writerFence);
 assert.equal(stored.record.request.requestedAtMs,NOW-1000);
 assert.equal(stored.record.request.expiresAtMs,Date.parse(record.expiresAt));
 assert.equal(f.sql.rows.size,1);
});

test('a current scope change between reads refuses the preparation',async()=>{
 const f=setup();
 const request=await f.make();
 // The run's current scopes move before the producer reads them.
 f.journal.runs[0].projection.scopes=[{tenantId:'tenant',kind:'private-user',resourceId:id(9),policyRevision:'policy-2'}];
 await assert.rejects(f.producer.prepare({request,binding}),{message:'BROWSER_PREPARATION_AUTHORITY_CHANGED'});
 assert.equal(f.sql.rows.size,0);
});

test('a stale browser-policy digest refuses even when scopes are current',async()=>{
 const f=setup();
 const request=await f.make('d'.repeat(64));
 await assert.rejects(f.producer.prepare({request,binding}),{message:'BROWSER_PREPARATION_AUTHORITY_CHANGED'});
 assert.equal(f.sql.rows.size,0);
});

test('a request for another binding is never retargeted by the caller',async()=>{
 const f=setup(),request=await f.make();
 await assert.rejects(f.producer.prepare({request,
  binding:{...binding,writerFence:2}}),{message:'BROWSER_PREPARATION_REFUSED'});
 assert.equal(f.sql.rows.size,0);
});

test('an expired execution deadline refuses before anything is stored',async()=>{
 const f=setup({journal:runStore({state:'waiting-for-approval'})});
 const request=await f.make();
 // The run's execution record already expired: currentness refuses.
 const saved=f.journal;
 saved.client.query=async(statement,values)=>statement.includes('native_executions')
  ?{rows:[{tenant_id:values[0],conversation_id:values[1],run_id:values[2],
    record:{binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'c'.repeat(64),
     expiresAtMs:NOW-1,runtimeSessionId:'s'.repeat(40),phase:'started',native:null},
    record_sha256:hash({binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'c'.repeat(64),
     expiresAtMs:NOW-1,runtimeSessionId:'s'.repeat(40),phase:'started',native:null})}]}
  :{rows:saved.runs.map(run=>({...run.projection,projection:run.projection,projection_sha256:hash(run.projection)}))};
 const journalOwner=createExecutionJournal({tx:saved.tx,rowRun:value=>value,now:()=>NOW});
 const browserPolicy=createRunBrowserPolicy({platform:DEFAULT_BROWSER_PLATFORM,store:{read:async()=>null},now:()=>NOW});
 const producer=createBrowserPreparationProducer({journal:journalOwner,browserPolicy,store:f.store,approver,
  actorRole:'standard_user',now:()=>NOW,maxRequestMs:30000});
 await assert.rejects(producer.prepare({request,binding}));
});
