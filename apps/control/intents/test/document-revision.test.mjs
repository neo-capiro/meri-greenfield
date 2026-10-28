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
/** Retained native source evidence bound exactly like the canonical version validator binds it. */
const retainedEvidence=source=>({sourceId:'program_elements',recordId:'record-synthetic',sourceVersionId:'version-synthetic',
 observedAt:source.version.createdAt,sourceUpdatedAt:null,citationId:randomUUID(),scopes:structuredClone(source.version.scopes),
 contentSha256:'a'.repeat(64),binding:structuredClone(source.version.binding)});
/** The exact catalog projection the document application admits, plus a custom trusted write/revision port. */
const documentDescriptor=()=>{const entry=catalog.operations.find(x=>x.operation.id==='create_word');return {operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements};};
const configure=(h,{read,execute,preservation})=>createDocumentIntentPreparer({descriptor:documentDescriptor(),binding:h.f.context.binding,
 revision:{selection:h.selection,read},writes:{execute,preservation}});
test('a trusted owner keeps the retained evidence across a full replacement through the existing artifact owner',async()=>{
 const h=await fixture(),base=await h.source();
 const parent={...base,version:{...base.version,evidence:[retainedEvidence(base)]}};v.version(parent.version);
 let executions=0;const calls=[];
 // The trusted owner re-presents the retained evidence; the canonical artifact owner, with the
 // retained-evidence admission hook, writes the revision and keeps the evidence on the new version.
 const preservedOwner=call=>h.f.owner({context:{...h.f.context,evidence:call.evidence},admitRetainedEvidence:context=>v.hash(context.evidence)===v.hash(call.evidence)?undefined:1});
 const writes={preservation:({retained})=>({evidence:retained.evidence,assets:[]}),
  async execute(call,signal){executions++;calls.push(call);const {preserve,...write}=call;return preservedOwner(preserve).execute(write,signal);}};
 const preparer=configure(h,{read:async()=>parent,...writes});
 const result=await preparer.prepare(h.call);
 assert.equal(executions,1);assert.equal(calls[0].preserve.evidenceSha256,v.hash(parent.version.evidence.map(v.nativeSourceEvidence)));
 assert.deepEqual(calls[0].preserve.parent,{versionId:h.selection.versionId,objectSha256:base.version.object.sha256,specSha256:base.specSha256});
 assert.equal(result.version.parentVersionId,h.selection.versionId);assert.equal(result.version.artifactId,h.selection.artifactId);
 assert.deepEqual(result.version.evidence,parent.version.evidence);
 const after=await h.source();assert.deepEqual(after.version,base.version);assert.deepEqual(after.request,base.request);
});
test('a replacement that drops, invents or re-binds retained provenance is refused with no draft',async()=>{
 const h=await fixture(),base=await h.source();
 const evidence=[retainedEvidence(base)];
 const parent={...base,version:{...base.version,evidence}};v.version(parent.version);
 const preparation=({retained})=>({evidence:retained.evidence,assets:[]});
 for(const value of [{evidence:[{...evidence[0],contentSha256:'f'.repeat(64)}]},{evidence:[]},{evidence,assets:[{id:'x',object:{}}]}]){
  let executions=0;
  const preparer=configure(h,{read:async()=>parent,execute:async(call,signal)=>{executions++;return h.f.run(call);},preservation:()=>value});
  await assert.rejects(preparer.prepare(h.call),{code:'ACCESS_DENIED',effect:'none'});assert.equal(executions,0);
 }
 // A port that reports preservation but re-presents nothing leaves a draft: the effect is unknown.
 let executed=0;
 const lying={preservation:preparation,async execute(call,signal){executed++;const {preserve,...write}=call;return h.f.run(write,signal);}};
 await assert.rejects(configure(h,{read:async()=>parent,...lying}).prepare(h.call),{code:'INVALID_RESULT',effect:'unknown'});assert.equal(executed,1);
});
test('preserved asset objects are the parent objects; foreign, missing or invented assets are refused',async()=>{
 const h=await fixture(),plain={operation:'create_word',format:'docx',title:'Synthetic',content:{blocks:[{kind:'paragraph',runs:[{text:'Retained text'}]}]}};
 const withAsset={...plain,content:{blocks:[{kind:'image',assetId:'retained-image',widthInches:1,heightInches:1}]}};
 const raw=await h.source();raw.request=v.request(withAsset);raw.specSha256=v.hash(raw.request);raw.inspection.format='docx';raw.inspection.details={paragraphs:1,tables:0,pictures:0};
 const object={objectId:randomUUID(),versionId:'immutable-asset',sha256:'c'.repeat(64),bytes:7,scopes:structuredClone(raw.version.scopes)};
 const admit=preservation=>admitDocumentRevisionSource(raw,{selection:h.selection,binding:h.f.context.binding,request:v.request(plain),preservation});
 const pin=admit(()=>({evidence:[],assets:[{id:'retained-image',object}]}));
 assert.deepEqual(pin.preserved.assetIds,['retained-image']);assert.equal(pin.preserved.assets[0].object.objectId,object.objectId);
 assert.equal(pin.preserved.parent.objectSha256,raw.version.object.sha256);assert.equal(pin.preserved.parent.specSha256,raw.specSha256);
 const foreign={...object,scopes:[{...raw.version.scopes[0],resourceId:'other'}]};
 for(const value of [()=>({evidence:[],assets:[]}),()=>({evidence:[],assets:[{id:'other',object}]}),()=>({evidence:[],assets:[{id:'retained-image',object:foreign}]})])
  assert.throws(()=>admit(value),{code:'ACCESS_DENIED',effect:'none'});
 const invented={...plain,content:{blocks:[{kind:'image',assetId:'invented-image',widthInches:1,heightInches:1}]}};
 assert.throws(()=>admitDocumentRevisionSource(raw,{selection:h.selection,binding:h.f.context.binding,request:v.request(invented)}),{code:'UNAVAILABLE',effect:'none'});
});
