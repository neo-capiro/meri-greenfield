import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfficeOriginalReader} from '../office-source.mjs';
import {createUploadCustody,hash} from '../custody.mjs';
import {createUploadInspection} from '../extraction.mjs';
import {uploadHash,UPLOAD_MIME} from '../policy.mjs';
import {createActionSessionOwner,authenticatedCurrentState} from '../../action-host/session/owner.mjs';
import {createMemoryRetentionJournal} from '../../retention/memory-journal.mjs';
import {createRetentionReadGate} from '../../retention/suppression.mjs';
import {preservationBytes} from '../../../artifacts/edit-sessions/test/preservation-fixture.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
async function fixture(t,{scan='clean',format='pptx',original=null}={}){
 const state={now:Date.now(),denied:false,suppressed:false,rows:new Map(),puts:0,gets:0},now=()=>state.now;
 const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
 const scopes=[{tenantId:id(1),kind:'private-user',resourceId:id(2),policyRevision:'p'}];
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:60000,maxFactBytes:65536},
  verifyIdentity:async()=>{if(state.denied)throw Error('DENIED');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'i',checkedAtMs:now(),expiresAtMs:now()+60000};},
  resolveContext:async({identity})=>({identitySha256:hash(identity),binding,scopes,selectedClientId:null,contextRevision:'c',checkedAtMs:now(),expiresAtMs:now()+60000})});
 t.after(()=>sessions.close());const {credential}=await sessions.issue({identityCredential:'synthetic'}),native=authenticatedCurrentState(sessions);
 const bytes=original??preservationBytes(format),declaration={filename:'Original.'+format,mimeType:UPLOAD_MIME[format],bytes:bytes.length,sha256:uploadHash(bytes)};
 const store={async prepare(r){state.rows.set(r.uploadId,structuredClone(r));return r;},async read(owner,key){return structuredClone(state.rows.get(key)??null);},
  async transition(a,b,check){check();assert.equal(hash(state.rows.get(a.uploadId)),hash(a));state.rows.set(a.uploadId,structuredClone(b));return b;}};
 const objects={async put(r){state.puts++;return {objectId:r.objectId,versionId:'STORED_ORIGINAL_VERSION',sha256:uploadHash(bytes),bytes:bytes.length,scopes:r.scopes};},
  async get(){state.gets++;return Buffer.from(state.corrupt?Buffer.from('wrong'):bytes);},async observePut(){throw Error('UNEXPECTED_OBSERVE');}};
 const retention=createRetentionReadGate({journal:{...createMemoryRetentionJournal(),get:async()=>state.suppressed?{state:'SUPPRESSED'}:null},serving:{isEnabled:()=>true}});
 const inspection=createUploadInspection({now,scanner:{async scan(){return {sourceSha256:uploadHash(bytes),sourceBytes:bytes.length,checkedAtMs:now(),status:scan,
  tool:{name:'synthetic',version:'1',binarySha256:'a'.repeat(64)},definitionsSha256:'b'.repeat(64),reason:scan==='infected'?'MALWARE_DETECTED':null};}}});
 const options={deadlineMs:now()+30000};let sequence=20;
 const config={sessions,store,objects,inspection,retention,now,removeOriginal:async()=>{throw Error('UNEXPECTED_REMOVE');}};
 const custody=createUploadCustody({...config,ids:()=>id(sequence++),current:async()=>(await native({credential})).current});
 const r=await custody.initiate({requestId:id(10),declaration},options);await custody.put(r.uploadId,bytes,options);await custody.inspect(r.uploadId,options);
 const reader=createOfficeOriginalReader(config),q={credential,binding,scopes,selectedClientId:null,selection:{uploadId:r.uploadId,sha256:declaration.sha256},...options};
 return {state,bytes,q,reader,row:()=>state.rows.get(r.uploadId)};
}
test('clean original remains editable when extraction is unavailable, without another write or extraction',async t=>{
 const f=await fixture(t);assert.equal(f.row().inspection.extraction.status,'unavailable');
 const source=await f.reader.open(f.q);t.after(source.close);assert.deepEqual(source.bytes,f.bytes);
 assert.equal(source.source.original.objectVersionId,'STORED_ORIGINAL_VERSION');assert.equal(source.source.original.uploadId,f.q.selection.uploadId);
 const gets=f.state.gets;await source.fresh();assert.equal(f.state.gets,gets);assert.equal(f.state.puts,1);
});
test('infected original is never offered to Office',async t=>{
 const f=await fixture(t,{scan:'infected'}),gets=f.state.gets;await assert.rejects(f.reader.open(f.q));assert.equal(f.state.gets,gets);
});
for(const change of ['hash','actor','scope','client','bytes'])test('opening original refuses changed '+change,async t=>{
 const f=await fixture(t),q=structuredClone(f.q);
 if(change==='hash')q.selection.sha256='e'.repeat(64);
 if(change==='actor')q.binding.actorId=id(88);
 if(change==='scope')q.scopes[0].policyRevision='changed';
 if(change==='client')q.selectedClientId=id(88);
 if(change==='bytes')f.state.corrupt=true;
 await assert.rejects(f.reader.open(q));assert.equal(f.state.puts,1);
});
for(const change of ['access','retention','removal','object-version','scan'])test('freshness refuses '+change+' after the original read',async t=>{
 const f=await fixture(t),source=await f.reader.open(f.q);t.after(source.close);
 if(change==='access')f.state.denied=true;
 if(change==='retention')f.state.suppressed=true;
 if(change==='removal')f.row().state='removing';
 if(change==='object-version')f.row().object.versionId='SUBSTITUTED';
 if(change==='scan'){f.row().inspection.scan.status='infected';f.row().inspection.scan.reason='MALWARE_DETECTED';}
 await assert.rejects(source.fresh());assert.equal(f.state.puts,1);
});
test('a structurally refused original is retained as stored-then-blocked and is never offered to Office',async t=>{
 const {zip,ooxmlEntries}=await import('../../../artifacts/structure/test/fixtures.mjs');
 const f=await fixture(t,{format:'docx',original:zip({...ooxmlEntries('docx'),'word/embeddings/embedded.xml':'<data/>'})});
 assert.equal(f.row().state,'stored');assert.equal(f.row().inspection.scan.status,'clean');
 assert.equal(f.row().inspection.extraction.status,'blocked');assert.deepEqual(f.row().inspection.extraction.limitations,['UPLOAD_ACTIVE_CONTENT']);
 // custody.read serves the user's own clean bytes; the Office provenance gate refuses before any source is returned.
 await assert.rejects(f.reader.open(f.q),{code:'UPLOAD_NOT_CLEAN'});assert.equal(f.state.puts,1);
});
