/** Real upload read, artifact journal/publication and Office adapters. Only
 * storage/Core transports and scanner observations are scripted; no live host. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {wopiFixture} from '../../../artifacts/edit-sessions/test/wopi-fixture.mjs';
import {preservationBytes} from '../../../artifacts/edit-sessions/test/preservation-fixture.mjs';
import {createOfficeOriginalReader} from '../../../control/uploads/office-source.mjs';
import {createUploadInspection} from '../../../control/uploads/extraction.mjs';
import {createMemoryRetentionJournal} from '../../../control/retention/memory-journal.mjs';
import {createRetentionReadGate} from '../../../control/retention/suppression.mjs';
import {UPLOAD_MIME,uploadHash} from '../../../control/uploads/policy.mjs';
import {createRuntimeOfficeApplication} from '../office-application.mjs';
import {createCollaboraCodeLaunch} from '../../../artifacts/edit-sessions/collabora-code.mjs';
import {id} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {OFFICE_SCHEMA,receiveOfficeRequest,receiveOfficeResponse} from '../../../../packages/contracts/dist/office-application.mjs';
const encode=value=>Buffer.from(JSON.stringify(value));
async function fixture(t,format='pptx'){
 const bytes=preservationBytes(format),f=await wopiFixture(t,{format}),now=f.artifactOptions.now;
 t.mock.method(Date,'now',now);
 const declaration={filename:'Original.'+format,mimeType:UPLOAD_MIME[format],sha256:uploadHash(bytes),bytes:bytes.length};
 const inspection=await createUploadInspection({now,scanner:{async scan(){return {sourceSha256:declaration.sha256,sourceBytes:bytes.length,checkedAtMs:now(),status:'clean',
  tool:{name:'synthetic',version:'1',binarySha256:'a'.repeat(64)},definitionsSha256:'b'.repeat(64),reason:null};}}}).inspect(declaration,bytes,{deadlineMs:now()+5000});
 const record={uploadId:id(850),requestId:id(851),objectId:id(852),owner:{tenantId:f.context.binding.tenantId,actorId:f.context.binding.actorId,conversationId:f.context.binding.conversationId,clientId:f.claims.selectedClientId},
  declaration,scopes:f.context.scopes,object:{objectId:id(852),versionId:'retained-original-version',sha256:declaration.sha256,bytes:bytes.length,scopes:f.context.scopes},
  state:'stored',inspection,createdAtMs:now(),updatedAtMs:now(),revision:2};
 const unused=()=>assert.fail('Original import never writes upload custody');
 const retention=createRetentionReadGate({journal:createMemoryRetentionJournal(),serving:{isEnabled:()=>true}});
 const source=createOfficeOriginalReader({sessions:f.sessions,store:{read:async()=>structuredClone(record),prepare:unused,transition:unused},
  objects:{get:async()=>Buffer.from(bytes),put:unused,observePut:unused},inspection:{inspect:unused},removeOriginal:unused,retention,now});
 const limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216},observations=[];
 const optionsOwner={async resolve(call){
  observations.push(call.intent);const required={'office-import':'artifact.generate','office-edit':'artifact.revise',inspect:'artifact.inspect',download:'artifact.download'}[call.intent];
  return {documentOptions:{sessions:f.sessions,selectedClientId:f.claims.selectedClientId,now,limits,enabled:true,
   artifactOptions:{...f.artifactOptions,now,ids:()=>({artifactId:id(960),versionId:id(961),objectId:id(962)}),authorize:async c=>{assert.equal(c.action,required);return f.artifactOptions.authorize(c);}}},recheck:async()=>{}};
 }};
 const discoveryBytes=Buffer.from(`<wopi-discovery><net-zone name="external-https"><app><action ext="${format}" name="edit" urlsrc="https://office.example.test/browser/test/cool.html?"/></app></net-zone></wopi-discovery>`);
 const launch=createCollaboraCodeLaunch({editorOrigin:'https://office.example.test',wopiOrigin:'https://wopi.example.test',discoveryBytes,codec:f.codec,now});
 const app=createRuntimeOfficeApplication({optionsOwner,sessions:f.sessions,now,limits,drafts:f.options.drafts,codec:f.codec,launch,generation:f.options.generation,browserOrigin:'https://app.example.test',originalSource:source});
 const selection={uploadId:record.uploadId,sha256:record.declaration.sha256};
 async function call(route,input){const body={schema:OFFICE_SCHEMA,...input},q=receiveOfficeRequest(route,encode(body));
  const response=await app.handleControl(new Request('https://control.example.test/api/meri/office/'+route,{method:'POST',headers:{authorization:'Bearer '+f.session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
  const data=new Uint8Array(await response.arrayBuffer()),value=await receiveOfficeResponse(route,response.status,data,q);return {response,value,data,q};}
 const wopi=(form,operation,extra={})=>{const request=f.request(operation,{...extra,token:form.fields.access_token}),url=new URL(request.url);url.pathname=url.pathname.replace('synthetic-file',f.draft.draftId);return app.handleWopi(new Request(url,request));};
 return {...f,bytes,record,observations,call,wopi,selection,import:operation=>call('import',{...selection,operation:operation??'import'})};
}
for(const format of ['docx','xlsx','pptx'])test(format+': clean retained upload -> immutable original -> open/Save/Release/Publish preserves exact bytes and lineage',async t=>{
 const f=await fixture(t,format),basePuts=f.state.puts,baseExecutions=f.state.executions.length;
 const imported=await f.import();assert.equal(imported.response.status,200);assert.ok(!('error' in imported.value));
 const version=imported.value.document.version;assert.equal(version.object.sha256,uploadHash(f.bytes));assert.notEqual(version.versionId,f.record.object.versionId);
 assert.equal(f.state.puts,basePuts+1);assert.equal(f.state.executions.length,baseExecutions);assert.equal(f.record.inspection.extraction.status,'unavailable');
 assert.ok(!Buffer.from(imported.data).toString().includes('bytesBase64'));assert.ok(!Buffer.from(imported.data).toString().includes('access_token'));
 Object.assign(f.draft,{artifactId:version.artifactId,baseVersionId:version.versionId,baseSha256:version.object.sha256,filename:version.filename});f.state.editorId=null;f.state.epoch=0;
 const key={versionId:version.versionId,draftId:f.draft.draftId};
 assert.equal((await f.call('open',key)).response.status,200);
 const launched=await f.call('launch',{...key,mode:'edit',operation:'acquire',editorId:f.claims.editorId,expectedEpoch:0});assert.equal(launched.response.status,200);
 assert.equal((await f.wopi(launched.value.launch,'lock',{lock:'imported'})).status,200);
 const edited=preservationBytes(format,'after');assert.equal((await f.wopi(launched.value.launch,'save',{lock:'imported',body:edited})).status,200);
 const saved=(await f.call('read',key)).value;assert.equal(saved.draft.sha256,uploadHash(edited));
 assert.equal((await f.call('release',{...key,editorId:f.claims.editorId,expectedEpoch:1})).response.status,200);
 const published=await f.call('publish',{...key,sequence:saved.draft.sequence,sha256:saved.draft.sha256});assert.equal(published.response.status,200);
 assert.equal(published.value.publication.version.parentVersionId,version.versionId);assert.equal(published.value.publication.version.object.sha256,uploadHash(edited));
 const recovered=await f.import('recover');assert.equal(recovered.response.status,200);assert.equal(recovered.value.document.version.versionId,version.versionId);
 assert.equal(f.state.puts,basePuts+2);assert.equal(f.state.executions.length,baseExecutions);assert.ok(f.observations.includes('office-import'));assert.ok(f.observations.includes('office-edit'));
});
test('HTTP import recovery before a claim is explicitly unresolved and never creates a version',async t=>{
 const f=await fixture(t),puts=f.state.puts,out=await f.import('recover');assert.equal(out.response.status,409);assert.equal(out.value.error.code,'IMPORT_UNRESOLVED');assert.equal(f.state.puts,puts);
});
test('lost import settlement acknowledgement resolves through the same readonly identity',async t=>{
 const f=await fixture(t),puts=f.state.puts;f.state.loseCommit='settle';assert.notEqual((await f.import()).response.status,200);
 const recovered=await f.import('recover');assert.equal(recovered.response.status,200);assert.equal(f.state.puts,puts+1);
});
test('removal after the artifact object write blocks immutable publication and recovery never retries it',async t=>{
 const f=await fixture(t),writes=f.sql.durable.state.writes,puts=f.state.puts;f.state.putHook=()=>{f.record.state='removing';};
 assert.notEqual((await f.import()).response.status,200);assert.equal(f.sql.durable.state.writes,writes);
 f.record.state='stored';f.state.putHook=null;assert.equal((await f.import('recover')).response.status,409);assert.equal(f.state.puts,puts+1);
});
test('public import receiver refuses wrong upload, digest, version parent or extra private fields',async t=>{
 const f=await fixture(t),out=await f.import();
 for(const change of ['upload','digest','parent','private']){const reply=structuredClone(out.value);
  if(change==='upload')reply.uploadId=id(899);if(change==='digest')reply.sha256='a'.repeat(64);if(change==='parent')reply.document.version.parentVersionId=id(899);if(change==='private')reply.bytesBase64='forbidden';
  await assert.rejects(receiveOfficeResponse('import',200,encode(reply),out.q));
 }
 for(const change of [{operation:'retry'}, {versionId:id(898)}, {objectVersionId:'store-version'}])assert.throws(()=>receiveOfficeRequest('import',encode({schema:OFFICE_SCHEMA,...f.selection,operation:'import',...change})));
});
