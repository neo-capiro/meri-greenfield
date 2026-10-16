import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompletionJournal} from '../completion-journal.mjs';
import {hash} from '../boundary.mjs';
import {rawTypedSha256,typedExecutionWitness} from '../../../../packages/runtime/objective-generation-custody.mjs';

const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(7),policyRevision:'policy'}];
const request={requestId:id(8),prompt:'Draft the plan',skill:null,window:null,windowRequest:null};
const key={binding,scopes,selectedClientId:id(7),completionId:id(9),checkpointId:id(10)};
const check=()=>{};
function typedPair(acceptedRequest=request){
 const typedRequest={candidateVersion:'strategy-candidate/20261015.2',operation:'strategy.draft',basis:null,requestId:acceptedRequest.requestId,
  principal:{tenantId:binding.tenantId,actorId:binding.actorId},context:{packetId:id(11),ownerRefs:[]},input:{typeHint:'plan'}};
 const executionSelection={provider:'provider',model:'model'};
 const strategy={schemaVersion:1,operation:'strategy.draft',request:typedRequest,requestSha256:hash(typedRequest),
  executionContext:{schemaVersion:1,prompt:acceptedRequest.prompt,promptSha256:rawTypedSha256(Buffer.from(acceptedRequest.prompt)),ownerRefs:[],contextPacketId:id(11)},
  queuedType:'plan',executionSelection};
 const typedSelection={binding,acceptedRequest,sourceAdmissionSha256:'a'.repeat(64),strategy,sourceRequestSha256:hash(acceptedRequest)};
 const typedResult={schemaVersion:1,kind:'objective.strategy.draft',path:'meri-objective-strategy-draft.result.json',
  sourceAdmissionSha256:typedSelection.sourceAdmissionSha256,sourceRequestSha256:hash(acceptedRequest),typedRequestSha256:strategy.requestSha256,
  resultRef:id(12),resultSha256:'b'.repeat(64),fileSha256:'c'.repeat(64),bytes:1,
  execution:{...executionSelection,receiptRef:id(13),receiptSha256:'0'.repeat(64),bindingSha256:hash(binding)},
  observation:{sessionId:id(14),completedAtMs:1000,state:'succeeded',payloadSha256:'d'.repeat(64)}};
 typedResult.execution.receiptSha256=hash(typedExecutionWitness(typedResult));return {typedResult,typedSelection};
}
function fixture(acceptedRequest=request){
 const run={projection:{binding,scopes,versions:{format:'v1'},state:'running'},request:acceptedRequest,request_sha256:hash(acceptedRequest),last_sequence:3,hold_control_id:null,sequence_end:null};
 let completion=null;
 const client={async query(sql,args){
  if(sql.startsWith('SELECT * FROM meri_conversations.runs'))return {rows:[structuredClone(run)]};
  if(sql.startsWith('SELECT * FROM meri_conversations.completion_checkpoints'))return {rows:completion?[structuredClone(completion)]:[]};
  if(sql.startsWith('INSERT INTO meri_conversations.completion_checkpoints')){completion={tenant_id:args[0],conversation_id:args[1],run_id:args[2],completion_id:args[3],checkpoint_id:args[4],identity:structuredClone(args[5]),identity_sha256:args[6],state:args[7],proof:null,proof_sha256:null};return {rows:[]};}
  if(sql.startsWith('UPDATE meri_conversations.runs SET hold_completion_id'))return {rows:[]};
  throw Error('unexpected SQL');
 }};
 const journal=createCompletionJournal({rowRun:row=>row,tx:async(_binding,_check,effect)=>effect(client)});
 return {journal,identity:()=>structuredClone(completion?.identity)};
}

test('ordinary completion identity remains pair-free and an Objective replay cannot graft a result',async()=>{
 const f=fixture(),first=await f.journal.begin(key,check);assert.equal(first.capture,true);assert.equal(Object.hasOwn(f.identity(),'typedResult'),false);
 assert.equal((await f.journal.begin(key,check)).capture,false);
 await assert.rejects(f.journal.begin({...key,...typedPair()},check),/COMPLETION_REPLAY_REFUSED/);
});

test('Objective result and issued selection are pinned together in one completion identity',async()=>{
 const f=fixture(),pair=typedPair(),first=await f.journal.begin({...key,...pair},check);
 assert.equal(first.capture,true);assert.deepEqual(f.identity().typedResult,pair.typedResult);
 assert.deepEqual((await f.journal.read(key,check)).typedSelection,pair.typedSelection);
 assert.equal((await f.journal.begin({...key,...pair},check)).capture,false);
 await assert.rejects(f.journal.begin(key,check),/COMPLETION_REPLAY_REFUSED/);
 const altered=structuredClone(pair);altered.typedResult.resultRef=id(15);
 await assert.rejects(f.journal.begin({...key,...altered},check),/COMPLETION_REPLAY_REFUSED/);
 await assert.rejects(f.journal.begin({...key,typedResult:pair.typedResult},check),/COMPLETION_TYPED_REFUSED/);
 assert.deepEqual(f.identity().typedResult,pair.typedResult);
});

test('admitted 100000-character prompt remains journalable with its paired execution context',async()=>{
 const acceptedRequest={...request,prompt:'p'.repeat(100000)},f=fixture(acceptedRequest),pair=typedPair(acceptedRequest);
 assert.ok(Buffer.byteLength(JSON.stringify(pair.typedSelection),'utf8')>131072);
 const first=await f.journal.begin({...key,...pair},check);
 assert.equal(first.capture,true);
 assert.equal((await f.journal.read(key,check)).typedSelection.strategy.executionContext.prompt,acceptedRequest.prompt);
});
