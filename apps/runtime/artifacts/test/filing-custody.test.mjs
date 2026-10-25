import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createRuntimeFilingCustody} from '../filing-custody.mjs';
import {NOW,id} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {filingCustodyFixture as fixture,binding,scopes,limits} from './filing-fixture.mjs';
for(const native of [false,true])test(`filing reads exact ${native?'native captured':'typed'} bytes through canonical inspect/download and rechecks`,async t=>{
 const x=await fixture(t,{native}),before={puts:x.documents.state.puts,executions:x.documents.state.executions.length};
 const result=await x.custody.read(x.call);
 assert.deepEqual(result,{versionId:x.versionId,filename:native?'café.txt':'Synthetic.txt',mimeType:native?'application/octet-stream':'text/plain; charset=utf-8',object:x.object,bytes:x.expectedBytes});
 assert.deepEqual(x.state.intents,['inspect','download']);assert.ok(x.state.coreCalls.every(q=>['inspect','download'].includes(q.intent)));
 const {bytes,...metadata}=result;assert.deepEqual(await x.custody.recheck({...x.call,versionId:x.versionId}),metadata);
 assert.deepEqual(x.state.intents,['inspect','download','inspect']);
 assert.equal(x.documents.state.puts,before.puts);assert.equal(x.documents.state.executions.length,before.executions);
 assert.equal(Object.hasOwn(result,'credential'),false);assert.equal(Object.hasOwn(result,'version'),false);
});

test('canonical native source conversation/run survives a committed continuation mapping',async t=>{
 const x=await fixture(t,{native:true,sourceConversation:true});assert.deepEqual((await x.custody.read(x.call)).bytes,x.expectedBytes);
 assert.notEqual(x.state.file.binding.conversationId,binding.conversationId);
});

for(const field of ['versionId','sha256','bytes'])test(`selected object ${field} substitution refuses before download`,async t=>{
 const x=await fixture(t),object={...x.object,[field]:field==='versionId'?'different-s3-version':field==='sha256'?'f'.repeat(64):x.object.bytes+1};
 await assert.rejects(x.custody.read({...x.call,object}),{code:'ARTIFACT_FILING_OBJECT_MISMATCH'});assert.deepEqual(x.state.intents,['inspect']);
});

test('caller binding must equal the existing application current context, not just the same actor',async t=>{
 const x=await fixture(t);x.state.lookup=()=>x.versionId;
 await assert.rejects(x.custody.read({...x.call,binding:{...binding,runId:id(900)}}));assert.equal(x.state.intents.includes('download'),false);
});

test('source object scopes cannot be replaced with the filing destination or a foreign actor',async t=>{
 const x=await fixture(t,{native:true});
 await assert.rejects(x.custody.read({...x.call,scopes:[{...scopes[0],resourceId:id(901)}]}),{code:'ARTIFACT_FILING_INPUT'});
 assert.equal(x.state.intents.length,0);
 x.state.file.binding={...binding,actorId:id(902)};await assert.rejects(x.custody.read(x.call));assert.equal(x.state.intents.includes('download'),false);
});

for(const lost of ['session','Core','retention'])test(`${lost} revocation after inspection withholds download`,async t=>{
 const x=await fixture(t,{native:true});x.state.onResolve=call=>{if(call.intent!=='download')return;
  if(lost==='session')x.f.state.revoked=true;
  if(lost==='Core')x.state.coreStatus=403;
  if(lost==='retention')x.documents.sql.suppressed.add(`${binding.tenantId}:artifact:${x.object.objectId}`);
 };
 await assert.rejects(x.custody.read(x.call),{code:'ARTIFACT_FILING_CUSTODY_REFUSED'});
 assert.deepEqual(x.state.intents,['inspect','download']);assert.equal(x.documents.state.puts,0);
});

test('recheck refuses a changed visible version and fresh retention suppression',async t=>{
 const x=await fixture(t,{native:true});await x.custody.read(x.call);
 const calls=x.state.intents.length;x.state.lookup=()=>id(903);
 await assert.rejects(x.custody.recheck({...x.call,versionId:x.versionId}),{code:'ARTIFACT_FILING_OBJECT_MISMATCH'});assert.equal(x.state.intents.length,calls);
 x.state.lookup=null;x.documents.sql.suppressed.add(`${binding.tenantId}:conversation:${binding.conversationId}`);
 await assert.rejects(x.custody.recheck({...x.call,versionId:x.versionId}));
});

for(const changed of ['bytes','filename'])test(`changed native ${changed} cannot escape selected custody`,async t=>{
  const x=await fixture(t,{native:true});x.state.onResolve=call=>{if(call.intent==='download'){
   if(changed==='bytes')x.documents.state.objects.set(v.hash(x.object),Buffer.from('Changed file contents'));
   else x.state.file.entry.path='output/other.txt';
  }};
  await assert.rejects(x.custody.read(x.call));
});

test('response bounds and expired or cancelled calls refuse before lookup or application work',async t=>{
 const x=await fixture(t,{native:true}),small=createRuntimeFilingCustody({...x.config,limits:{...limits,maxResponseBytes:1}});
 await assert.rejects(small.read(x.call),{code:'ARTIFACT_FILING_LIMIT'});
 await assert.rejects(x.custody.read({...x.call,deadlineMs:NOW}),{code:'DEADLINE'});
 const controller=new AbortController();controller.abort();await assert.rejects(x.custody.read({...x.call,signal:controller.signal}),{code:'DEADLINE'});
 assert.equal(x.state.lookups.length,0);assert.equal(x.state.intents.length,0);
});
