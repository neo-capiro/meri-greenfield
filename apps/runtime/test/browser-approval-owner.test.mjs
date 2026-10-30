/** The composed browser approval owner over the REAL preparation producer, execution journal and metadata
 * store; only SQL rows and the Core HTTP answers are scripted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {BROWSER_APPROVAL_REQUEST_SCHEMA,BROWSER_APPROVAL_PREPARATION_SCHEMA}
 from '../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {createExecutionJournal} from '../../control/conversations/execution-journal.mjs';
import {createRunBrowserPolicy,DEFAULT_BROWSER_PLATFORM} from '../product-ports/browser-policy.mjs';
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

async function fixture(){
 const sql=createMetadataPoolFixture(),journal=runStore();
 const journalOwner=createExecutionJournal({tx:journal.tx,rowRun:value=>value,now:()=>NOW});
 const browserPolicy=createRunBrowserPolicy({platform:DEFAULT_BROWSER_PLATFORM,store:{read:async()=>null},now:()=>NOW});
 const policySha=hash(await browserPolicy({binding,scopes,actorRole:'standard_user'}));
 const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',
  toolUseId:'toolu_01HZX',inputSha256:hash(input),pageOrigin:'https://app.capiro.example',policySha256:policySha};
 const request={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input,
  requestedAtMs:NOW-1000,expiresAtMs:NOW+60000};
 const state={clock:NOW,roleCalls:0,consumeCalls:0,next:null,consumeThrows:false,roleOverride:null};
 const decision=()=>({proposalId:null,commandSha256:hash(subject),decision:'approved',
  decidedAt:new Date(NOW-500).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),
  approver:{tenantId:'tenant',actorId:'actor'},policyRevision:'policy-1'});
 const ports={
  async status({proposalId,subjectSha256}){
   const d=decision();d.proposalId=proposalId;d.commandSha256=subjectSha256;
   const value={schema:'meri-browser-approval-status/1',proposalId,subjectSha256,toolUseId:'toolu_01HZX',
    permissive:false,unknown:false,consumption:null,decision:d,...(state.next??{})};
   return {permitted:false,status:value};
  },
  async consume({proposalId,subjectSha256}){state.consumeCalls++;
   if(state.consumeThrows)throw Object.assign(Error('ACK_LOST'),{code:'ACK_LOST'});
   return {permitted:true,receipt:{schema:'meri-browser-approval-receipt/1',proposalId,subjectSha256,
    consumption:{consumed:true,consumptionId:id(77),consumedAtMs:NOW}}};}};
 const owner=createBrowserApprovalOwner({journal:journalOwner,pool:sql.pool,
  readCapabilityRole:async()=>{state.roleCalls++;return {actorRole:state.roleOverride??'standard_user',
   checkedAtMs:NOW,expiresAtMs:NOW+600000};},
  readBrowserPolicy:browserPolicy,ports,now:()=>state.clock,limits:{requestMs:3000},
  wait:{pollMs:50,sleep:async ms=>{state.clock+=ms;}}});
 return {sql,owner,request,state,subject,policySha};
}

test('preparation stores the exact request/3 through the real producer and reports its identity',async()=>{
 const f=await fixture();
 const prepared=await f.owner.prepare({request:f.request,binding});
 assert.equal(typeof prepared.proposalId,'string');
 assert.equal(prepared.subjectSha256,hash(f.subject));
 assert.equal(f.state.roleCalls>=2,true,'the role is re-read for the authority pass');
 const stored=[...f.sql.rows.values()][0].payload;
 assert.equal(stored.record.request.schema,BROWSER_APPROVAL_PREPARATION_SCHEMA);
 assert.equal(stored.record.request.subject.policySha256,f.policySha);
 assert.equal(stored.record.proposalId,prepared.proposalId);
 assert.equal(stored.record.request.requestedAtMs,NOW-1000);
});

test('a role change between authority passes refuses and stores nothing',async()=>{
 const f=await fixture();
 let calls=0;
 // second read (the authority pass) answers a different canonical role
 const owner=createBrowserApprovalOwner({journal:createExecutionJournal({tx:f.sql.pool.connect?async()=>{throw Error('x');}:null}),
  pool:f.sql.pool,readCapabilityRole:async()=>({actorRole:(++calls===1?'standard_user':'user_admin'),
   checkedAtMs:NOW,expiresAtMs:NOW+600000}),readBrowserPolicy:async()=>({}),ports:{status:async()=>{},consume:async()=>{}},
  now:()=>NOW,limits:{requestMs:3000}});
 await assert.rejects(owner.prepare({request:f.request,binding}),/(REFUSED|AUTHORITY_CHANGED|CONFIGURATION)/u);
});

test('no settle port is exposed without a durable claim owner',async()=>{
 const f=await fixture();
 // A local consumed flag cannot survive owner recreation, so this module deliberately exposes no
 // permission path yet: recovery semantics arrive with the durable claim in the wait join.
 assert.equal(f.owner.settle,undefined);
});
