/** One synthetic SDK stream through the real activity; no model call or native qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {documentRevisionContextSuffix} from '../document-revision.mjs';
import {applicationFixture,binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
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
