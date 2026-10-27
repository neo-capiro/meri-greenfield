import test from 'node:test';import assert from 'node:assert/strict';
import {v} from '../boundary.mjs';
import {sqlFixture,record,commit,id,NOW} from './sql-fixture.mjs';
import {pagedPublicationFixture} from './paged-publication-fixture.mjs';
import {libraryFixture,libraryRecord} from '../../test/library-fixture.mjs';
async function fixture(){const sql=sqlFixture(),publication=pagedPublicationFixture(record().version.binding.tenantId,()=>NOW);await publication.owner.upgrade((await publication.owner.snapshot()).positionSha256);const create=()=>sql.create({publication:publication.create(),maxRequestMs:30000});return {sql,publication,create,tenant:record().version.binding.tenantId};}
test('paged SQL: commits, exact replay and targeted lost-projection recovery never enumerate the tenant or full history',async()=>{
 const f=await fixture(),a=record(),b=record(11,a.version.versionId),c=record(12,b.version.versionId);for(const r of[a,b,c])await f.create().commit(commit(r));
 assert.deepEqual(await f.create().read(a.version.versionId),a);assert.equal((await f.create().commit(commit(a))).status,'duplicate');
 f.sql.state.versions.clear();f.sql.state.heads.clear();await f.create().recoverVersion(f.tenant,b.version.versionId);
 assert.equal(f.sql.state.versions.size,2);assert.equal(f.sql.state.versions.has(a.version.versionId),false);assert.equal(f.sql.state.heads.get(a.version.artifactId).version_id,c.version.versionId);assert.deepEqual(await f.create().read(b.version.versionId),b);
 assert.equal(f.sql.events.some(e=>e.sql.includes('jsonb_agg')||e.sql.startsWith('SELECT artifact_id FROM')),false);
 await f.create().recoverVersion(f.tenant,a.version.versionId);assert.deepEqual(await f.create().read(a.version.versionId),a);
});
test('paged SQL: divergent immutable row/current head and retention suppression cannot be repaired into permission',async()=>{
 const f=await fixture(),a=record(),b=record(11,a.version.versionId);await f.create().commit(commit(a));await f.create().commit(commit(b));const original=structuredClone(f.sql.state.versions.get(a.version.versionId));
 f.sql.state.versions.get(a.version.versionId).record.spec.title='tampered';await assert.rejects(f.create().recoverVersion(f.tenant,a.version.versionId),e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&e.cause?.code==='ARTIFACT_VERSION_CORRUPT');f.sql.state.versions.set(a.version.versionId,original);
 f.sql.suppressed.add(`${f.tenant}:artifact:${a.version.artifactId}`);await assert.rejects(f.create().recoverVersion(f.tenant,a.version.versionId),{code:'RETENTION_SUPPRESSED'});f.sql.suppressed.clear();
 f.sql.state.heads.get(a.version.artifactId).version_id=id(999);await assert.rejects(f.create().read(a.version.versionId),/ENOENT|UNVERIFIED/);
});
test('paged SQL: lost canonical ACK and commit ACK require explicit reconciliation and never republish',async()=>{
 const f=await fixture(),a=record();f.publication.state.lostRootAck=true;await assert.rejects(f.create().commit(commit(a)),/ACK_UNKNOWN/);assert.equal(f.sql.state.versions.size,0);const revision=f.publication.state.revision;
 await assert.rejects(f.create().commit(commit(a)),/PROJECTION_STALE/);await f.create().recoverVersion(f.tenant,a.version.versionId);assert.equal((await f.create().commit(commit(a))).status,'duplicate');assert.equal(f.publication.state.revision,revision);
 const b=record(11,a.version.versionId);f.sql.flags.commitFailure=true;await assert.rejects(f.create().commit(commit(b)),/COMMIT_UNKNOWN/);f.sql.flags.commitFailure=false;await f.create().recoverVersion(f.tenant,b.version.versionId);assert.deepEqual(await f.create().read(b.version.versionId),b);
});
test('paged SQL: explicit recovery pages cover the snapshot without certifying a partial page as complete',async()=>{
 const f=await fixture();for(let n=0;n<5;n++){const r=record(100+n);r.version.artifactId=id(200+n);await f.create().commit(commit(r));}f.sql.state.versions.clear();f.sql.state.heads.clear();const snapshot=await f.create().publicationSnapshot(f.tenant);
 const first=await f.create().recoverPage(f.tenant,{offset:0,limit:2,positionSha256:snapshot.positionSha256});assert.equal(first.restored.length,2);assert.equal(first.nextOffset,2);assert.equal(f.sql.state.versions.size,2);
 let offset=first.nextOffset;while(offset!==null){const page=await f.create().recoverPage(f.tenant,{offset,limit:2,positionSha256:snapshot.positionSha256});offset=page.nextOffset;}assert.equal(f.sql.state.versions.size,5);
});
async function pagedLibrary(){const f=await libraryFixture(),p=pagedPublicationFixture(f.context.binding.tenantId,()=>NOW);p.state.index=structuredClone(f.sql.durable.state.index);await p.owner.upgrade((await p.owner.snapshot()).positionSha256);const versions=f.sql.create({publication:p.create(),maxRequestMs:30000});return {...f,p,versions,service:()=>f.owner({versions})};}
test('paged library: denied/foreign candidates yield truthful empty continuation without repair or count disclosure',async()=>{
 const f=await pagedLibrary();f.sql.state.versions.clear();f.sql.state.heads.clear();f.state.denied.add(f.a.version.binding.conversationId);
 const first=await f.service().list({...f.query,limit:1},f.context);assert.deepEqual(first.versions,[]);assert.equal(f.sql.state.versions.size,0);assert.match(first.nextCursor,/^[a-f0-9]{64}$/u);assert.deepEqual(Object.keys(first).sort(),['nextCursor','scope','versions']);
 const second=await f.service().list({...f.query,limit:1,cursor:first.nextCursor},f.context);assert.deepEqual(second.versions,[f.b.version]);assert.equal(f.sql.state.versions.size,1);
 const rows=[...second.versions];let cursor=second.nextCursor;while(cursor!==null){const page=await f.service().list({...f.query,limit:1,cursor},f.context);rows.push(...page.versions);cursor=page.nextCursor;}assert.deepEqual(rows,[f.b.version,f.c.version]);assert.equal(f.state.calls.some(c=>c.versionId===f.d.version.versionId),false);
});
test('paged library: current root/query/scope/identity pins reject stale selectors; release-time denial stays hidden',async()=>{
 const f=await pagedLibrary(),first=await f.service().list({...f.query,limit:1},f.context),next={...f.query,limit:1,cursor:first.nextCursor};
 for(const change of[{limit:2},{scope:'conversation'},{cursor:'f'.repeat(64)}])await assert.rejects(f.service().list({...next,...change},f.context),/LIBRARY_CURSOR/);
 await assert.rejects(f.service().list(next,{...f.context,binding:{...f.context.binding,runId:id(999)}}),/LIBRARY_CURSOR/);
 f.state.releaseDenied.add(f.b.version.binding.conversationId);assert.deepEqual((await f.service().list(next,f.context)).versions,[]);
 await f.versions.commit(commit(libraryRecord(11,{artifactId:f.a.version.artifactId,parentVersionId:f.a.version.versionId})));await assert.rejects(f.service().list(next,f.context),/LIBRARY_CURSOR/);
});
test('paged history: immutable chain pages and current head remain anchored after selective recovery',async()=>{
 const f=await pagedLibrary(),b=libraryRecord(11,{artifactId:f.a.version.artifactId,parentVersionId:f.a.version.versionId}),c=libraryRecord(12,{artifactId:f.a.version.artifactId,parentVersionId:b.version.versionId});
 for(const r of[b,c]){r.version.contractVersion='0.2.0';await f.versions.commit(commit(r));}
 // Existing historical versions remain accepted by the schema; service metadata invariants are unchanged.
 const query={versionId:f.a.version.versionId,limit:2,cursor:null};
 const first=await f.service().history(query,f.context);assert.deepEqual(first.versions,[c.version,b.version]);assert.equal(first.headVersionId,c.version.versionId);const last=await f.service().history({...query,cursor:first.nextCursor},f.context);assert.deepEqual(last.versions,[f.a.version]);assert.equal(last.nextCursor,null);
 await assert.rejects(f.service().history({...query,limit:1,cursor:first.nextCursor},f.context),/HISTORY_CURSOR/);
});
