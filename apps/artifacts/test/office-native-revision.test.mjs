/** Actual intent/publication owners over their existing scripted SQL/object ports.
 * No Office process, network, renderer or database qualification is claimed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeDocumentFixture,sha} from './native-document-fixture.mjs';
import {id} from '../storage/test/sql-fixture.mjs';
import {ooxml,ooxmlEntries,zip,relationshipsXml} from '../structure/test/fixtures.mjs';
import {inspectOfficeEdit} from '../edit-sessions/inspect-office.mjs';
import {createArtifactService} from '../service.mjs';
import {OFFICE_EDIT_KIND,OFFICE_OPERATIONS} from '../../../packages/contracts/office-edit.mjs';
import {verifyArtifactVersionStorageRecord} from '../storage/version-record.mjs';

const requests={docx:{blocks:[{kind:'paragraph',runs:[{text:'Original'}]}]},xlsx:{sheets:[{name:'Data',rows:[[{value:2}]]}]},pptx:{slides:[{title:'Original',bullets:['Fixture']} ]}};
async function fixture(format='docx'){
 const f=nativeDocumentFixture(),baseBytes=ooxml(format);
 f.options.executor={async execute(){f.state.executions.push('base');const inspection=inspectOfficeEdit(baseBytes,format);if(format==='xlsx')inspection.details.formulaCache='removed/unverified; recalculation required';return {bytes:baseBytes,inspection};}};
 const first=await f.run({...f.call,request:{operation:OFFICE_OPERATIONS[format],format,title:'Synthetic',content:requests[format]}});
 const bytes=ooxml(format,{mainXml:format==='docx'?'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Exact edited text</w:t></w:r></w:p></w:body></w:document>':undefined});
 const request={sourceKind:OFFICE_EDIT_KIND,operation:OFFICE_OPERATIONS[format],format,title:'Synthetic',edit:{sessionId:id(700),draftSequence:1,draftSha256:sha(bytes),baseVersionId:first.version.versionId,baseObjectSha256:first.version.object.sha256,editorActorId:f.context.binding.actorId}};
 const call={deliveryId:`office:${request.edit.sessionId}:1`,baseVersionId:request.edit.baseVersionId,request};
 const publish=(value=call,data=bytes,changes={})=>f.owner({officeEditWrites:true,...changes}).executeOfficeEdit(value,data);
 return {...f,first,baseBytes,bytes,call,publish};
}
for(const format of ['docx','xlsx','pptx'])test(`${format}: exact bytes, immutable source and original family; reconnect recovers once`,async()=>{
 const f=await fixture(format),before=Buffer.from(f.bytes),result=await f.publish();
 assert.equal(result.version.parentVersionId,f.first.version.versionId);assert.equal(result.version.artifactId,f.first.version.artifactId);
 assert.deepEqual(f.state.objects.get(v.hash(result.version.object)),before);assert.deepEqual(f.state.objects.get(v.hash(f.first.version.object)),f.baseBytes);
 assert.equal(result.inspection.nativeOpened,false);assert.equal(result.execution.nativeQualified,false);
 if(format==='xlsx')assert.equal(result.inspection.details.formulaCache,'editor-provided/unverified; recalculation required');
 const stored=f.sql.state.versions.get(result.version.versionId).record;verifyArtifactVersionStorageRecord(stored);assert.deepEqual(stored.spec,f.call.request);
 assert.equal(f.state.executions.length,1);assert.equal(f.state.puts,2);assert.equal(f.sql.durable.state.writes,2);
 const context={...f.context,binding:{...f.context.binding,runId:id(701)},deadlineMs:f.context.deadlineMs+5000};
 const replay=await f.publish(f.call,f.bytes,{context});assert.deepEqual(replay.version,result.version);assert.equal(replay.execution.requestSha256,result.execution.requestSha256);
 assert.equal(f.state.puts,2);assert.equal(f.sql.durable.state.writes,2);assert.equal(f.state.executions.length,1);
 const service=createArtifactService({...f.options,ids:()=>({artifactId:id(710),versionId:id(711),objectId:id(712)})});
 assert.deepEqual((await service.download(result.version.versionId,context)).bytes,before);
 const history=await service.history({versionId:result.version.versionId,limit:10,cursor:null},context);assert.equal(history.versions.length,2);
});

test('private source cannot enter public typed generation; writes are off unless composed explicitly',async()=>{
 const f=await fixture();assert.throws(()=>v.request(f.call.request));
 await assert.rejects(f.owner().executeOfficeEdit(f.call,f.bytes),/EDITOR_PUBLISH_UNAVAILABLE/);
 await assert.rejects(f.owner({officeEditWrites:true}).execute(f.call));
 assert.equal(f.state.rows.size,1);assert.equal(f.state.puts,1);assert.equal(f.state.executions.length,1);
});
for(const change of ['hash','actor','base','delivery','sequence','extra','bytes'])test(`private publish refuses changed ${change} before claim`,async()=>{
 const f=await fixture(),call=structuredClone(f.call);let bytes=f.bytes;
 if(change==='hash')call.request.edit.draftSha256='a'.repeat(64);
 if(change==='actor')call.request.edit.editorActorId='another-actor';
 if(change==='base')call.baseVersionId=id(760);
 if(change==='delivery')call.deliveryId='another-delivery';
 if(change==='sequence')call.request.edit.draftSequence=2;
 if(change==='extra')call.request.authority=true;
 if(change==='bytes')bytes=Buffer.from('invalid office file');
 await assert.rejects(f.publish(call,bytes));assert.equal(f.state.rows.size,1);assert.equal(f.state.puts,1);
});
for(const change of ['baseHash','title'])test(`exact parent ${change} mismatch cannot publish`,async()=>{
 const f=await fixture(),call=structuredClone(f.call);
 if(change==='baseHash')call.request.edit.baseObjectSha256='a'.repeat(64);else call.request.title='Other source';
 await assert.rejects(f.publish(call),/EDITOR_SOURCE_MISMATCH/);assert.equal(f.state.puts,1);assert.equal(f.sql.durable.state.writes,1);
});

test('lost publication acknowledgement reconstructs the original version, even in a new run',async()=>{
 const f=await fixture();f.sql.durable.state.lostAck=true;
 await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN');assert.equal(f.sql.state.versions.size,1);
 const context={...f.context,binding:{...f.context.binding,runId:id(702)}};
 const result=await f.publish(f.call,f.bytes,{context});assert.equal(f.sql.state.versions.size,2);
 assert.equal(result.version.object.sha256,sha(f.bytes));assert.equal(f.state.puts,2);assert.equal(f.sql.durable.state.writes,2);
});
test('lost settlement acknowledgement reads the existing result without another write or settlement',async()=>{
 const f=await fixture();f.state.loseCommit='settle';await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.versionCommitted);
 const updates=f.state.commands.filter(c=>c.sql.startsWith('UPDATE')).length;
 const result=await f.publish();assert.equal(result.version.object.sha256,sha(f.bytes));assert.equal(f.state.puts,2);
 assert.equal(f.state.commands.filter(c=>c.sql.startsWith('UPDATE')).length,updates);
});
test('lost claim acknowledgement stays pending; time and reconnect never start a publish',async()=>{
 const f=await fixture();f.state.loseCommit='claim';await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');
 f.state.clock+=100;await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');
 assert.equal(f.state.puts,1);assert.equal(f.sql.durable.state.writes,1);
});
test('unknown object write never republishes from object existence or elapsed time',async()=>{
 const f=await fixture();f.state.putHook=()=>{throw Error('LOST_OBJECT_ACK');};
 await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN');f.state.putHook=null;
 await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');assert.equal(f.state.puts,2);assert.equal(f.sql.durable.state.writes,1);
});
test('concurrent first attempts under different runs converge on one immutable publication',async()=>{
 const f=await fixture(),other={...f.context,binding:{...f.context.binding,runId:id(703)}};
 const outcomes=await Promise.allSettled([f.publish(),f.publish(f.call,f.bytes,{context:other})]);
 assert.ok(outcomes.some(o=>o.status==='fulfilled'));assert.equal(f.state.puts,2);assert.equal(f.sql.durable.state.writes,2);
 const replay=await f.publish(f.call,f.bytes,{context:other});assert.equal(replay.version.object.sha256,sha(f.bytes));assert.equal(f.state.puts,2);
});

for(const change of ['revoked','suppressed','bytes','source','context','result'])test(`recovery withholds output after ${change}`,async()=>{
 const f=await fixture(),result=await f.publish(),call=structuredClone(f.call);let context=f.context,bytes=f.bytes;
 if(change==='revoked')f.state.denied=true;
 if(change==='suppressed')f.sql.suppressed.add(`${f.context.binding.tenantId}:artifact:${result.version.artifactId}`);
 if(change==='bytes')f.state.objects.set(v.hash(result.version.object),Buffer.from('wrong bytes'));
 if(change==='source'){bytes=ooxml('docx');call.request.edit.draftSha256=sha(bytes);}
 if(change==='context')context={...context,maxBytes:context.maxBytes+1};
 if(change==='result'){const row=[...f.state.rows.values()].find(r=>r.outcome?.result?.version.versionId===result.version.versionId);row.outcome.result.inspection.bytes++;}
 await assert.rejects(f.publish(call,bytes,{context}));assert.equal(f.state.puts,2);assert.equal(f.sql.durable.state.writes,2);
});
test('stale base is a durable conflict; no subsequent attempt overwrites the current head',async()=>{
 const f=await fixture(),first=await f.publish(),next=structuredClone(f.call);
 next.request.edit.sessionId=id(704);next.deliveryId=`office:${id(704)}:1`;
 await assert.rejects(f.publish(next),e=>e.code==='ARTIFACT_STALE_PARENT');
 const puts=f.state.puts;await assert.rejects(f.publish(next),e=>e.code==='ARTIFACT_STALE_PARENT');assert.equal(f.state.puts,puts);
 assert.equal(f.sql.state.heads.get(first.version.artifactId).version_id,first.version.versionId);assert.equal(f.sql.durable.state.writes,2);
});
test('a later Office session may revise an edited parent; typed rendering cannot erase user edits',async()=>{
 const f=await fixture(),first=await f.publish(),request={operation:'create_word',format:'docx',title:'Synthetic',content:requests.docx};
 await assert.rejects(f.owner().execute({deliveryId:'typed-after-office',baseVersionId:first.version.versionId,request}),/EDITOR_TYPED_REVISION_UNAVAILABLE/);
 assert.equal(f.state.executions.length,1);
 const call=structuredClone(f.call);call.request.edit.sessionId=id(705);call.deliveryId=`office:${id(705)}:1`;
 call.baseVersionId=first.version.versionId;call.request.edit.baseVersionId=call.baseVersionId;call.request.edit.baseObjectSha256=first.version.object.sha256;
 const next=await f.publish(call);assert.equal(next.version.parentVersionId,first.version.versionId);assert.equal(f.state.executions.length,1);
});
for(const change of ['sourceActor','parent','draftHash','assets','cache'])test(`immutable private source refuses corrupt ${change}`,async()=>{
 const f=await fixture('xlsx'),published=await f.publish(),r=structuredClone(f.sql.state.versions.get(published.version.versionId).record);
 if(change==='sourceActor')r.spec.edit.editorActorId='another-actor';
 if(change==='parent')r.spec.edit.baseVersionId=id(706);
 if(change==='draftHash')r.spec.edit.draftSha256='a'.repeat(64);
 if(change==='assets')r.assets=[{id:'external',object:r.version.object}];
 if(change==='cache')r.inspection.details.formulaCache='removed/unverified; recalculation required';
 r.specSha256=v.hash(r.spec);assert.throws(()=>verifyArtifactVersionStorageRecord(r));
});

test('inspection preserves actual spreadsheet formulas and cached values without claiming recalculation',()=>{
 const entries=ooxmlEntries('xlsx',{mainXml:'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Data"/></sheets></workbook>'});
 entries['xl/worksheets/sheet1.xml']='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><f>2+2</f><v>4</v></c></row></sheetData></worksheet>';
 const bytes=zip(entries),before=Buffer.from(bytes),inspection=inspectOfficeEdit(bytes,'xlsx');
 assert.deepEqual(bytes,before);assert.equal(inspection.details.formulas,1);assert.deepEqual(inspection.details.sheets,['Data']);assert.equal(inspection.recalculated,false);
});
for(const change of ['macro','embedded','dtd','broken','external-data','orphan-rel'])test(`structural inspection refuses ${change}`,()=>{
 const entries=ooxmlEntries('docx');
 if(change==='macro')entries['word/vbaProject.bin']='macro';
 if(change==='embedded')entries['word/embeddings/object.xml']='<object/>';
 if(change==='dtd')entries['word/extra.xml']='<!DOCTYPE x><x/>';
 if(change==='broken')entries['word/extra.xml']='<broken>';
 if(change==='external-data')entries['word/_rels/document.xml.rels']=relationshipsXml('<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="https://example.test/template" TargetMode="External"/>');
 if(change==='orphan-rel')entries['word/_rels/absent.xml.rels']=relationshipsXml('');
 assert.throws(()=>inspectOfficeEdit(zip(entries),'docx'),/EDITOR_STRUCTURE_REFUSED/);
});
test('passive HTTPS hyperlink is retained exactly; credential-bearing links refuse',()=>{
 const entries=ooxmlEntries('docx'),rel=target=>relationshipsXml(`<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${target}" TargetMode="External"/>`);
 entries['word/_rels/document.xml.rels']=rel('https://example.test/page');const bytes=zip(entries);assert.equal(inspectOfficeEdit(bytes,'docx').sha256,sha(bytes));
 entries['word/_rels/document.xml.rels']=rel('https://user:password@example.test/page');assert.throws(()=>inspectOfficeEdit(zip(entries),'docx'));
});
