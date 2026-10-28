/** MB04 retained assets. The canonical artifact owner's own durable record carries the bounded immutable
 * `id -> ObjectReference` map its immutable spec declared, so a later private current-authorized revision
 * can re-present exactly the original objects instead of re-rendering without them. The real canonical
 * delivery owner, the canonical storage validator and scripted SQL/CAS publication only: no database,
 * renderer, provider or native toolchain is involved and no live resource is touched. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createArtifactService} from '../service.mjs';
import {nativeDocumentFixture,sha} from './native-document-fixture.mjs';
import {record,commit,id,NOW} from '../storage/test/sql-fixture.mjs';
import {publicationAuthority} from '../storage/test/publication-fixture.mjs';
import {verifyArtifactPublicationInput} from '../storage/artifact-publication.mjs';

const ASSET=Buffer.from('synthetic retained image bytes\n');
const LEGACY_KEYS=['inspection','requestSha256','spec','specSha256','version'];
const PRIVATE_KEYS=['inspection','request','specSha256','version'];
const ids=()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()});
const docxExecutor={async execute({request,assets}){const bytes=Buffer.from(JSON.stringify(request.content.blocks).slice(0,64));
 return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:1,tables:0,pictures:assets.length}}};}};

/** One declared asset reference, its exact bytes in CAS, the canonical delivery owner that writes and the
 * canonical artifact owner that reads, both over this fixture's real publication/SQL owners. */
function fixture(){
 const f=nativeDocumentFixture(),
  object={objectId:randomUUID(),versionId:`SYNTHETIC_RETAINED_${id(500)}`,sha256:sha(ASSET),bytes:ASSET.length,scopes:structuredClone(f.context.scopes)},
  context={...f.context,assets:[{id:'retained-image',object}]},
  request=v.request({operation:'create_word',format:'docx',title:'Retained',content:{blocks:[{kind:'paragraph',runs:[{text:'With an image'}]},{kind:'image',assetId:'retained-image',widthInches:1,heightInches:1}]}});
 f.state.objects.set(v.hash(object),Buffer.from(ASSET));
 // The canonical owner is always handed an executor that records what it was actually asked to render,
 // so no assertion here can pass without a real execution having happened.
 const executor={async execute(input){f.state.executions.push(input);return docxExecutor.execute(input);}};
 const store=()=>f.sql.create({publication:f.publication.publication,tenantId:f.context.binding.tenantId});
 const deliver=(changes={})=>f.owner({executor,context,...changes});
 const call={deliveryId:'retained-parent',baseVersionId:null,request};
 const revise=(baseVersionId,request,changes={})=>deliver(changes).execute({deliveryId:`retained-${randomUUID()}`,baseVersionId,request});
 return {f,object,context,request,store,call,deliver,revise,
  service:(changes={})=>createArtifactService({...f.options,ids,executor,...changes})};
}
const row=(f,versionId)=>f.sql.state.versions.get(versionId);

test('a generated asset-bearing version retains the exact original object map beside its immutable spec',async()=>{
 const h=fixture(),out=await h.deliver({retainedAssetMapWrites:true}).execute(h.call),stored=row(h.f,out.version.versionId);
 assert.deepEqual(stored.record.assets,[{id:'retained-image',object:h.object}]);
 assert.deepEqual(stored.record.spec,h.request);
 assert.equal(stored.record_sha256,v.hash(stored.record));
 // The retained pair is the original object the caller supplied, and its actual bytes were read and
 // verified against that reference rather than being re-derived from the replacement.
 assert.equal(h.f.state.objects.get(v.hash(h.object)).toString(),ASSET.toString());
 assert.ok(h.f.state.gets>=1);
 // The public version DTO keeps its exact shape.
 assert.equal(Object.hasOwn(out.version,'assets'),false);
});

test('a version with no declared asset reference keeps the exact legacy envelope, private DTO and hash',async()=>{
 const f=nativeDocumentFixture(),out=await f.run(),service=changes=>createArtifactService({...f.options,ids,...changes}),stored=[...f.sql.state.versions.values()][0];
 assert.equal(Object.hasOwn(stored.record,'assets'),false);
 assert.deepEqual(Object.keys(stored.record).sort(),LEGACY_KEYS);
 assert.equal(stored.record_sha256,v.hash(stored.record));
 // The private current-authorized source keeps its legacy key set too: no DTO gained a field.
 const source=await service().revisionSource(out.version.versionId,f.context);
 assert.deepEqual(Object.keys(source).sort(),PRIVATE_KEYS);
 assert.deepEqual(Object.keys(await service().inspect(out.version.versionId,f.context)).sort(),['inspection','version']);
 assert.deepEqual(Object.keys(await service().download(out.version.versionId,f.context)).sort(),['bytes','version']);
});

test('a closed and reopened durable store reads the retained map and a revision preserves it exactly',async()=>{
 const h=fixture(),first=await h.deliver({retainedAssetMapWrites:true}).execute(h.call);
 // A freshly constructed canonical storage owner over the same durable rows: nothing is carried in memory.
 const reopened=h.store(),parentBytes=h.f.state.objects.get(v.hash(first.version.object)).toString();
 const read=await h.service({versions:reopened}).revisionSource(first.version.versionId,h.context);
 assert.deepEqual(read.assets,[{id:'retained-image',object:h.object}]);
 assert.deepEqual(Object.keys(read).sort(),['assets',...PRIVATE_KEYS].sort());
 const revised=await h.revise(first.version.versionId,{...h.request,title:'Retained v2'},{retainedAssetMapWrites:true});
 const child=row(h.f,revised.version.versionId),parent=row(h.f,first.version.versionId);
 assert.deepEqual(child.record.assets,[{id:'retained-image',object:h.object}]);
 assert.equal(child.record.version.parentVersionId,first.version.versionId);
 assert.equal(child.record.version.artifactId,first.version.artifactId);
 assert.notEqual(child.record.version.versionId,parent.record.version.versionId);
 // The immutable parent record, spec and bytes are untouched by the child.
 assert.deepEqual(parent.record.version,first.version);assert.deepEqual(parent.record.spec,h.request);
 assert.equal(parent.record_sha256,v.hash(parent.record));
 assert.equal(h.f.state.objects.get(v.hash(first.version.object)).toString(),parentBytes);
 assert.equal(h.f.state.objects.get(v.hash(h.object)).toString(),ASSET.toString());
});

test('a revision delivered without the retained asset in its trusted context retains nothing and claims nothing',async()=>{
 const h=fixture(),first=await h.deliver().execute(h.call);
 const revised=await h.revise(first.version.versionId,{...h.request,title:'Dropped'},{context:{...h.f.context,assets:[]}});
 const child=row(h.f,revised.version.versionId);
 assert.equal(Object.hasOwn(child.record,'assets'),false);
 // So the private source of that child exposes no retained map: it stays explicitly unavailable for a
 // further revision instead of pretending the dropped object is still retained.
 const source=await h.service().revisionSource(revised.version.versionId,h.f.context);
 assert.deepEqual(Object.keys(source).sort(),PRIVATE_KEYS);
});

test('the one canonical record validator carries the map through both publication invocation formats',async()=>{
 const base=record(),object={objectId:id(530),versionId:id(530),sha256:'a'.repeat(64),bytes:1,scopes:structuredClone(base.version.scopes)},
  map=[{id:'retained-image',object}],withMap={...base,assets:map},native=publicationAuthority(withMap,NOW),
  legacy={authorization:native.authorization,invocation:{versionId:base.version.versionId,budgetTicketId:'synthetic-budget-ticket',ownedInvocationId:null,binding:structuredClone(base.version.binding),requestSha256:base.requestSha256}};
 // The native-document write path and the older retained-evidence read path run the SAME canonical record
 // validator (the one artifact-publication.mjs imports from version-record.mjs), so the map is carried,
 // hash-stable and idempotent in both, and a record without a map is returned byte-identically by both.
 for(const [name,authority,extra] of [['the native-document write path',native,{}],['the older retained-evidence read path',legacy,{historical:true}]]){
  const written=verifyArtifactPublicationInput({record:withMap,expectedParentVersionId:null,...authority},extra);
  assert.deepEqual(written.record.assets,map,name);
  assert.equal(v.hash(written.record),v.hash(withMap),name);
  const reread=verifyArtifactPublicationInput({record:written.record,expectedParentVersionId:null,...authority},extra);
  assert.deepEqual(reread.record,written.record,name);
  assert.equal(v.hash(reread.record),v.hash(written.record),name);
  const kept=verifyArtifactPublicationInput({record:base,expectedParentVersionId:null,...authority},extra);
  assert.equal(Object.hasOwn(kept.record,'assets'),false,name);
  assert.equal(v.hash(kept.record),v.hash(base),name);
 }
});

test('the canonical record validator bounds the map and refuses duplicate, oversized, foreign or malformed entries',async()=>{
 const h=fixture(),versions=h.store(),base=record(),inScope={objectId:id(520),versionId:id(520),sha256:'a'.repeat(64),bytes:1,scopes:structuredClone(base.version.scopes)},
  withMap=assets=>({...base,assets}),
  cases=[
   ['an empty map',[]],
   ['a duplicate identifier',[{id:'logo',object:inScope},{id:'logo',object:inScope}]],
   ['a foreign scope',[{id:'logo',object:{...inScope,scopes:[{tenantId:'other-tenant',kind:'client',resourceId:'other',policyRevision:'r1'}]}}]],
   ['a malformed identifier',[{id:'bad id!',object:inScope}]],
   ['more than 64 entries',Array.from({length:65},(_,n)=>({id:`logo-${n}`,object:inScope}))],
  ];
 for(const [name,assets] of cases)await assert.rejects(versions.commit(commit(withMap(assets))),{code:'ARTIFACT_VERSION_CORRUPT'},name);
 // A malformed object reference is refused by the canonical public ObjectReference shape rule.
 await assert.rejects(versions.commit(commit(withMap([{id:'logo',object:{...inScope,sha256:'not-a-hash'}}]))),/ObjectReference/);
 assert.equal(h.f.sql.state.versions.size,0);
 const accepted=await versions.commit(commit(withMap([{id:'logo',object:inScope}])));
 assert.equal(accepted.status,'committed');
 assert.deepEqual(row(h.f,base.version.versionId).record.assets,[{id:'logo',object:inScope}]);
});

test('tampered retained bytes are refused before any replacement write',async()=>{
 const h=fixture(),first=await h.deliver().execute(h.call);
 h.f.state.objects.set(v.hash(h.object),Buffer.from('tampered'));
 const before={executions:h.f.state.executions.length,versions:h.f.sql.state.versions.size};
 await assert.rejects(h.revise(first.version.versionId,{...h.request,title:'Tampered'}),{code:'ARTIFACT_OBJECT_MISMATCH'});
 assert.deepEqual({executions:h.f.state.executions.length,versions:h.f.sql.state.versions.size},before);
 assert.equal(h.f.state.objects.get(v.hash(h.object)).toString(),'tampered');
});

test('a retained id presented with a changed reference cannot inherit the original bytes',async()=>{
 const h=fixture(),first=await h.deliver({retainedAssetMapWrites:true}).execute(h.call),
  seen={executions:h.f.state.executions.length,gets:h.f.state.gets};
 // The same retained id presented with a changed ObjectReference: the pair is admitted only against the
 // object's actual bytes, which are absent for the changed reference, so the write is refused before the
 // executor runs and the durable parent keeps its original pair.
 await assert.rejects(h.revise(first.version.versionId,{...h.request,title:'Moved'},{context:{...h.f.context,assets:[{id:'retained-image',object:{...h.object,sha256:'b'.repeat(64)}}]}}));
 assert.equal(h.f.sql.state.versions.size,1);
 assert.equal(h.f.state.executions.length,seen.executions);
 assert.ok(h.f.state.gets>seen.gets);
 assert.deepEqual(row(h.f,first.version.versionId).record.assets,[{id:'retained-image',object:h.object}]);
});

test('a retained map mutated in the durable row is refused as an immutable projection conflict',async()=>{
 const h=fixture(),created=await h.deliver().execute(h.call),stored=row(h.f,created.version.versionId);
 stored.record.assets=[{id:'retained-image',object:{...h.object,sha256:'b'.repeat(64)}}];stored.record_sha256=v.hash(stored.record);
 const before={executions:h.f.state.executions.length,versions:h.f.sql.state.versions.size},
  immutable=e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&e.cause?.code==='ARTIFACT_IMMUTABLE_CONFLICT';
 await assert.rejects(h.service().revisionSource(created.version.versionId,h.context),immutable);
 await assert.rejects(h.revise(created.version.versionId,{...h.request,title:'Mutated'}),immutable);
 assert.deepEqual({executions:h.f.state.executions.length,versions:h.f.sql.state.versions.size},before);
});

test('an asset-bearing delivery claims once, replays exactly, and a cancelled or lost claim retains nothing',async()=>{
 const h=fixture(),first=await h.deliver({retainedAssetMapWrites:true}).execute(h.call);
 assert.deepEqual([...h.f.sql.state.versions.values()][0].record.assets,[{id:'retained-image',object:h.object}]);
 assert.deepEqual((await h.deliver({retainedAssetMapWrites:true}).execute(h.call)).version,first.version);
 assert.equal(h.f.state.executions.length,1);assert.equal(h.f.state.puts,1);assert.equal(h.f.sql.state.versions.size,1);

 const lost=fixture();lost.f.state.loseCommit='claim';
 await assert.rejects(lost.deliver().execute(lost.call),e=>e.code==='UNAVAILABLE');
 await assert.rejects(lost.deliver().execute(lost.call),e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');
 assert.equal(lost.f.state.executions.length,0);assert.equal(lost.f.sql.state.versions.size,0);

 const cancelled=fixture(),ac=new AbortController();ac.abort();
 await assert.rejects(cancelled.deliver().execute(cancelled.call,ac.signal));
 assert.equal(cancelled.f.state.executions.length,0);assert.equal(cancelled.f.sql.state.versions.size,0);
});

test('suppression and a late denial withhold the retained map exactly like ordinary inspect',async()=>{
 const suppressed=fixture(),created=await suppressed.deliver({retainedAssetMapWrites:true}).execute(suppressed.call);
 suppressed.f.sql.suppressed.add(`${suppressed.f.context.binding.tenantId}:artifact:${created.version.artifactId}`);
 await assert.rejects(suppressed.service().revisionSource(created.version.versionId,suppressed.context),{code:'RETENTION_SUPPRESSED'});
 assert.equal(Object.hasOwn(row(suppressed.f,created.version.versionId).record,'assets'),true);

 const denied=fixture(),made=await denied.deliver({retainedAssetMapWrites:true}).execute(denied.call);
 denied.f.state.denied=true;
 await assert.rejects(denied.service().revisionSource(made.version.versionId,denied.context),/CURRENT_ACCESS_DENIED/);
});

test('the retained map is an explicit deployment-activated write: off by default, exact when on, malformed refused',async()=>{
 // Default (absent/false): the same asset-bearing delivery still renders with the declared assets and their
 // actual verified bytes, but no new map-bearing record is emitted, so the durable bytes stay exactly the
 // legacy envelope an older binary reads. This is the dual-reader / old-write rollback floor.
 const off=fixture(),offOut=await off.deliver().execute(off.call),offStored=row(off.f,offOut.version.versionId);
 assert.equal(Object.hasOwn(offStored.record,'assets'),false);
 assert.deepEqual(Object.keys(offStored.record).sort(),LEGACY_KEYS);
 assert.equal(offStored.record_sha256,v.hash(offStored.record));
 assert.deepEqual(Object.keys(await off.service().revisionSource(offOut.version.versionId,off.context)).sort(),PRIVATE_KEYS);
 assert.equal(off.f.state.executions.length,1);
 assert.equal(off.f.state.executions[0].assets.length,1,'the declared asset still reached the executor');
 assert.equal(off.f.state.objects.get(v.hash(off.object)).toString(),ASSET.toString());

 // Explicitly activated: the identical write now retains the exact original id -> ObjectReference map.
 const on=fixture(),onOut=await on.deliver({retainedAssetMapWrites:true}).execute(on.call);
 assert.deepEqual(row(on.f,onOut.version.versionId).record.assets,[{id:'retained-image',object:on.object}]);
 assert.deepEqual(Object.keys(await on.service().revisionSource(onOut.version.versionId,on.context)).sort(),['assets',...PRIVATE_KEYS].sort());
 assert.equal(Object.hasOwn(onOut.version,'assets'),false,'the public DTO is unchanged by activation');

 // A malformed activation is refused by the canonical option owners rather than coerced to a default.
 for(const bad of ['yes',1,{}]){assert.throws(()=>on.service({retainedAssetMapWrites:bad}),{code:'ARTIFACT_CONFIGURATION'});}
 // The owner refuses a malformed activation synchronously at construction (postgres-service option
 // admission), so the refusal is a thrown configuration error before any delivery promise exists.
 assert.throws(()=>on.deliver({retainedAssetMapWrites:'yes'}),{code:'ARTIFACT_CONFIGURATION'});
 assert.equal(on.f.sql.state.versions.size,1);
});
