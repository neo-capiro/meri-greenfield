/** Canonical request journal/current session; scripted SQL only, no provider/DB process. */
import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,binding,id} from './application-fixture.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const selection={artifactId:id(800),versionId:id(801),objectSha256:'a'.repeat(64)},source={operation:'create_word',format:'txt',title:'Original',content:{text:'Keep original data'}};
const context=()=>({selection,request:source,specSha256:v.hash(source)});
async function fixture(read){const calls=[];const f=await applicationFixture({initialInput:true,serviceOptions:{documentRevisionSource:async input=>{calls.push(input);return read?read(input,f):context();}}});const input={...f.input,documentRevision:selection};return {...f,input,calls,async admit(){await f.service.allocateInput({credential:f.credential,input});return f.service.admitInput({credential:f.credential,input});}};}
test('revision selector is retained exactly through allocation/admission/reload, without reading source or dispatching',async()=>{
 const f=await fixture();try{const a=await f.admit();assert.deepEqual(a.request.documentRevision,selection);assert.equal(f.calls.length,0);assert.equal(f.state.starts,0);assert.deepEqual((await f.service.history({credential:f.credential})).request,a.request);assert.equal((await f.admit()).replayed,true);
  for(const change of [undefined,{...selection,versionId:id(802)},{...selection,objectSha256:'b'.repeat(64)}]){const wrong={...f.input};if(change===undefined)delete wrong.documentRevision;else wrong.documentRevision=change;await assert.rejects(f.service.admitInput({credential:f.credential,input:wrong}));}assert.equal(f.state.runs.size,1);assert.equal(f.state.starts,0);
 }finally{f.close();}
});
test('worker load obtains current original context once and leaves persisted prompt/selector unchanged',async()=>{
 const f=await fixture();try{await f.admit();const loaded=await f.service.loadForExecution({credential:f.credential,binding});assert.deepEqual(loaded.documentRevisionContext,context());assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].binding,binding);assert.deepEqual(f.calls[0].selection,selection);const history=await f.service.history({credential:f.credential});assert.equal(history.request.prompt,f.input.prompt);assert.equal(Object.hasOwn(history,'documentRevisionContext'),false);assert.equal(JSON.stringify(history).includes(source.content.text),false);assert.equal(f.state.starts,0);}finally{f.close();}
});
test('source failure or current revocation withholds worker context and never dispatches',async()=>{
 for(const read of [()=>{throw Error('SOURCE_REFUSED');},(_,f)=>{f.state.revoked=true;return context();}]){const f=await fixture(read);try{await f.admit();await assert.rejects(f.service.loadForExecution({credential:f.credential,binding}));assert.equal(f.state.starts,0);}finally{f.close();}}
});
test('ordinary stored requests require no revision owner and unknown source fields never become authority',async()=>{
 const f=await applicationFixture({initialInput:true});try{for(const bad of [{...selection,credential:'not-authority'},{...selection,objectSha256:'A'.repeat(64)},null])await assert.rejects(f.service.allocateInput({credential:f.credential,input:{...f.input,documentRevision:bad}}),{code:'INVALID_REQUEST'});
  await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.admitInput({credential:f.credential,input:f.input});const loaded=await f.service.loadForExecution({credential:f.credential,binding});assert.equal(Object.hasOwn(loaded,'documentRevisionContext'),false);
 }finally{f.close();}
});
