/** Real draft preparer/journal and canonical artifact owner, synthetic publication/SQL/executor. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertDocumentRevisionSelection} from '../../../../packages/contracts/document-revision.mjs';
import {createArtifactService} from '../../../artifacts/service.mjs';
import {nativeDocumentFixture} from '../../../artifacts/test/native-document-fixture.mjs';
import {createDocumentIntentPreparer} from '../document-preparer.mjs';import {mount,delivery} from './fixture.mjs';
import {admitDocumentRevisionSource} from '../document-revision.mjs';
async function fixture(){
 const f=nativeDocumentFixture(),first=await f.run(),b=f.context.binding,entry=catalog.operations.find(x=>x.operation.id==='create_word');
 const descriptor={operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements};
 const selection={artifactId:first.version.artifactId,versionId:first.version.versionId,objectSha256:first.version.object.sha256};
 const reads=createArtifactService({...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})}),writes=[];
 const source=async()=>({...await reads.revisionSource(selection.versionId,f.context),headVersionId:(await reads.history({versionId:selection.versionId,limit:1,cursor:null},f.context)).headVersionId});
 const make=({read=source,write=call=>f.run(call),selected=selection}={})=>createDocumentIntentPreparer({descriptor,binding:b,revision:{selection:selected,read},writes:{async execute(call){writes.push(call);return write(call);}}});
 const request={...f.call.request,content:{text:'Changed by the same SDK query\n'}},call={arguments:request,deliveryId:delivery(70)};
 return {f,first,selection,source,make,writes,request,call};
}
test('trusted immutable selection revises through the existing owner and preserves original bytes/spec',async()=>{
 const h=await fixture(),before=await h.source(),result=await h.make().prepare(h.call);
 assert.equal(result.version.parentVersionId,h.selection.versionId);assert.equal(result.version.artifactId,h.selection.artifactId);assert.equal(h.writes[0].baseVersionId,h.selection.versionId);
 const after=await h.source();assert.deepEqual(after.request,before.request);assert.deepEqual(after.version,before.version);assert.equal(h.f.state.executions.length,2);
 assert.deepEqual(h.f.state.executions[1].base.request,before.request);assert.equal(h.f.state.executions[1].base.bytes.toString(),before.request.content.text);
});
test('older selected head refuses with no replacement execution and never silently rebases',async()=>{
 const h=await fixture();await h.f.run({...h.f.call,deliveryId:'concurrent',baseVersionId:h.selection.versionId});const count=h.f.state.executions.length;
 await assert.rejects(h.make().prepare(h.call),{code:'CONFLICT',effect:'none'});assert.equal(h.writes.length,0);assert.equal(h.f.state.executions.length,count);
});
test('foreign object/spec/context/format cannot enter the revision writer',async()=>{
 for(const change of [s=>{s.version.object.sha256='f'.repeat(64);},s=>{s.specSha256='f'.repeat(64);},s=>{s.version.binding.actorId='foreign';},s=>{s.inspection.currentBytesVerified=false;}]){
  const h=await fixture(),source=await h.source();change(source);await assert.rejects(h.make({read:async()=>source}).prepare(h.call),{code:'ACCESS_DENIED',effect:'none'});assert.equal(h.writes.length,0);
 }
 const h=await fixture();await assert.rejects(h.make().prepare({...h.call,arguments:{operation:'create_word',format:'docx',title:'Other',content:{blocks:[{kind:'paragraph',runs:[{text:'Change'}]}]}}}),{code:'ACCESS_DENIED',effect:'none'});assert.equal(h.writes.length,0);
});
test('the model cannot choose a different revision base or insert authority into canonical replacement arguments',async()=>{
 const h=await fixture();for(const extra of [{baseVersionId:randomUUID()},{revision:h.selection},{context:h.f.context}])await assert.rejects(h.make().prepare({...h.call,arguments:{...h.request,...extra}}),{code:'INVALID_ARGUMENTS',effect:'none'});assert.equal(h.writes.length,0);
});
test('a stable intent delivery replays once; lost write acknowledgement stays UNKNOWN without regeneration',async()=>{
 const h=await fixture(),port=h.make(),journal=mount({binding:h.f.context.binding,scopes:h.f.context.scopes,preparers:[port],now:h.f.options.now});
 const input={operation:port.operation,...h.call};const out=await journal.mount.prepare(input);assert.deepEqual(await journal.mount.prepare(input),out);assert.equal(h.writes.length,1);
 const other=await fixture(),lost=other.make({write:async call=>{await other.f.run(call);throw Error('LOST_ACK');}}),unknown=mount({binding:other.f.context.binding,scopes:other.f.context.scopes,preparers:[lost],now:other.f.options.now});
 for(let i=0;i<2;i++)await assert.rejects(unknown.mount.prepare({operation:lost.operation,...other.call}),{code:'UNKNOWN'});assert.equal(other.writes.length,1);assert.equal(other.f.state.executions.length,2);
});
test('current source refusal and cancellation have no write effect; foreign returned parent is withheld after write',async()=>{
 const h=await fixture();await assert.rejects(h.make({read:async()=>{throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}}).prepare(h.call),{code:'ACCESS_DENIED',effect:'none'});
 const abort=new AbortController();abort.abort();await assert.rejects(h.make().prepare({...h.call,signal:abort.signal}),{code:'CANCELLED',effect:'none'});assert.equal(h.writes.length,0);
 const bad=h.make({write:async call=>{const result=await h.f.run(call);result.version.parentVersionId=null;return result;}});await assert.rejects(bad.prepare(h.call),{code:'INVALID_RESULT',effect:'unknown'});
});
test('selection is closed data and hashes are not accepted as an authority token',()=>{
 const selection={artifactId:randomUUID(),versionId:randomUUID(),objectSha256:'a'.repeat(64)};assert.deepEqual(assertDocumentRevisionSelection(selection),selection);
 for(const value of [{...selection,credential:'hidden'},{...selection,objectSha256:'A'.repeat(64)},{...selection,versionId:'filename.docx'}])assert.throws(()=>assertDocumentRevisionSelection(value),{code:'DOCUMENT_REVISION_SELECTION'});
 let touched=0;const raw={...selection};Object.defineProperty(raw,'versionId',{get(){touched++;return selection.versionId;},enumerable:true});assert.throws(()=>assertDocumentRevisionSelection(raw));assert.equal(touched,0);
});
test('source-backed and asset-bearing replacements cannot silently lose retained provenance',async()=>{
 const h=await fixture(),source=await h.source();source.version.evidence=[{sourceId:'synthetic',recordId:'record',sourceVersionId:'version',observedAt:source.version.createdAt,sourceUpdatedAt:null,citationId:randomUUID(),scopes:source.version.scopes,contentSha256:'a'.repeat(64),binding:source.version.binding}];
 v.version(source.version);
 await assert.rejects(h.make({read:async()=>source}).prepare(h.call),{code:'UNAVAILABLE',effect:'none'});assert.equal(h.writes.length,0);
 const asset={kind:'image',assetId:'retained-image',widthInches:1,heightInches:1};
 const plain={operation:'create_word',format:'docx',title:'Synthetic',content:{blocks:[{kind:'paragraph',runs:[{text:'Retained text'}]}]}};
 const withAsset={...plain,content:{blocks:[asset]}};
 for(const [original,replacement] of [[withAsset,plain],[plain,withAsset]]){
  const raw=await h.source();raw.request=v.request(original);raw.specSha256=v.hash(raw.request);raw.inspection.format='docx';raw.inspection.details={paragraphs:1,tables:0,pictures:0};
  assert.throws(()=>admitDocumentRevisionSource(raw,{selection:h.selection,binding:h.f.context.binding,request:v.request(replacement)}),{code:'UNAVAILABLE',effect:'none'});
 }
});
