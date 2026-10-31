/** Canonical upload-selector public controls; runs against the tracked distributions with no environment switch. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {MAX_INPUT_UPLOADS,UPLOAD_SELECTIONS_SCHEMA,assertUploadSelections} from '../upload-selection.mjs';
import {conversationSchema} from '../conversation-application/schema.mjs';import {conversationApplicationMetadata} from '../conversation-application/protocol.mjs';
import {inputSchema} from '../conversation-input/schema.mjs';import {conversationInputMetadata} from '../conversation-input/protocol.mjs';
import {initialInputSchema} from '../conversation-initial-input/schema.mjs';import {conversationInitialInputMetadata} from '../conversation-initial-input/protocol.mjs';
import {historySchema} from '../conversation-history/schema.mjs';import {conversationHistoryMetadata} from '../conversation-history/protocol.mjs';
import * as application from '../dist/conversation-application.mjs';import * as input from '../dist/conversation-input.mjs';
import * as initial from '../dist/conversation-initial-input.mjs';import * as history from '../dist/conversation-history.mjs';
import {id,bytes,binding,run,transcript,resumed} from './conversation-history-fixture.mjs';
const sha=n=>String(n).padStart(64,'0'),selector=n=>({uploadId:id(n),sha256:sha(n)}),selectors=count=>Array.from({length:count},(_,index)=>selector(500+index));
const hexId='abcdefab-1234-4abc-8def-0123456789ab';
const plain={requestId:id(6),prompt:'Attach the retained originals'},request={...plain,uploads:selectors(2)};
const revision={artifactId:id(800),versionId:id(801),objectSha256:'a'.repeat(64)};
const context={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,clientId:id(5)};
const admitted=change=>{const value={run:structuredClone(run),request:{...request,skill:null,window:null,windowRequest:null},lastSequence:1,replayed:false};if(change)change(value);return value;};
const ordinary=()=>({run:structuredClone(run),request:{...plain,skill:null,window:null,windowRequest:null},lastSequence:1,replayed:false});
const historyRequest=module=>module.receiveConversationHistoryRequest('transcript',bytes({conversationId:binding.conversationId}));
const page=change=>{const value=transcript();value.turns[0].request.uploads=selectors(2);if(change)change(value);return value;};
const chain=change=>{const value=resumed();value.turns[0].request.uploads=selectors(2);value.turns[1].request.uploads=selectors(2);if(change)change(value);return value;};

test('every input family republishes one closed ordered selector owned by the canonical submit request',()=>{
 const app=conversationSchema(),accepted=inputSchema(),allocated=initialInputSchema(),records=historySchema();
 const uploadsOf=name=>app.$defs[name].properties.uploads;
 assert.deepEqual(uploadsOf('ConversationSubmitRequest'),UPLOAD_SELECTIONS_SCHEMA);assert.deepEqual(uploadsOf('ConversationStoredRequest'),UPLOAD_SELECTIONS_SCHEMA);
 assert.equal(records.$defs.ConversationHistoryStoredRequest.properties.uploads.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationStoredRequest/properties/uploads');
 assert.equal(MAX_INPUT_UPLOADS,8);assert.equal(UPLOAD_SELECTIONS_SCHEMA.minItems,1);assert.equal(UPLOAD_SELECTIONS_SCHEMA.maxItems,8);assert.equal(UPLOAD_SELECTIONS_SCHEMA.uniqueItems,true);
 assert.deepEqual(UPLOAD_SELECTIONS_SCHEMA.items.required,['uploadId','sha256']);assert.equal(UPLOAD_SELECTIONS_SCHEMA.items.additionalProperties,false);
 assert.equal(UPLOAD_SELECTIONS_SCHEMA.items.properties.uploadId.pattern,'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
 assert.equal(UPLOAD_SELECTIONS_SCHEMA.items.properties.sha256.pattern,'^[0-9a-f]{64}$');
 assert.deepEqual(app.$defs.ConversationSubmitRequest.required,['requestId','prompt']);assert.deepEqual(app.$defs.ConversationStoredRequest.required,['requestId','prompt','skill','window','windowRequest']);
 assert.equal(accepted.$defs.ConversationInputRequest.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationSubmitRequest');
 assert.equal(accepted.$defs.ConversationInputStoredRequest.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationStoredRequest');
 assert.equal(allocated.$defs.ConversationInitialInputRequest.$ref,'urn:meri:conversation-input:1.3.0#/$defs/ConversationInputRequest');
 assert.equal(records.$defs.ConversationHistoryStoredRequest.properties.documentRevision.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationStoredRequest/properties/documentRevision');
 assert.equal(app.$id,conversationApplicationMetadata.schemaId);assert.equal(conversationApplicationMetadata.wireContractVersion,'0.4.0');
 assert.equal(accepted.$id,'urn:meri:conversation-input:1.3.0');assert.equal(conversationInputMetadata.inputVersion,'1.3.0');
 assert.equal(allocated.$id,'urn:meri:conversation-initial-input:1.3.0');assert.equal(conversationInitialInputMetadata.initialInputVersion,'1.3.0');
 assert.equal(records.$id,'urn:meri:conversation-history:1.6.0');assert.equal(conversationHistoryMetadata.historyVersion,'1.6.0');
 assert.equal(run.versions.contracts,'0.1.0');
});

test('selector assertion keeps exact order and refuses empty, oversized, duplicated, malformed or widened selections',()=>{
 for(const value of [selectors(1),selectors(8),selectors(2),[selector(501),selector(500)]]){const result=assertUploadSelections(value);assert.deepEqual(result,value);assert.ok(Object.isFrozen(result)&&result.every(Object.isFrozen));}
 const refused=[undefined,null,{},'x',[],selectors(9),id(1),[null],[new Date(0)],
  [selector(500),selector(500)],
  [selector(500),{uploadId:selector(500).uploadId,sha256:sha(999)}],
  [selector(500),{...selector(501),status:'clean'}],
  [selector(500),{...selector(501),clientId:id(5)}],
  [selector(500),{...selector(501),filename:'secret.docx'}],
  [selector(500),{...selector(501),url:'https://storage.example/original'}],
  [selector(500),{...selector(501),text:'instruction'}],
  [selector(500),{...selector(501),config:{}}],
  [{sha256:sha(1)}],[{uploadId:hexId}],
  [{uploadId:hexId.toUpperCase(),sha256:sha(1)}],
  [{uploadId:hexId,sha256:'A'.repeat(64)}],
  [{uploadId:hexId,sha256:'a'.repeat(63)}],
  [{uploadId:hexId+'-',sha256:'a'.repeat(64)}],
  [{uploadId:hexId,sha256:'a'.repeat(64),uploadId2:hexId}]];
 refused.forEach((value,index)=>assert.throws(()=>assertUploadSelections(value),/UPLOAD_SELECTION/u,String(index)));
 const sparse=[selector(500)];sparse[2]=selector(501);assert.throws(()=>assertUploadSelections(sparse),/UPLOAD_SELECTION/u);
 const widened=[selector(500)];widened.status='clean';assert.throws(()=>assertUploadSelections(widened),/UPLOAD_SELECTION/u);
 const inherited=[Object.assign(Object.create({sha256:sha(1)}),{uploadId:hexId})];assert.throws(()=>assertUploadSelections(inherited),/UPLOAD_SELECTION/u);
 let reads=0;const accessor={uploadId:hexId};Object.defineProperty(accessor,'sha256',{enumerable:true,get(){reads++;return sha(1);}});
 assert.throws(()=>assertUploadSelections([accessor]),/UPLOAD_SELECTION/u);assert.equal(reads,0);
});

test('canonical receivers admit the exact ordered selector set and refuse every non-canonical form',async()=>{
 assert.equal(application.conversationApplicationMetadata.wireContractVersion,'0.4.0');assert.equal(input.conversationInputVersion,'1.3.0');assert.equal(initial.conversationInitialInputVersion,'1.3.0');assert.equal(history.conversationHistoryVersion,'1.6.0');
 for(const receive of [value=>application.receiveConversationRequest('submit',value),input.receiveConversationInputRequest,initial.receiveConversationInitialInputRequest]){
  assert.deepEqual(receive(bytes(plain)),plain);assert.deepEqual(receive(bytes(request)),request);
  assert.deepEqual(receive(bytes({...request,uploads:selectors(8)})).uploads,selectors(8));
  assert.deepEqual(receive(bytes({...request,documentRevision:revision})).uploads,selectors(2));
  assert.deepEqual(receive(bytes({...plain,documentRevision:revision})).documentRevision,revision);
  for(const bad of [{...request,uploads:[]},{...request,uploads:selectors(9)},{...request,uploads:[selector(500),selector(500)]},{...request,uploads:[selector(500),{uploadId:selector(500).uploadId,sha256:'a'.repeat(64)}]},{...request,uploads:[{...selector(501),status:'clean'}]},{...request,uploads:[{uploadId:hexId.toUpperCase(),sha256:sha(1)}]},{...request,uploads:[{uploadId:hexId,sha256:'a'.repeat(63)}]},{...request,uploads:'x'}])assert.throws(()=>receive(bytes(bad)));
  assert.throws(()=>receive(bytes({...request,skill:{skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0'},documentRevision:revision})));
 }
 assert.deepEqual((await input.receiveConversationInputResponse(200,bytes(admitted()),input.receiveConversationInputRequest(bytes(request)),context)).request.uploads,selectors(2));
 // An upload-free stored request is preserved verbatim by the new receiver; the held-base equality witness is task-owned.
 assert.deepEqual((await input.receiveConversationInputResponse(200,bytes(ordinary()),input.receiveConversationInputRequest(bytes(plain)),context)).request,{...plain,skill:null,window:null,windowRequest:null});
 const admittedRequest=()=>input.receiveConversationInputRequest(bytes(request));
 for(const change of [value=>delete value.request.uploads,value=>{value.request.uploads=[...selectors(2)].reverse();},value=>{value.request.uploads=[selector(500)];},value=>{value.request.uploads=[{...selector(500),sha256:'b'.repeat(64)},selector(501)];},value=>{value.request.uploads=selectors(2).concat(selector(600));}])
  await assert.rejects(input.receiveConversationInputResponse(200,bytes(admitted(change)),admittedRequest(),context),/REQUEST_MISMATCH|INVALID_RESPONSE/u,change.toString());
 assert.deepEqual((await history.receiveConversationHistoryResponse('transcript',200,bytes(page()),historyRequest(history))).turns[0].request.uploads,selectors(2));
 // Non-identical duplicates are refused by the canonical selector rule; identical duplicates already fail schema uniqueItems.
 for(const change of [value=>{value.turns[0].request.uploads=[selector(500),selector(500)];},value=>{value.turns[0].request.uploads=[selector(500),{...selector(500),sha256:'b'.repeat(64)}];},value=>{value.turns[0].request.uploads=selectors(9);},value=>{value.turns[0].request.uploads=[{...selector(501),url:'https://storage.example/original'}];},value=>{value.turns[0].request.uploads=[{uploadId:'ABCDEFAB-1234-4ABC-8DEF-0123456789AB',sha256:sha(1)}];},value=>{value.turns[0].request.uploads=[{...selector(501),sha256:'A'.repeat(64)}];}])
  await assert.rejects(history.receiveConversationHistoryResponse('transcript',200,bytes(page(change)),historyRequest(history)),/TURN_MISMATCH|INVALID_RESPONSE/u,change.toString());
 assert.deepEqual((await history.receiveConversationHistoryResponse('transcript',200,bytes(chain(value=>value)),historyRequest(history))).turns[1].request.uploads,selectors(2));
 for(const change of [value=>delete value.turns[1].request.uploads,value=>{value.turns[1].request.uploads=[...selectors(2)].reverse();},value=>{value.turns[1].request.uploads=[{...selector(500),sha256:'b'.repeat(64)},selector(501)];}])
  await assert.rejects(history.receiveConversationHistoryResponse('transcript',200,bytes(chain(change)),historyRequest(history)),/PROMPT_LINEAGE_MISMATCH|TURN_MISMATCH|INVALID_RESPONSE/u,change.toString());
});

test('tracked generation records the selector helper as an exact browser-safe input',async()=>{
 const evidence=JSON.parse(await readFile(new URL('../dist/conversation-application.metadata.json',import.meta.url),'utf8')),recorded=evidence.sources.find(row=>row.path==='upload-selection.mjs');
 assert.equal(evidence.schemaId,'urn:meri:conversation-application:0.4.0');assert.ok(recorded,'upload selector helper is a recorded generation input');
 const helper=await readFile(new URL('../upload-selection.mjs',import.meta.url));
 assert.equal(recorded.sha256,createHash('sha256').update(helper).digest('hex'));assert.equal(recorded.bytes,helper.length);assert.doesNotMatch(helper.toString('utf8'),/from ["']node:|require\(["']node:/u);
 const records=JSON.parse(await readFile(new URL('../dist/conversation-history.metadata.json',import.meta.url),'utf8'));
 assert.equal(records.schemaId,'urn:meri:conversation-history:1.6.0');
 for(const [name,metadata,family] of [['application',evidence,'conversation-application'],['history',records,'conversation-history']]){
  assert.ok(metadata.sources.some(row=>row.path==='upload-selection.mjs'),name);assert.ok(metadata.browserInputs.includes('upload-selection.mjs'),name);
  const browser=await readFile(new URL('../dist/'+family+'.mjs',import.meta.url),'utf8');assert.doesNotMatch(browser,/from ["']node:|require\(["']node:/u);assert.match(browser,/UPLOAD_SELECTION/u);
 }
});
