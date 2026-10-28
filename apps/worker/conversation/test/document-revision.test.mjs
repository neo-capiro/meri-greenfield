/** One synthetic SDK stream through the real activity; no model call or native qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {documentRevisionContextSuffix} from '../document-revision.mjs';
import {applicationFixture,binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
const selection={artifactId:id(800),versionId:id(801),objectSha256:'a'.repeat(64)},source={operation:'create_word',format:'txt',title:'Original',content:{text:'Original source data'}};
const context=()=>({selection,request:source,specSha256:v.hash(source)});
test('selected source reaches the same one SDK query while the stored user prompt stays exact',async()=>{
 let reads=0,calls=0,seen,closed=0;const f=await applicationFixture({initialInput:true,serviceOptions:{documentRevisionSource:async()=>{reads++;return context();}}});const input={...f.input,documentRevision:selection};
 try{await f.service.allocateInput({credential:f.credential,input});await f.service.submit({credential:f.credential,input});
  const activity=createConversationActivity({runOwner:f.runOwner,prepareRuntime:async()=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,model:'us.anthropic.claude-sonnet-4-6',region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+3000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024}),query:args=>{calls++;seen=args;return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false};},close(){closed++;}};}});
  await activity({binding});assert.equal(reads,1);assert.equal(calls,1);assert.equal(closed,1);assert.equal(seen.prompt,input.prompt);assert.equal(seen.options.systemPrompt.preset,'claude_code');assert.equal(seen.options.systemPrompt.append.split(JSON.stringify(context())).length-1,1);assert.deepEqual((await f.service.history({credential:f.credential})).request.documentRevision,selection);
 }finally{f.close();}
});
test('missing, substituted, corrupt or extra selected context cannot reach SDK options',()=>{
 const request={skill:null,documentRevision:selection};for(const raw of [undefined,{...context(),selection:{...selection,versionId:id(802)}},{...context(),specSha256:'f'.repeat(64)},{...context(),credential:'hidden'}])assert.throws(()=>documentRevisionContextSuffix(request,raw),{code:'DOCUMENT_REVISION_CONTEXT_REFUSED'});
 assert.equal(documentRevisionContextSuffix({skill:null},undefined),'');assert.throws(()=>documentRevisionContextSuffix({skill:null},context()));
});

test('eligible installed selected reports reach the same SDK query with immutable source and recipe-specific guidance',async()=>{
 for(const skill of [{skillId:'quick_skill.bill_watch',skillVersion:'2.0.0'},{skillId:'quick_skill.cited_report',skillVersion:'1.0.0'}]){
  let calls=0,seen;const f=await applicationFixture({initialInput:true,serviceOptions:{documentRevisionSource:async()=>context()}});
  const input={...f.input,skill,documentRevision:selection,windowRequest:{basis:'explicit',startInclusive:'2026-10-01T00:00:00Z',endExclusive:'2026-10-24T00:00:00Z',timezone:'UTC'}};
  try{await f.service.allocateInput({credential:f.credential,input});await f.service.submit({credential:f.credential,input});
   const activity=createConversationActivity({runOwner:f.runOwner,prepareRuntime:async()=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,model:'us.anthropic.claude-sonnet-4-6',region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+3000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024}),query:args=>{calls++;seen=args;return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false};},close(){}};}});
   await activity({binding});assert.equal(calls,1);assert.equal(seen.prompt,input.prompt);assert.equal(seen.options.systemPrompt.preset,'claude_code');assert.ok(seen.options.systemPrompt.append.includes(selectSkill(skill.skillId,skill.skillVersion).prose));
   const suffix=documentRevisionContextSuffix({...input,skill:selectSkill(skill.skillId,skill.skillVersion).pin},context());assert.ok(seen.options.systemPrompt.append.includes(suffix));assert.match(suffix,/selected report recipe/u);assert.doesNotMatch(suffix,/same request_document tool/u);assert.equal(suffix.split(JSON.stringify(context())).length-1,1);
  }finally{f.close();}
 }
});

test('recipe eligibility cannot replace original source identity or authorize an unrelated selected recipe',()=>{
 const selected=selectSkill('quick_skill.cited_report','1.0.0').pin,request={skill:selected,documentRevision:selection};
 for(const bad of [undefined,{...context(),selection:{...selection,versionId:id(802)}},{...context(),specSha256:'f'.repeat(64)},{...context(),credential:'hidden'}])assert.throws(()=>documentRevisionContextSuffix(request,bad),{code:'DOCUMENT_REVISION_CONTEXT_REFUSED'});
 for(const skill of [{...selected,skillVersion:'1.1.0'},{...selected,skillId:'quick_skill.commitments_audit'}])assert.throws(()=>documentRevisionContextSuffix({...request,skill},context()),{code:'DOCUMENT_REVISION_CONTEXT_REFUSED'});
});
