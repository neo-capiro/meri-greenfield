/** Actual conversation owner/store over scripted PostgreSQL protocol. No native/database or model acceptance claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFixture,binding,scopes,versions,id} from './application-fixture.mjs';
import {createConversationService} from '../service.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
const selection={uploadId:id(701),sha256:'a'.repeat(64)};
const manifest={selection,versionId:'original-version',filename:'note.txt',mimeType:'text/plain',bytes:40,extractionStatus:'partial',limitations:['OCR_UNCERTAIN'],sourceSha256:'b'.repeat(64),pageCount:1,scopes};
const text='External source data.';
const fragments=[{ordinal:0,text,method:'ocr',confidence:0.8,location:{page:1,slide:null,sheet:null,rowStart:null,rowEnd:null},sourceSha256:selection.sha256,trust:'external_untrusted',startCharacter:0,endCharacter:text.length}];
const page={...manifest,page:0,fragments,pageSha256:hash(fragments),nextPage:null};
async function fixture(){
 let f,reads=0,publishes=0,mode,removed=false;const trace=[];
 const source={async admit(){return structuredClone(manifest);},async read(){
  if(removed)throw Object.assign(Error('UPLOAD_ACCESS_DENIED'),{code:'UPLOAD_ACCESS_DENIED'});
  reads++;trace.push('read');const value=structuredClone(page);
  if(mode==='scopes')value.scopes=[{...scopes[0],resourceId:id(999)}];
  if(mode==='corrupt')value.fragments[0].text='Altered';
  if(mode==='drift'&&publishes)value.versionId='different-version';
  return value;
 }};
 f=await applicationFixture({initialInput:true,serviceOptions:{uploadInputSource:source}});
 const input={...f.input,uploads:[selection]};await f.service.allocateInput({credential:f.credential,input});await f.service.submit({credential:f.credential,input});
 for(const [n,state] of [[800,'starting'],[801,'running']])await f.service.publish({credential:f.credential,binding,event:{eventId:id(n),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}}});
 const store={...f.store,async appendSource(...args){publishes++;trace.push('publish');const result=await f.store.appendSource(...args);
  if(mode==='unknown')throw Object.assign(Error('lost acknowledgement'),{code:'STORE_COMMIT_UNKNOWN'});
  if(mode==='revoke')f.state.revoked=true;if(mode==='removed')removed=true;return result;
 }};
 const service=createConversationService({sessions:f.sessions,store,dispatcher:f.dispatcher,versions,uploadInputSource:source});
 return {...f,service,trace,setMode:value=>mode=value,counts:()=>({reads,publishes}),read:input=>service.readUploadSource({credential:f.credential,binding,input:input??{selection,page:0}}),
  events:()=>[...f.state.events.values()].flat().map(row=>row.event).filter(event=>event.type==='source.native-upload')};
}
test('exact selected page is durably observed before release and exact repeat is one event',async()=>{
 const f=await fixture();try{assert.deepEqual(await f.read(),page);assert.deepEqual(f.trace,['read','publish','read']);assert.equal(f.events().length,1);
  const event=f.events()[0];assert.equal(event.data.source.uploadId,selection.uploadId);assert.equal(event.data.source.sha256,selection.sha256);assert.equal(event.data.page.sha256,page.pageSha256);
  assert.equal(event.data.page.fragmentCount,1);assert.equal(event.data.source.extractionStatus,'partial');assert.equal(JSON.stringify(event).includes(text),false);assert.equal(Object.hasOwn(event.data,'authorizationId'),false);
  await f.read();assert.equal(f.events().length,1);assert.equal(f.counts().publishes,2);
 }finally{f.close();}
});
test('only persisted selector, current binding and bounded page can enter the source owner',async()=>{
 const f=await fixture();try{
  await assert.rejects(f.read({selection:{...selection,uploadId:id(702)},page:0}),{code:'SCOPE_REFUSED'});
  await assert.rejects(f.read({selection,page:256}),{code:'INVALID_REQUEST'});
  await assert.rejects(f.service.readUploadSource({credential:f.credential,binding:{...binding,runId:id(999)},input:{selection,page:0}}),{code:'STALE_WRITER'});
  assert.equal(f.counts().reads,0);assert.equal(f.events().length,0);
 }finally{f.close();}
});
test('foreign scope or corrupted page cannot publish a source observation',async()=>{
 for(const mode of ['scopes','corrupt']){const f=await fixture();try{f.setMode(mode);await assert.rejects(f.read(),error=>nativeReadFailureCode(error)==='INVALID_RESULT');assert.equal(f.counts().publishes,0);assert.equal(f.events().length,0);}finally{f.close();}}
});
test('source removal, current revocation and changed original identity during publication withhold text',async()=>{
 for(const mode of ['removed','revoke','drift']){const f=await fixture();try{f.setMode(mode);await assert.rejects(f.read());assert.equal(f.events().length,1,'the actual earlier observation is retained, not permission to release');}finally{f.close();}}
});
test('lost publication acknowledgement is UNKNOWN, without implicit retry or source release',async()=>{
 const f=await fixture();try{f.setMode('unknown');await assert.rejects(f.read(),error=>nativeReadFailureCode(error)==='SOURCE_PUBLICATION_UNKNOWN');
  assert.deepEqual(f.counts(),{reads:1,publishes:1});assert.equal(f.events().length,1);
  f.setMode(null);await f.read();assert.equal(f.events().length,1,'explicit exact read reconciles the one durable observation');
 }finally{f.close();}
});
