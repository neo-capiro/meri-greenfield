/** New receiving families only; selection is not permission or a recipe runtime. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import * as app from '../dist/conversation-application.mjs';import * as input from '../dist/conversation-input.mjs';import * as initial from '../dist/conversation-initial-input.mjs';import * as history from '../dist/conversation-history.mjs';
import {id,bytes,binding,run,transcript,resumed} from './conversation-history-fixture.mjs';
const skills=[{skillId:'quick_skill.bill_watch',skillVersion:'2.0.0'},{skillId:'quick_skill.cited_report',skillVersion:'1.0.0'}];
const revision={artifactId:id(800),versionId:id(801),objectSha256:'a'.repeat(64)},uploads=[{uploadId:id(802),sha256:'b'.repeat(64)}];
const request=skill=>({requestId:id(6),prompt:'Revise the cited document',skill,documentRevision:revision,uploads});
const pin=skill=>({...skill,manifestSha256:'c'.repeat(64),proseSha256:'d'.repeat(64),catalogSha256:'e'.repeat(64)});
const stored=skill=>({...request(skill),skill:pin(skill),window:null,windowRequest:null});
const context={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,clientId:id(5)};
const receiveRequests=[b=>app.receiveConversationRequest('submit',b),input.receiveConversationInputRequest,initial.receiveConversationInitialInputRequest];

test('all three request receivers admit only the two eligible exact recipe/revision pairs and keep uploads',()=>{
 for(const skill of skills)for(const receive of receiveRequests)assert.deepEqual(receive(bytes(request(skill))),request(skill));
 const wrong=[{...skills[0],skillVersion:'1.1.0'},{...skills[0],skillVersion:'2.0.1'},{...skills[1],skillVersion:'1.1.0'},{skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0'}];
 for(const skill of wrong)for(const receive of receiveRequests)assert.throws(()=>receive(bytes(request(skill))));
 for(const receive of receiveRequests){assert.throws(()=>receive(bytes({...request(skills[1]),procedure:{source:'builtin',id:'briefing',version:1,manifestDigest:'f'.repeat(64)}})));assert.throws(()=>receive(bytes({...request(skills[1]),skill:{...skills[1],allowedTools:['*']}})));}
});

test('admission and history retain the exact selected pin, revision and ordered uploads',async()=>{
 for(const skill of skills){
  const body={run,request:stored(skill),lastSequence:1,replayed:false},admitted=input.receiveConversationInputRequest(bytes(request(skill)));
  assert.deepEqual((await input.receiveConversationInputResponse(200,bytes(body),admitted,context)).request,body.request);
  for(const change of [r=>{r.skill.skillVersion='1.1.0';},r=>{r.documentRevision.versionId=id(900);},r=>{r.uploads[0].sha256='f'.repeat(64);}]){const bad=structuredClone(body);change(bad.request);await assert.rejects(input.receiveConversationInputResponse(200,bytes(bad),admitted,context));}
  const page=transcript();page.turns[0].request=stored(skill);const q=history.receiveConversationHistoryRequest('transcript',bytes({conversationId:binding.conversationId}));
  assert.deepEqual((await history.receiveConversationHistoryResponse('transcript',200,bytes(page),q)).turns[0].request,stored(skill));
  const chain=resumed();for(const turn of chain.turns)turn.request={...stored(skill),requestId:turn.request.requestId};chain.turns[1].request.skill.proseSha256='f'.repeat(64);
  await assert.rejects(history.receiveConversationHistoryResponse('transcript',200,bytes(chain),q));
 }
});

test('cited report is an actual advertised immutable asset and new manifest sources remain recorded',async()=>{
 const descriptor=app.CONVERSATION_SKILLS.find(s=>s.skillId===skills[1].skillId&&s.version===skills[1].skillVersion);assert.ok(descriptor);assert.match(descriptor.manifestSha256,/^[a-f0-9]{64}$/u);
 const metadata=JSON.parse(await readFile(new URL('../dist/conversation-application.metadata.json',import.meta.url),'utf8'));
 for(const path of ['retrieval-0.3/skill-manifest.schema.json','retrieval-0.3/installed-skill.mjs']){const row=metadata.sources.find(r=>r.path===path),source=await readFile(new URL('../'+path,import.meta.url));assert.ok(row,path);assert.equal(row.sha256,createHash('sha256').update(source).digest('hex'));assert.equal(row.bytes,source.length);}
});

test('physical immutable0.1.25 receivers keep ordinary compatibility and refuse these new combinations',{skip:process.env.MERI_PRIOR_SELECTED_CONTRACTS?false:'Exact prior0.1.25 package path required'},async()=>{
 const old={};for(const family of ['application','input','initial-input','history'])old[family]=await import(pathToFileURL(join(process.env.MERI_PRIOR_SELECTED_CONTRACTS,'dist','conversation-'+family+'.mjs')).href);
 const plain={requestId:id(6),prompt:'Ordinary input'};
 assert.deepEqual(old.application.receiveConversationRequest('submit',bytes(plain)),app.receiveConversationRequest('submit',bytes(plain)));
 for(const skill of skills){const {uploads,...revisionOnly}=request(skill);for(const receive of [b=>old.application.receiveConversationRequest('submit',b),old.input.receiveConversationInputRequest,old['initial-input'].receiveConversationInitialInputRequest])assert.throws(()=>receive(bytes(revisionOnly)));}
 const page=transcript(),q={conversationId:binding.conversationId};assert.deepEqual(await old.history.receiveConversationHistoryResponse('transcript',200,bytes(page),old.history.receiveConversationHistoryRequest('transcript',bytes(q))),await history.receiveConversationHistoryResponse('transcript',200,bytes(page),history.receiveConversationHistoryRequest('transcript',bytes(q))));
 for(const skill of skills){page.turns[0].request=stored(skill);delete page.turns[0].request.uploads;await assert.rejects(old.history.receiveConversationHistoryResponse('transcript',200,bytes(page),old.history.receiveConversationHistoryRequest('transcript',bytes(q))));}
});
