/** F4 focused qualification: the retained asset map crosses the ACTUAL paged publication owner.
 * The real canonical artifact owner writes through the real paged journal/SQL projection owners and their
 * scripted SQL/CAS fixtures (actual page hashes and root CAS), so this is the executed v2 (paged) proof the
 * independent review found missing — not shared-validator similarity. No database, renderer or native
 * toolchain is involved and no live resource is touched. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createArtifactService} from '../service.mjs';
import {nativeDocumentFixture,sha} from './native-document-fixture.mjs';
import {record,commit,id,NOW} from '../storage/test/sql-fixture.mjs';
import {pagedPublicationFixture} from '../storage/test/paged-publication-fixture.mjs';

const ASSET=Buffer.from('synthetic paged retained image bytes\n');
const LEGACY_KEYS=['inspection','requestSha256','spec','specSha256','version'];
const PRIVATE_KEYS=['inspection','request','specSha256','version'];
const ids=()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()});
const docxExecutor={async execute({request,assets}){const bytes=Buffer.from(JSON.stringify(request.content.blocks).slice(0,64));
 return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:1,tables:0,pictures:assets.length}}};}};

/** The same real canonical owner and scripted SQL/CAS seams as the legacy retention proof, but the
 * version store is constructed over the real paged publication owner AFTER its explicit paged-root
 * upgrade, so every commit/read goes through the actual page tree and root CAS. */
async function pagedFixture(){
 const f=nativeDocumentFixture(),
  p=pagedPublicationFixture(f.context.binding.tenantId,()=>NOW);
 await p.owner.upgrade((await p.owner.snapshot()).positionSha256);
 // The explicit upgrade is itself one committed paged root (the journal's write() pushes a root and
 // advances the revision), so capture it: every later assertion is relative to this real base.
 const base={revision:p.state.revision,roots:p.state.roots.length};
 const object={objectId:randomUUID(),versionId:`SYNTHETIC_PAGED_${id(600)}`,sha256:sha(ASSET),bytes:ASSET.length,scopes:structuredClone(f.context.scopes)},
  context={...f.context,assets:[{id:'paged-image',object}]},
  request=v.request({operation:'create_word',format:'docx',title:'Paged retained',content:{blocks:[{kind:'paragraph',runs:[{text:'With an image'}]},{kind:'image',assetId:'paged-image',widthInches:1,heightInches:1}]}});
 f.state.objects.set(v.hash(object),Buffer.from(ASSET));
 const store=()=>f.sql.create({publication:p.create(),tenantId:f.context.binding.tenantId}),
  executor={async execute(input){f.state.executions.push(input);return docxExecutor.execute(input);}},
  service=(changes={})=>createArtifactService({...f.options,ids,executor,context,versions:store(),...changes}),
  call={deliveryId:'paged-retained',baseVersionId:null,request};
 return {f,p,object,context,request,call,base,store,service,deliver:(changes={})=>f.owner({executor,context,versions:store(),...changes})};
}
const row=(f,versionId)=>f.sql.state.versions.get(versionId);

test('an activated asset-bearing decision crosses the real paged publication owner, reads after restart and keeps its original scope',async()=>{
 const h=await pagedFixture(),first=await h.deliver({retainedAssetMapWrites:true}).execute(h.call),stored=row(h.f,first.version.versionId);
 // The publication is genuinely paged: an upgraded v2 root with page-written decisions, not a legacy envelope.
 const index=structuredClone(h.p.state.index);assert.equal(index.publicationVersion,'meri.artifact-publication-index.2');assert.ok(h.p.state.pages.size>0);assert.equal(h.p.state.revision,h.base.revision+1);assert.equal(h.p.state.roots.length,h.base.roots+1);
 assert.deepEqual(stored.record.assets,[{id:'paged-image',object:h.object}]);
 assert.equal(stored.record_sha256,v.hash(stored.record));assert.equal(h.p.state.roots.length,h.base.roots+1);
 // The durable projection row and the canonical publication decision carry the identical record.
 assert.equal(Object.hasOwn(stored.record,'assets'),true);
 // A freshly constructed paged owner over the same rows/pages and root: nothing carried in memory.
 const reopened=h.service({versions:h.store()}),source=await reopened.revisionSource(first.version.versionId,h.context);
 assert.deepEqual(source.assets,[{id:'paged-image',object:h.object}]);
 assert.deepEqual(source.assets[0].object.scopes,h.context.scopes);
 assert.deepEqual(Object.keys(source).sort(),['assets',...PRIVATE_KEYS].sort());
 assert.equal(source.version.object.sha256,first.version.object.sha256);
 assert.equal(h.f.state.objects.get(v.hash(h.object)).toString(),ASSET.toString());
 // Ordinary public DTOs are unchanged by activation and the paged write.
 assert.equal(Object.hasOwn(first.version,'assets'),false);
 assert.deepEqual(Object.keys(await reopened.inspect(first.version.versionId,h.context)).sort(),['inspection','version']);
});

test('a paged map-free record still reads in the dual format and a map-free write keeps the exact legacy envelope',async()=>{
 const h=await pagedFixture(),out=await h.deliver().execute(h.call),stored=row(h.f,out.version.versionId);
 // Default activation is OFF: the same declared asset still reached the executor and rendered, but the
 // paged decision/root carries no new map-bearing field, so an older binary reads exactly the legacy record.
 assert.equal(Object.hasOwn(stored.record,'assets'),false);assert.deepEqual(Object.keys(stored.record).sort(),LEGACY_KEYS);
 assert.equal(stored.record_sha256,v.hash(stored.record));assert.ok(h.p.state.pages.size>0);
 assert.equal(h.f.state.executions.length,1);assert.equal(h.f.state.executions[0].assets.length,1);
 const source=await h.service().revisionSource(out.version.versionId,h.context);
 assert.deepEqual(Object.keys(source).sort(),PRIVATE_KEYS);
});

test('paged lost-ACK leaves the root unchanged, requires targeted recovery and refuses a changed retained map',async()=>{
 const h=await pagedFixture(),before=h.p.state.revision;
 h.p.state.lostRootAck=true;
 let lost;try{await h.deliver({retainedAssetMapWrites:true}).execute(h.call);assert.fail('lost-ACK published');}catch(error){lost=error;}
 assert.equal(lost.code,'ARTIFACT_EFFECT_UNKNOWN');assert.equal(lost.cause?.code,'ARTIFACT_PUBLICATION_ACK_UNKNOWN');
 const versionId=lost.versionId;assert.match(versionId,/^[a-f0-9-]{36}$/u);
 // The decision reached the page tree once and the root advanced exactly once: no duplicate page/root write.
 assert.equal(h.p.state.revision,before+1);assert.equal(h.p.state.roots.length,h.base.roots+1);assert.equal(h.f.sql.state.versions.size,0);
 // Targeted recovery restores only the nominated version/head, then the asset map reads intact.
 await h.store().recoverVersion(h.f.context.binding.tenantId,versionId);
 const recovered=await h.service().revisionSource(versionId,h.context);
 assert.deepEqual(recovered.assets,[{id:'paged-image',object:h.object}]);
 const revision=h.p.state.revision,roots=h.p.state.roots.length,stored=row(h.f,versionId);
 // Replaying the identical decision means presenting the SAME authority the original decision carried.
 // A freshly synthesized invocation derives a different invocationId and is a different decision, so
 // the canonical owner would (correctly) refuse it as an immutable conflict rather than a duplicate.
 const decision=(await h.p.owner.readVersion(versionId)).result.decision;
 const replay=await h.store().commit(commit(stored.record),undefined,{authorization:decision.authorization,invocation:decision.invocation});
 assert.equal(replay.status,'duplicate');assert.equal(h.p.state.revision,revision);assert.equal(h.p.state.roots.length,roots);
 // A retained map changed in the durable projection row is refused, never re-read as a new mapping.
 stored.record.assets=[{id:'paged-image',object:{...h.object,sha256:'b'.repeat(64)}}];stored.record_sha256=v.hash(stored.record);
 const immutable=e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&e.cause?.code==='ARTIFACT_IMMUTABLE_CONFLICT';
 await assert.rejects(h.service().revisionSource(versionId,h.context),immutable);
 assert.equal(h.p.state.revision,revision);
});

test('paged retention suppression withholds the retained map before and after targeted recovery',async()=>{
 const h=await pagedFixture(),first=await h.deliver({retainedAssetMapWrites:true}).execute(h.call);
 h.f.sql.suppressed.add(`${h.f.context.binding.tenantId}:artifact:${first.version.artifactId}`);
 await assert.rejects(h.service().revisionSource(first.version.versionId,h.context),{code:'RETENTION_SUPPRESSED'});
 await assert.rejects(h.store().recoverVersion(h.f.context.binding.tenantId,first.version.versionId),{code:'RETENTION_SUPPRESSED'});
 h.f.sql.suppressed.clear();
 const source=await h.service().revisionSource(first.version.versionId,h.context);
 assert.deepEqual(source.assets,[{id:'paged-image',object:h.object}]);
});
