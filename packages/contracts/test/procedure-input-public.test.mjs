import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_PROCEDURE_IDS,assertProcedureSelection} from '../procedure-selection.mjs';
import * as application from '../dist/conversation-application.mjs';
import * as input from '../dist/conversation-input.mjs';
import * as initial from '../dist/conversation-initial-input.mjs';
import * as history from '../dist/conversation-history.mjs';
import {id,bytes,binding,run,transcript,resumed} from './conversation-history-fixture.mjs';
const firm={source:'firm',recordId:id(700),version:2,manifestDigest:'a'.repeat(64)};
const builtin=id=>({source:'builtin',id,version:1,manifestDigest:'b'.repeat(64)});
const ordinary={requestId:id(6),prompt:'Use the reviewed procedure'};
const request={...ordinary,procedure:firm};
const context={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,clientId:id(5)};
const receipt=()=>({run:structuredClone(run),request:{...structuredClone(request),skill:null,window:null,windowRequest:null},lastSequence:1,replayed:false});

test('procedure identity parser admits exact firm and six builtin pins without authority-bearing data',()=>{
 for(const value of [firm,...BUILTIN_PROCEDURE_IDS.map(builtin)]){const accepted=assertProcedureSelection(value);assert.deepEqual(accepted,value);assert.ok(Object.isFrozen(accepted));}
 for(const value of [null,undefined,{},[],{...firm,source:'user'},{...firm,recordId:id(700).toUpperCase().replace('00000000','ABCDEFAB')},
  {...firm,version:0},{...firm,version:1.1},{...firm,version:Number.MAX_SAFE_INTEGER+1},{...firm,manifestDigest:'A'.repeat(64)},
  {...firm,tools:['write']},{...firm,instruction:'grant access'},{...firm,tenantId:'other'},
  {...builtin('unknown')},{...builtin('briefing'),recordId:id(700)},Object.assign(Object.create({scope:'all'}),firm)])
  assert.throws(()=>assertProcedureSelection(value),/PROCEDURE_SELECTION/);
 let reads=0;const accessor={...firm};Object.defineProperty(accessor,'version',{enumerable:true,get(){reads++;return 2;}});
 assert.throws(()=>assertProcedureSelection(accessor),/PROCEDURE_SELECTION/);assert.equal(reads,0);
});

test('all ordinary input receivers carry exact procedure identity and refuse skill or grant injection',()=>{
 for(const receive of [v=>application.receiveConversationRequest('submit',v),input.receiveConversationInputRequest,initial.receiveConversationInitialInputRequest]){
  assert.deepEqual(receive(bytes(ordinary)),ordinary);
  for(const procedure of [firm,...BUILTIN_PROCEDURE_IDS.map(builtin)])assert.deepEqual(receive(bytes({...ordinary,procedure})).procedure,procedure);
  for(const value of [null,{...firm,version:0},{...firm,allowedTools:['*']},{...firm,manifestDigest:'x'},{...builtin('not-installed')}])
   assert.throws(()=>receive(bytes({...ordinary,procedure:value})));
  assert.throws(()=>receive(bytes({...request,skill:{skillId:'quick_skill.bill_watch',skillVersion:'1.1.0'}})));
  const upload={uploadId:id(701),sha256:'c'.repeat(64)};
  assert.deepEqual(receive(bytes({...request,uploads:[upload]})),{...request,uploads:[upload]});
 }
});

test('accepted input correlates exact procedure pin; omission, replacement and version drift are refusals',async()=>{
 const receive=()=>input.receiveConversationInputRequest(bytes(request));
 assert.deepEqual((await input.receiveConversationInputResponse(200,bytes(receipt()),receive(),context)).request.procedure,firm);
 for(const mutate of [v=>delete v.request.procedure,v=>{v.request.procedure.version++;},v=>{v.request.procedure.manifestDigest='c'.repeat(64);},v=>{v.request.procedure=builtin('briefing');}]){
  const value=receipt();mutate(value);await assert.rejects(input.receiveConversationInputResponse(200,bytes(value),receive(),context),/REQUEST_MISMATCH|INVALID_RESPONSE/);
 }
 const unsolicited=receipt();await assert.rejects(input.receiveConversationInputResponse(200,bytes(unsolicited),input.receiveConversationInputRequest(bytes(ordinary)),context),/REQUEST_MISMATCH/);
});

test('retained transcript preserves pins across recovery and rejects changed continuation selection',async()=>{
 const query=()=>history.receiveConversationHistoryRequest('transcript',bytes({conversationId:binding.conversationId}));
 const value=transcript();value.turns[0].request.procedure=firm;
 assert.deepEqual((await history.receiveConversationHistoryResponse('transcript',200,bytes(value),query())).turns[0].request.procedure,firm);
 const chain=resumed();for(const turn of chain.turns)turn.request.procedure=firm;
 assert.deepEqual((await history.receiveConversationHistoryResponse('transcript',200,bytes(chain),query())).turns[1].request.procedure,firm);
 for(const mutate of [v=>delete v.turns[1].request.procedure,v=>{v.turns[1].request.procedure={...firm,version:3};}]){
  const changed=structuredClone(chain);mutate(changed);await assert.rejects(history.receiveConversationHistoryResponse('transcript',200,bytes(changed),query()),/PROMPT_LINEAGE_MISMATCH|TURN_MISMATCH/);
 }
});
