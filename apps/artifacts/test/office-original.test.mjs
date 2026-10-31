import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeDocumentFixture,sha} from './native-document-fixture.mjs';
import {id} from '../storage/test/sql-fixture.mjs';
import {preservationBytes} from '../edit-sessions/test/preservation-fixture.mjs';
import {OFFICE_ORIGINAL_KIND,OFFICE_OPERATIONS,OFFICE_EDIT_KIND,officeOriginalTitle} from '../../../packages/contracts/office-edit.mjs';
import {createArtifactService} from '../service.mjs';
import {verifyArtifactVersionStorageRecord} from '../storage/version-record.mjs';
function fixture(format='docx'){
 const f=nativeDocumentFixture(),bytes=preservationBytes(format);
 const request={sourceKind:OFFICE_ORIGINAL_KIND,operation:OFFICE_OPERATIONS[format],format,title:'Original',original:{
  uploadId:id(701),requestId:id(702),objectId:id(703),objectVersionId:'retained-original-version',sha256:sha(bytes),bytes:bytes.length,filename:'Original.'+format}};
 const owner=changes=>f.owner({officeOriginalWrites:true,...changes});
 return {...f,bytes,request,import:(r=request,b=bytes,c={})=>owner(c).executeOfficeOriginal(r,b),recover:(c={})=>owner(c).recoverOfficeOriginal(request,bytes)};
}
for(const format of ['docx','xlsx','pptx'])test(format+': exact original import, download, editor source, Office revision and replay use canonical owners without rendering',async()=>{
 const f=fixture(format),result=await f.import(),stored=f.sql.state.versions.get(result.version.versionId).record;
 verifyArtifactVersionStorageRecord(stored);assert.deepEqual(stored.spec,f.request);
 assert.equal(result.version.parentVersionId,null);assert.notEqual(result.version.object.objectId,f.request.original.objectId);
 assert.notEqual(result.version.versionId,f.request.original.objectVersionId);assert.notEqual(result.version.object.versionId,f.request.original.objectVersionId);
 assert.deepEqual(f.state.objects.get(v.hash(result.version.object)),f.bytes);assert.equal(f.state.executions.length,0);
 const service=createArtifactService({...f.options,ids:()=>({artifactId:id(810),versionId:id(811),objectId:id(812)})});
 assert.deepEqual((await service.download(result.version.versionId,f.context)).bytes,f.bytes);
 assert.deepEqual((await service.editorSource(result.version.versionId,f.context,{write:true})).bytes,f.bytes);
 const renewed={...f.context,binding:{...f.context.binding,runId:id(704)},deadlineMs:f.context.deadlineMs+1000};
 assert.deepEqual((await f.recover({context:renewed})).version,result.version);assert.equal(f.state.puts,1);assert.equal(f.sql.durable.state.writes,1);
 const edited=preservationBytes(format,'after'),request={sourceKind:OFFICE_EDIT_KIND,operation:OFFICE_OPERATIONS[format],format,title:'Original',edit:{
  sessionId:id(705),draftSequence:1,draftSha256:sha(edited),baseVersionId:result.version.versionId,baseObjectSha256:sha(f.bytes),editorActorId:f.context.binding.actorId}};
 const revision=await f.owner({officeEditWrites:true}).executeOfficeEdit({deliveryId:`office:${id(705)}:1`,baseVersionId:result.version.versionId,request},edited);
 assert.equal(revision.version.parentVersionId,result.version.versionId);assert.equal(revision.version.artifactId,result.version.artifactId);
 assert.deepEqual(f.state.objects.get(v.hash(revision.version.object)),edited);assert.equal(f.state.executions.length,0);
 assert.deepEqual((await f.import()).version,result.version);assert.equal(f.state.puts,2);
});
test('typed generation cannot accept original provenance or render over an imported original',async()=>{
 const f=fixture(),result=await f.import();assert.throws(()=>v.request(f.request));
 await assert.rejects(f.owner().executeOfficeOriginal(f.request,f.bytes),/OFFICE_IMPORT_UNAVAILABLE/);
 await assert.rejects(f.owner().execute({deliveryId:'typed',baseVersionId:result.version.versionId,request:{operation:'create_word',format:'docx',title:'Original',content:{blocks:[]}}}));
 assert.equal(f.state.executions.length,0);assert.equal(f.state.puts,1);
});
test('long Unicode filename provenance survives title truncation without splitting a code point',async()=>{
 const f=fixture(),filename='a'.repeat(199)+'\u{1F4C4}file.docx';
 const request={...f.request,title:officeOriginalTitle(filename,'docx'),original:{...f.request.original,filename}};
 const result=await f.import(request);assert.equal(result.version.object.sha256,sha(f.bytes));
 assert.equal(f.sql.state.versions.get(result.version.versionId).record.spec.original.filename,filename);
 assert.equal(request.title,'a'.repeat(199));
});
test('read-only recovery with no claim cannot allocate or dispatch',async()=>{
 const f=fixture();await assert.rejects(f.recover(),/OFFICE_IMPORT_UNRESOLVED/);
 assert.equal(f.state.rows.size,0);assert.equal(f.state.puts,0);assert.equal(f.sql.durable.state.writes,0);
});
for(const phase of ['claim','object','settle'])test('lost '+phase+' acknowledgement never dispatches a second import',async()=>{
 const f=fixture();if(phase==='object')f.state.putHook=()=>{throw Error('OBJECT_ACK_LOST');};else f.state.loseCommit=phase;
 await assert.rejects(f.import());f.state.putHook=null;const puts=f.state.puts,writes=f.sql.durable.state.writes;
 if(phase==='settle')assert.equal((await f.recover()).version.object.sha256,sha(f.bytes));else await assert.rejects(f.recover(),/ARTIFACT_REPLAY_UNRESOLVED/);
 assert.equal(f.state.puts,puts);assert.equal(f.sql.durable.state.writes,writes);
});
test('concurrent imports from refreshed runs converge on one immutable original',async()=>{
 const f=fixture(),context={...f.context,binding:{...f.context.binding,runId:id(706)}};
 const results=await Promise.allSettled([f.import(),f.import(f.request,f.bytes,{context})]);assert.ok(results.some(x=>x.status==='fulfilled'));
 assert.equal(f.state.puts,1);assert.equal(f.sql.durable.state.writes,1);assert.equal((await f.recover({context})).version.object.sha256,sha(f.bytes));
});
for(const change of ['source-version','hash','actor','client','bytes','suppressed','revoked'])test('original recovery refuses changed '+change,async()=>{
 const f=fixture(),first=await f.import(),request=structuredClone(f.request);let context=f.context;
 if(change==='source-version')request.original.objectVersionId='substituted-version';
 if(change==='hash')request.original.sha256='a'.repeat(64);
 if(change==='actor')context={...context,binding:{...context.binding,actorId:'another-actor'}};
 if(change==='client')context={...context,scopes:context.scopes.map(s=>({...s,resourceId:id(799)}))};
 if(change==='bytes')f.state.objects.set(v.hash(first.version.object),Buffer.from('corrupt'));
 if(change==='suppressed')f.sql.suppressed.add(`${context.binding.tenantId}:artifact:${first.version.artifactId}`);
 if(change==='revoked')f.state.denied=true;
 await assert.rejects(f.owner({officeOriginalWrites:true,context}).recoverOfficeOriginal(request,f.bytes));assert.equal(f.state.puts,1);assert.equal(f.sql.durable.state.writes,1);
});
test('authority withdrawal after object write cannot publish or trigger a later redispatch',async()=>{
 const f=fixture();f.state.putHook=()=>{f.state.denied=true;};await assert.rejects(f.import());assert.equal(f.sql.durable.state.writes,0);
 f.state.denied=false;f.state.putHook=null;await assert.rejects(f.recover());assert.equal(f.state.puts,1);
});
