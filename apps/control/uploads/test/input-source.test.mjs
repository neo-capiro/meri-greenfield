import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,binding,id} from '../../conversations/test/application-fixture.mjs';
import {createUploadCustody} from '../custody.mjs';
import {createUploadInspection} from '../extraction.mjs';
import {createUploadInputReader,projectUploadInputSource,UPLOAD_SOURCE_PAGE_FRAGMENTS} from '../input-source.mjs';
import {uploadHash} from '../policy.mjs';
const clone=structuredClone;
async function fixture(text='Ordinary uploaded source'){
 const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];
 const f=await applicationFixture({scopes,selectedClientId:null}),state=Object.assign(f.state,{row:null,gets:0,reads:0}),now=Date.now;
 const bytes=Buffer.from(text),declaration={filename:'.claude.txt',mimeType:'text/plain',bytes:bytes.length,sha256:uploadHash(bytes)};
 const store={async prepare(row){state.row=clone(row);return clone(row);},async read(){state.reads++;return clone(state.row);},async transition(old,next,check){check();state.row=clone(next);return clone(next);}};
 const objects={async put(value){return {objectId:value.objectId,versionId:'original-version',bytes:bytes.length,sha256:declaration.sha256,scopes};},async get(){state.gets++;state.onGet?.();return Buffer.from(bytes);},async observePut(){return clone(state.row?.object);}};
 const tool={name:'fixture',version:'1',binarySha256:'a'.repeat(64)},receipt=()=>({sourceSha256:declaration.sha256,sourceBytes:bytes.length,checkedAtMs:now()});
 const inspection=createUploadInspection({now,scanner:{async scan(){return {...receipt(),status:'clean',tool,definitionsSha256:'b'.repeat(64),reason:null};}},extractor:{async extract(){return {...receipt(),status:'available',tool,segments:[{ordinal:0,text,method:'native',confidence:null,location:{page:null,slide:null,sheet:null,rowStart:null,rowEnd:null}}],limitations:[]};}}});
 const retention={async assertServable(){if(state.suppressed)throw Error('SUPPRESSED');},async withRelease(subjects,body,{signal}){await this.assertServable();return body(signal,()=>this.assertServable());}};
 const options=()=>({deadlineMs:now()+30000});
 const current=async()=>({...clone(f.state.context),checkedAtMs:now(),expiresAtMs:now()+30000});
 const deps={store,objects,inspection,retention,removeOriginal:async()=>{throw Error('unused');},now};
 const owner=createUploadCustody({...deps,current,ids:(()=>{let n=600;return()=>id(n++);})()});
 const initial=await owner.initiate({requestId:id(700),declaration},options());await owner.put(initial.uploadId,bytes,options());await owner.inspect(initial.uploadId,options());
 const selection={uploadId:initial.uploadId,sha256:declaration.sha256};
 const conversationStore={async read(b){return {run:{binding:b,scopes},request:{uploads:state.selected??[selection]}};}};
 const reader=createUploadInputReader({...deps,sessions:f.sessions,conversationStore});
 return {...f,state,reader,selection,options,owner,source:()=>clone(state.row),call:(extra={})=>({credential:f.credential,binding,selection,...options(),...extra})};
}
test('durable clean extraction becomes bounded inert SDK source with exact original identity and native page provenance',async()=>{
 const f=await fixture('A'.repeat(40000)+'😀source');try{
  const manifest=await f.reader.admit(f.call());assert.equal(manifest.versionId,'original-version');assert.deepEqual(manifest.selection,f.selection);assert.equal(manifest.extractionStatus,'available');assert.ok(manifest.pageCount>1);assert.equal(Object.hasOwn(manifest,'text'),false);
  const parts=[];for(let page=0;page<manifest.pageCount;page++){const part=await f.reader.admit(f.call({page}));assert.ok(part.fragments.length<=UPLOAD_SOURCE_PAGE_FRAGMENTS);assert.equal(part.sourceSha256,manifest.sourceSha256);for(const fragment of part.fragments){assert.equal(fragment.text.isWellFormed(),true);assert.equal(fragment.sourceSha256,f.selection.sha256);assert.equal(fragment.trust,'external_untrusted');assert.ok(JSON.stringify(fragment).length<2000);parts.push(fragment.text);}}
  assert.equal(parts.join(''),'A'.repeat(40000)+'😀source');assert.equal(manifest.filename,'.claude.txt');assert.equal(Object.hasOwn(manifest,'credential'),false);assert.ok(f.state.gets>=manifest.pageCount+1); }finally{f.close();}
});
test('current principal revocation, cross-thread binding, mismatched original hash, and retention suppression release no source',async()=>{
 const f=await fixture();try{
  await assert.rejects(f.reader.admit(f.call({binding:{...binding,conversationId:id(900)}})),/ACCESS_DENIED/);
  await assert.rejects(f.reader.admit(f.call({selection:{...f.selection,sha256:'0'.repeat(64)}})),/ORIGINAL_MISMATCH/);
  f.state.suppressed=true;await assert.rejects(f.reader.admit(f.call()),/SUPPRESSED/);f.state.suppressed=false;
  f.state.onGet=()=>{f.state.revoked=true;};await assert.rejects(f.reader.admit(f.call()));
 }finally{f.close();}
});
test('source resolution never converts pending/infected/unavailable extraction or removed original into admitted data',async()=>{
 const f=await fixture();try{
  f.state.row.inspection=null;await assert.rejects(f.reader.admit(f.call()),/NOT_CLEAN/);assert.equal(f.state.gets,1);
  const row=f.source();assert.throws(()=>projectUploadInputSource({...row,state:'removed',inspection:null}),/EXTRACTION_UNAVAILABLE/);
 }finally{f.close();}
});
test('private execution source requires stored exact selection and a fresh canonical borrowed action session',async()=>{
 const f=await fixture();try{
  const value={binding,selection:f.selection,page:0,...f.options()};const result=await f.reader.read(value);assert.equal(result.selection.uploadId,f.selection.uploadId);
  f.state.selected=[{...f.selection,sha256:'f'.repeat(64)}];await assert.rejects(f.reader.read(value),/ACCESS_DENIED/);f.state.selected=[f.selection];
  f.state.revoked=true;await assert.rejects(f.reader.read(value));
 }finally{f.close();}
});
