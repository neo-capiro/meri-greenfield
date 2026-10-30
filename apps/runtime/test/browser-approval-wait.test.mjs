/** The human WAIT and durable ONE-CONSUME path: real preparation and consumption owners over the REAL
 * createIntentJournal, real metadata store and execution journal; only Core status answers are scripted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {BROWSER_APPROVAL_REQUEST_SCHEMA} from '../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
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
  expiresAtMs:NOW+600000,runtimeSessionId:'s'.repeat(40),phase:'started',native:null};
 const client={async query(statement,values){
  if(statement.includes('native_executions'))return {rows:[{tenant_id:values[0],conversation_id:values[1],
   run_id:values[2],execution_key:record.executionKey,execution_id:record.executionId,record,record_sha256:hash(record)}]};
  return {rows:runs.map(run=>({...run.projection,projection:run.projection,projection_sha256:hash(run.projection)}))};
 }};
 return {tx:async(_binding,_check,effect)=>effect(client)};}

function rowStore(){const rows=new Map(),state={settleThrows:false};
 const key=k=>JSON.stringify(k);
 const ports={
  async claim({key:k,record}){const saved=rows.get(key(k));
   if(saved)return {claimed:false,entry:{record:saved.record,state:saved.state,outcome:saved.outcome}};
   rows.set(key(k),{record,state:'PENDING',outcome:null});return {claimed:true};},
  async settle({key:k,record,state:next,outcome}){
   if(state.settleThrows){state.settleThrows=false;throw Error('SYNTHETIC_ACK_LOST');}
   const saved=rows.get(key(k));if(!saved)throw Error('MISSING');
   saved.state=next;saved.outcome=outcome;
   return {record:saved.record,state:saved.state,outcome:saved.outcome};},
  async read({key:k}){const saved=rows.get(key(k));
   return saved?{record:saved.record,state:saved.state,outcome:saved.outcome}:null;}};
 return {ports,rows,state};
}

async function fixture({expiresAtMs=NOW+600000}={}){
 const sql=createMetadataPoolFixture(),journalStore=rowStore();
 const journalOwner=createExecutionJournal({tx:runStore().tx,rowRun:value=>value,now:()=>NOW});
 const browserPolicy=createRunBrowserPolicy({platform:DEFAULT_BROWSER_PLATFORM,store:{read:async()=>null},now:()=>NOW});
 const policySha=hash(await browserPolicy({binding,scopes,actorRole:'standard_user'}));
 const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',
  toolUseId:'toolu_01HZX',inputSha256:hash(input),pageOrigin:'https://app.capiro.example',policySha256:policySha};;
 const request={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input,
  requestedAtMs:NOW-1000,expiresAtMs};
 const intentJournal=createIntentJournal(journalStore.ports);
 const state={clock:NOW,consumeCalls:0,statusCalls:0,mode:'approved',settleThrows:false,
  requestMsRecorded:[]};
 const ports={
  async status({deadlineMs,proposalId,subjectSha256}){
   state.statusCalls++;state.requestMsRecorded.push(deadlineMs-state.clock);
   const decision={proposalId,commandSha256:subjectSha256,decision:state.mode==='approved'||state.mode==='lost-ack'?'approved':state.mode,
    decidedAt:new Date(NOW-500).toISOString(),expiresAt:new Date(state.clock+60000).toISOString(),
    approver:{tenantId:'tenant',actorId:'actor'},policyRevision:'policy-1'};
   const consumption=state.mode==='claimed'?{state:'CLAIMED',consumptionId:id(81)}
    :state.mode==='completed'?{state:'COMPLETED',consumptionId:id(81),consumedAtMs:NOW}:null;
   if(state.mode==='unknown')return {permitted:false,status:{schema:'meri-browser-approval-status/1',proposalId,
    subjectSha256,unknown:true,permissive:false,consumption:null,decision:null}};
   return {permitted:false,status:{schema:'meri-browser-approval-status/1',proposalId,
    subjectSha256,toolUseId:'toolu_01HZX',permissive:false,unknown:false,revoked:state.revokedFlag===true,consumption,
    decision:['approved','claimed','lost-ack','completed'].includes(state.mode)?decision:{...decision,decision:state.mode}}};
  },
  async consume({proposalId,subjectSha256}){state.consumeCalls++;
   if(state.mode==='lost-ack')throw Object.assign(Error('ACK_LOST'),{code:'ACK_LOST'});
   return {permitted:true,receipt:{schema:'meri-browser-approval-receipt/1',proposalId,
    subjectSha256,consumption:{consumed:true,consumptionId:id(82),consumedAtMs:NOW}}}}};

 const build=()=>createBrowserApprovalOwner({journal:journalOwner,pool:sql.pool,
  preparations:createBrowserApprovalPreparationOwner({journal:intentJournal}),
  consumption:createBrowserApprovalConsumptionOwner({journal:intentJournal}),
  readCapabilityRole:async()=>({actorRole:'standard_user',checkedAtMs:NOW,expiresAtMs:NOW+600000}),
  readBrowserPolicy:browserPolicy,ports,now:()=>state.clock,limits:{requestMs:3000,pollMs:50},
  sleep:async ms=>{state.clock+=ms;state.onSleep?.();}});
 const owner=build();
 const prepared=await owner.prepare({request,binding});
 return {sql,owner,rebuild:build,prepared,state,subject,request,journalStore};
}


test('a fresh approved decision consumes exactly once',async()=>{
 const f=await fixture();
 const settled=await f.owner.decide({request:f.request,binding,deadlineMs:NOW+3000});
 assert.equal(settled.permitted,true);
 assert.equal(settled.receipt.consumption.consumed,true);
 assert.equal(f.state.consumeCalls,1);
 const rows=[...f.journalStore.rows.values()];
 assert.equal(rows.filter(r=>r.record.operation.id==='browser_approval_consumption').length,1);
 assert.equal(rows.filter(r=>r.record.operation.id==='browser_approval_consumption')[0].state,'PREPARED');
});

test('a recreated owner after a lost consume ACK sends no further consume',async()=>{
 const f=await fixture();
 f.state.mode='lost-ack';
 const first=await f.owner.decide({request:f.request,binding,deadlineMs:NOW+3000});
 assert.equal(first.permitted,false);
 assert.equal(first.unknown,true);
 assert.equal(f.state.consumeCalls,1);
 const before=f.journalStore.rows.size;
 const second=await f.rebuild().decide({request:f.request,binding,deadlineMs:NOW+3000});
 assert.equal(second.permitted,false);
 assert.equal(second.statusOnly,true);
 assert.equal(f.state.consumeCalls,1,'no second consume after owner recreation');
 assert.equal(f.journalStore.rows.size,before);
});

test('a revoked or rejected decision never permits and never consumes',async()=>{
 for(const mode of ['revoked','rejected']){
  const f=await fixture();
  f.state.mode=mode;
  const settled=await f.owner.decide({request:f.request,binding,deadlineMs:NOW+3000});
  assert.equal(settled.permitted,false);
  assert.equal(settled.terminal,mode);
  assert.equal(f.state.consumeCalls,0);
 }
});

test('an already CLAIMED consumption is status-only and never consumes',async()=>{
 const f=await fixture();
 f.state.mode='claimed';
 const settled=await f.owner.decide({request:f.request,binding,deadlineMs:NOW+400});
 assert.equal(settled.permitted,false);
 assert.equal(f.state.consumeCalls,0);
});

test('cancellation during the wait stops without consuming',async()=>{
 const f=await fixture();
 f.state.mode='pending';
 // An already-aborted caller signal must stop the wait before any Core call or consume.
 const controller=new AbortController();controller.abort();
 await assert.rejects(f.owner.decide({request:f.request,binding,deadlineMs:NOW+60000,signal:controller.signal}));
 assert.equal(f.state.consumeCalls,0);
});

test('the wait outlives 5s with short Core calls and the original expiry caps it',async()=>{
 const f=await fixture();
 f.state.mode='pending';
 const settled=await f.owner.decide({request:f.request,binding,deadlineMs:NOW+8000});
 assert.equal(settled.expired,true);
 assert.equal(settled.permitted,false);
 assert.ok(f.state.statusCalls>=10,'polling continued past 5s');
 assert.ok(f.state.requestMsRecorded.every(ms=>ms<=3000),'each Core call keeps the short bound');
});

test('decide() derives its window from the ORIGINAL request and refuses past it',async()=>{
 // The request itself expires in 2s while the caller asks for ten minutes.
 const f=await fixture({expiresAtMs:NOW+2000});
 f.state.mode='pending';
 // The caller asks for 10 minutes; the original request expires in 2 seconds, so the wait ends there.
 const started=f.state.clock;
 const settled=await f.owner.decide({request:f.request,binding,deadlineMs:NOW+600000});
 assert.equal(settled.permitted,false);
 assert.equal(settled.expired,true);
 assert.ok(f.state.clock-started<=2100,'the original request window capped the wait');
 assert.equal(f.state.consumeCalls,0);
});

test('decide() refuses a request that is already outside its original window',async()=>{
 const f=await fixture();
 const expired={...f.request,requestedAtMs:NOW-900000,expiresAtMs:NOW-1};
 await assert.rejects(f.owner.decide({request:expired,binding}),/BROWSER_APPROVAL_REFUSED|BROWSER_PREPARATION|CONFLICT|AUTHORITY_CHANGED/u);
});

test('unknown, claimed and completed answers are immediate status-only refusals',async()=>{
 for(const mode of ['unknown','claimed','completed']){
  const f=await fixture();
  f.state.mode=mode;
  const settled=await f.owner.decide({request:f.request,binding,deadlineMs:NOW+60000});
  assert.equal(settled.permitted,false,`${mode} never permits`);
  assert.equal(f.state.consumeCalls,0,`${mode} never consumes`);
  assert.ok(f.state.statusCalls<=2,`${mode} is not polled`);
 }
});

test('an abort that arrives after the wait started stops it before any consume',async()=>{
 const f=await fixture();
 f.state.mode='pending';
 let sleeps=0;const controller=new AbortController();
 f.state.onSleep=()=>{if(++sleeps===2)controller.abort();};
 await assert.rejects(f.owner.decide({request:f.request,binding,deadlineMs:NOW+60000,signal:controller.signal}));
 assert.equal(f.state.consumeCalls,0);
});

test('a top-level revoked status refuses immediately even with an approved decision',async()=>{
 const f=await fixture();
 f.state.mode='approved';
 f.state.revokedFlag=true;
 const settled=await f.owner.decide({request:f.request,binding,deadlineMs:NOW+60000});
 assert.equal(settled.permitted,false);
 assert.equal(f.state.consumeCalls,0);
 assert.ok(f.state.statusCalls<=2,'a non-permissive answer is not polled to timeout');
});
