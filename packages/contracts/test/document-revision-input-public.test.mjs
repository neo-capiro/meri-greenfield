/** Versioned public receiver compatibility; no consumer source import or package mutation. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {join} from 'node:path';
import * as app from '../dist/conversation-application.mjs';import * as input from '../dist/conversation-input.mjs';import * as initial from '../dist/conversation-initial-input.mjs';import * as history from '../dist/conversation-history.mjs';
import {CLAUDE_SELECTION} from './model-selection-fixture.mjs';
import {id,bytes,binding,run,transcript,resumed} from './conversation-history-fixture.mjs';
const selection={artifactId:id(800),versionId:id(801),objectSha256:'a'.repeat(64)},plain={requestId:id(6),prompt:'Revise the document'},request={...plain,documentRevision:selection};
const context={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,clientId:id(5)};
const receipt=()=>({run,request:{...request,skill:null,window:null,windowRequest:null},lastSequence:1,replayed:false});
test('explicit family versions retain fixed routes and runtime wire identity',()=>{
 assert.equal(app.conversationApplicationMetadata.wireContractVersion,'0.4.0');assert.equal(input.conversationInputVersion,'1.3.0');assert.equal(initial.conversationInitialInputVersion,'1.3.0');assert.equal(history.conversationHistoryVersion,'1.4.0');assert.equal(run.versions.contracts,'0.1.0');
});
test('canonical revision submit/input/allocation request brands agree, refusing unknown fields and skill mixing',()=>{
 for(const receive of [b=>app.receiveConversationRequest('submit',b),input.receiveConversationInputRequest,initial.receiveConversationInitialInputRequest]){
  assert.deepEqual(receive(bytes(request)),request);
  for(const documentRevision of [null,{...selection,objectSha256:'A'.repeat(64)},{...selection,baseVersionId:id(9)}])assert.throws(()=>receive(bytes({...request,documentRevision})));
  assert.throws(()=>receive(bytes({...request,skill:{skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0'}})));
 }
});
test('admission and reload correlate the exact selected version and object hash',async()=>{
 const req=input.receiveConversationInputRequest(bytes(request)),out=await input.receiveConversationInputResponse(200,bytes(receipt()),req,context);assert.deepEqual(out.request.documentRevision,selection);
 for(const replacement of [undefined,{...selection,versionId:id(802)},{...selection,objectSha256:'b'.repeat(64)}]){const wrong=receipt();if(replacement===undefined)delete wrong.request.documentRevision;else wrong.request.documentRevision=replacement;await assert.rejects(input.receiveConversationInputResponse(200,bytes(wrong),input.receiveConversationInputRequest(bytes(request)),context));}
 const page=transcript();page.turns[0].request.documentRevision=selection;assert.deepEqual((await history.receiveConversationHistoryResponse('transcript',200,bytes(page),history.receiveConversationHistoryRequest('transcript',bytes({conversationId:binding.conversationId})))).turns[0].request.documentRevision,selection);
 const mixed=transcript();mixed.turns[0].request.documentRevision=selection;mixed.turns[0].request.skill={skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0',manifestSha256:'a'.repeat(64),proseSha256:'b'.repeat(64),catalogSha256:'c'.repeat(64)};await assert.rejects(history.receiveConversationHistoryResponse('transcript',200,bytes(mixed),history.receiveConversationHistoryRequest('transcript',bytes({conversationId:binding.conversationId}))));
 const chain=resumed();for(const t of chain.turns)t.request.documentRevision=selection;chain.turns[1].request.documentRevision={...selection,versionId:id(802)};await assert.rejects(history.receiveConversationHistoryResponse('transcript',200,bytes(chain),history.receiveConversationHistoryRequest('transcript',bytes({conversationId:binding.conversationId}))));
});
test('physical prior0.1.23 accepts ordinary requests/receipts but refuses the new revision shapes',{skip:process.env.MERI_PRIOR_CONTRACTS?false:'Exact immutable prior package path required'},async()=>{
 const old={};for(const family of ['application','input','initial-input','history'])old[family]=await import(pathToFileURL(join(process.env.MERI_PRIOR_CONTRACTS,'dist','conversation-'+family+'.mjs')).href);
 for(const value of [plain,{...plain,modelSelection:CLAUDE_SELECTION}]){
  assert.deepEqual(old.application.receiveConversationRequest('submit',bytes(value)),app.receiveConversationRequest('submit',bytes(value)));
 }
 for(const receiver of [b=>old.application.receiveConversationRequest('submit',b),old.input.receiveConversationInputRequest,old['initial-input'].receiveConversationInitialInputRequest])assert.throws(()=>receiver(bytes(request)));
 const ordinary=receipt();delete ordinary.request.documentRevision;const a=await old.input.receiveConversationInputResponse(200,bytes(ordinary),old.input.receiveConversationInputRequest(bytes(plain)),context),b=await input.receiveConversationInputResponse(200,bytes(ordinary),input.receiveConversationInputRequest(bytes(plain)),context);assert.deepEqual(a,b);
 const raw=transcript(),q={conversationId:binding.conversationId};assert.deepEqual(await old.history.receiveConversationHistoryResponse('transcript',200,bytes(raw),old.history.receiveConversationHistoryRequest('transcript',bytes(q))),await history.receiveConversationHistoryResponse('transcript',200,bytes(raw),history.receiveConversationHistoryRequest('transcript',bytes(q))));
 raw.turns[0].request.documentRevision=selection;await assert.rejects(old.history.receiveConversationHistoryResponse('transcript',200,bytes(raw),old.history.receiveConversationHistoryRequest('transcript',bytes(q))));
 await assert.rejects(old.input.receiveConversationInputResponse(200,bytes(receipt()),old.input.receiveConversationInputRequest(bytes(plain)),context));
});
