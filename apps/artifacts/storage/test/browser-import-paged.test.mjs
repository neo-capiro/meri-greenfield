/** Real paged publication owner (existing inert fixture) + real versions CAS: browser-import recovery read. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {sqlFixture,record,NOW} from './sql-fixture.mjs';
import {pagedPublicationFixture} from './paged-publication-fixture.mjs';
import {artifactHarness} from '../../test/artifact-harness.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=Buffer.from('paged recovery proof\n');
async function committedRecord(t,body=bytes){
 const h=await artifactHarness(t),tenant=record().version.binding.tenantId;
 const binding={tenantId:tenant,actorId:randomUUID(),conversationId:randomUUID(),runId:randomUUID(),
  attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const context={binding,scopes:[{tenantId:tenant,kind:'tenant',resourceId:tenant,policyRevision:'1'}],
  evidence:[],assets:[],deadlineMs:Date.now()+90000,maxBytes:8388608};
 const ack=await h.service.ingest({binding,scopes:context.scopes,filename:'recovery-proof.txt',format:'txt',
  mimeType:'text/plain; charset=utf-8',bytes:Buffer.from(body),sha256:sha(body),
  idempotencyKey:sha(Buffer.from(`${binding.runId}/recovery-proof.txt/${sha(body)}`)),
  source:{kind:'browser-download',origin:'https://app.capiro.example',urlHost:'app.capiro.example',
   acquiredAtMs:Date.now(),policySha256:'a'.repeat(64)}},context);
 return h.store.versions.read(ack.versionId);
}
async function fixture(t){
 const rec=await committedRecord(t),tenant=rec.version.binding.tenantId;
 const sql=sqlFixture(),publication=pagedPublicationFixture(tenant,()=>NOW);
 await publication.owner.upgrade((await publication.owner.snapshot()).positionSha256);
 let pageOverride;
 const versions=()=>sql.create({publication:pageOverride?{...publication.create(),page:pageOverride}:publication.create(),maxRequestMs:30000});
 const b=rec.version.binding;
 const find=()=>versions().findBrowserImport({tenantId:b.tenantId,conversationId:b.conversationId,
  actorId:b.actorId,runId:b.runId,filename:'recovery-proof.txt'});
 return {rec,sql,publication,versions,find,setPage:page=>{pageOverride=page;}};
}
test('paged browser-import recovery: empty lookup is ENOENT and writes nothing',async t=>{
 const f=await fixture(t);
 await assert.rejects(f.find(),e=>e.code==='ENOENT');
 assert.equal(f.sql.state.versions.size,0);
});
test('paged browser-import recovery: one committed version reads back by original identity without repair',async t=>{
 const f=await fixture(t);
 await f.versions().commit({...f.rec,expectedParentVersionId:null});
 const revision=f.publication.state.revision,rows=f.sql.state.versions.size;
 assert.equal(rows,1);
 const found=await f.find();
 assert.equal(found.versionId,f.rec.version.versionId);
 assert.equal(found.sha256,f.rec.version.object.sha256);
 const again=await f.find();
 assert.equal(again.versionId,found.versionId);
 assert.equal(f.publication.state.revision,revision,'no publication write');
 assert.equal(f.sql.state.versions.size,rows,'no projection repair');
});
test('paged browser-import recovery: two candidates are ambiguous; a missing projection refuses',async t=>{
 const f=await fixture(t);
 await f.versions().commit({...f.rec,expectedParentVersionId:null});
 const second=structuredClone(f.rec);
 second.version.versionId=randomUUID();second.version.artifactId=randomUUID();
 second.version.createdAt=new Date(NOW+1000).toISOString();
 second.version.object={...second.version.object,objectId:randomUUID()};
 await f.versions().commit({...second,expectedParentVersionId:null});
 await assert.rejects(f.find(),e=>e.code==='ARTIFACT_VERSION_AMBIGUOUS');
 const g=await fixture(t);await g.versions().commit({...g.rec,expectedParentVersionId:null});
 g.sql.state.versions.clear();g.sql.state.heads.clear();
 await assert.rejects(g.find(),e=>/ENOENT|PROJECTION_STALE|UNAVAILABLE|CORRUPT/u.test(e.code));
 assert.equal(g.sql.state.versions.size,0,'stale read never repairs');
});
test('paged browser-import recovery: suppressed retention refuses and never publishes',async t=>{
 const f=await fixture(t);
 await f.versions().commit({...f.rec,expectedParentVersionId:null});
 f.sql.suppressed.add(`${f.rec.version.binding.tenantId}:artifact:${f.rec.version.artifactId}`);
 await assert.rejects(f.find(),e=>/RETENTION_SUPPRESSED|ARTIFACT_PUBLICATION/u.test(e.code));
 assert.equal(f.sql.state.versions.size,1);
});

test('an unexhausted tenant prefix proves neither uniqueness nor absence, even with an early match',async t=>{
 for(const earlyMatch of [false,true]){
  const f=await fixture(t);await f.versions().commit({...f.rec,expectedParentVersionId:null});
  const unrelated=structuredClone(f.rec);unrelated.version.binding.runId=randomUUID();
  const calls=[],revision=f.publication.state.revision;
  // Script only the pagination boundary: a genuine committed target also exists after the 1024-position cap.
  f.setPage(async q=>{calls.push(q);const records=Array.from({length:q.limit},(_,i)=>({record:
   q.offset+i===1100||earlyMatch&&q.offset+i===0?f.rec:unrelated}));
   return {records,nextOffset:q.offset+q.limit,positionSha256:q.positionSha256};});
  await assert.rejects(f.find(),{code:'ARTIFACT_BROWSER_IMPORT_SCAN_INCOMPLETE'});
  assert.equal(calls.reduce((n,q)=>n+q.limit,0),1024);assert.equal(calls.at(-1).limit,24);
  assert.equal(new Set(calls.map(q=>q.positionSha256)).size,1);
  assert.equal(f.sql.state.versions.size,1);assert.equal(f.publication.state.revision,revision);
 }
});

test('an empty filtered page with a continuation does not hide a later committed import',async t=>{
 const f=await fixture(t);await f.versions().commit({...f.rec,expectedParentVersionId:null});
 const calls=[];
 f.setPage(async q=>{calls.push(q);return q.offset===0?{records:[],nextOffset:100}:
  {records:[{record:f.rec}],nextOffset:null};});
 assert.equal((await f.find()).versionId,f.rec.version.versionId);
 assert.deepEqual(calls.map(q=>q.offset),[0,100]);
});

test('historical imports without original-name provenance stay readable but exact-name recovery is unresolved',async t=>{
 for(const paged of [false,true]){
  const f=await fixture(t),versions=paged?f.versions():f.sql.create(),legacy=structuredClone(f.rec);
  delete legacy.spec.originalFilename;legacy.specSha256=canonicalSha256(legacy.spec);
  await versions.commit({...legacy,expectedParentVersionId:null});
  const retained=await versions.read(legacy.version.versionId);
  assert.deepEqual(retained,legacy,'no rewrite or invented filename provenance');
  const b=legacy.version.binding;
  await assert.rejects(versions.findBrowserImport({tenantId:b.tenantId,conversationId:b.conversationId,
   actorId:b.actorId,runId:b.runId,filename:legacy.version.filename}),{code:'ARTIFACT_BROWSER_IMPORT_IDENTITY_UNKNOWN'});
  assert.equal(f.sql.state.versions.size,1);
 }
});
