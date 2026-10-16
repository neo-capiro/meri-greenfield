/** Synthetic production-source controls: conditional memory port + scripted SQL; no native DB, browser or provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {v} from '../boundary.mjs';import {createPostgresArtifactVersions} from '../postgres-versions.mjs';
import {createPostgresArtifactSourceRecovery} from '../postgres-source-recovery.mjs';
import {sqlFixture,record,commit,NOW,id} from './sql-fixture.mjs';import {publicationAuthority} from './publication-fixture.mjs';
const input=r=>({record:r,expectedParentVersionId:r.version.parentVersionId,...publicationAuthority(r,NOW)});
const recover=f=>f.journal.exclusive(()=>f.create().recoverExclusive());

test('publication: canonical commit retains full envelope, original authority/invocation and head BEFORE SQL projection',async()=>{
 const f=sqlFixture(),a=record();f.flags.hook=sql=>{if(sql.startsWith('INSERT INTO meri_artifacts.versions')){assert.equal(f.durable.state.index.heads[0].versionId,a.version.versionId);assert.deepEqual(f.durable.state.index.decisions[0].record,a);}};
 await f.create().commit(commit(a));const d=f.durable.state.index.decisions[0];assert.deepEqual(d.authorization,input(a).authorization);assert.deepEqual(d.invocation,input(a).invocation);assert.equal(d.recordSha256,v.hash(a));
 const authority=publicationAuthority(a,NOW);authority.authorization.receiptId='current-recheck';assert.equal((await f.create().commit(commit(a),undefined,authority)).status,'duplicate');assert.equal(f.durable.state.writes,1);assert.equal(f.durable.state.index.decisions[0].authorization.receiptId,d.authorization.receiptId);
});

test('publication: two independent durable owners choose one child of the exact parent',async()=>{
 const f=sqlFixture(),a=record(),b=record(11,a.version.versionId),c=record(12,a.version.versionId);await f.create().commit(commit(a));const position=(await f.durable.publication.snapshot()).positionSha256;
 const results=await Promise.allSettled([f.durable.create().publish(input(b),position),f.durable.create().publish(input(c),position)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal(f.durable.state.index.decisions.length,2);
 const head=f.durable.state.index.heads[0].versionId;assert.ok([b.version.versionId,c.version.versionId].includes(head));await recover(f);assert.equal(f.state.heads.get(a.version.artifactId).version_id,head);
});

test('publication: applied durable CAS with lost ACK stays UNKNOWN; ordinary retry cannot bless stale SQL; explicit recovery reuses decision',async()=>{
 const f=sqlFixture(),a=record();f.durable.state.lostAck=true;await assert.rejects(f.create().commit(commit(a)),/ACK_UNKNOWN/);assert.equal(f.state.versions.size,0);assert.equal(f.state.heads.size,0);assert.equal(f.durable.state.writes,1);
 await assert.rejects(f.create().commit(commit(a)),/PROJECTION_STALE/);assert.equal(f.durable.state.writes,1);await recover(f);assert.equal((await f.create().commit(commit(a))).status,'duplicate');assert.equal(f.durable.state.writes,1);assert.deepEqual(await f.create().read(a.version.versionId),a);
});

test('publication: SQL COMMIT ACK lost retains decision and lease is discarded; replay never creates another decision',async()=>{
 const f=sqlFixture(),a=record();f.flags.commitFailure=true;await assert.rejects(f.create().commit(commit(a)),/COMMIT_UNKNOWN/);assert.equal(f.releases.at(-1)?.code,'RETENTION_COMMIT_UNKNOWN');assert.equal(f.durable.state.writes,1);f.flags.commitFailure=false;
 await recover(f);assert.equal((await f.create().commit(commit(a))).status,'duplicate');assert.equal(f.durable.state.writes,1);
});

test('publication: never-previewed later version survives rollback and unseen reader refuses old SQL head',async()=>{
 const f=sqlFixture(),a=record(),b=record(11,a.version.versionId);await f.create().commit(commit(a));const snapshot=structuredClone(f.state);const unseen=f.create();await f.create().commit(commit(b));f.state.versions=snapshot.versions;f.state.heads=snapshot.heads;
 await assert.rejects(unseen.read(a.version.versionId),/PROJECTION_STALE/);await assert.rejects(f.create().commit(commit(record(12,a.version.versionId))),/PROJECTION_STALE/);assert.equal(f.durable.state.writes,2);
 await recover(f);assert.equal(f.state.heads.get(a.version.artifactId).version_id,b.version.versionId);assert.deepEqual(await unseen.read(b.version.versionId),b);assert.deepEqual(await unseen.read(a.version.versionId),a);assert.equal(f.durable.state.writes,2);
});

test('publication: complete SQL loss restores all immutable versions and ONLY durable current head',async()=>{
 const f=sqlFixture(),a=record(),b=record(11,a.version.versionId);await f.create().commit(commit(a));await f.create().commit(commit(b));f.state.versions.clear();f.state.heads.clear();const result=await recover(f);
 assert.equal(result.versions.length,2);assert.equal(f.state.versions.size,2);assert.equal(f.state.heads.get(a.version.artifactId).version_id,b.version.versionId);assert.deepEqual(await f.create().read(a.version.versionId),a);
});

test('publication: conflicting immutable SQL, incomplete facts and unexplained cutover cannot be normalized',async()=>{
 for(const kind of ['conflicting','incomplete','head']){const f=sqlFixture(),a=record();await f.create().commit(commit(a));
  if(kind==='conflicting'){const row=f.state.versions.get(a.version.versionId);row.record.requestSha256='f'.repeat(64);row.request_sha256=row.record.requestSha256;row.record_sha256=v.hash(row.record);}
  if(kind==='incomplete')f.durable.state.index.decisions=[];if(kind==='head')f.durable.state.index.heads=[];
  const before=structuredClone(f.state);await assert.rejects(f.create().read(a.version.versionId));await assert.rejects(recover(f));assert.deepEqual(f.state,before);assert.equal(f.durable.state.writes,1);
 }
 const cutover=sqlFixture(),a=record();await cutover.create().commit(commit(a));cutover.durable.state.index={...cutover.durable.state.index,decisions:[],heads:[]};await assert.rejects(cutover.create().read(a.version.versionId),/IMMUTABLE_CONFLICT/);await assert.rejects(cutover.create().commit(commit(record(11,a.version.versionId))),/IMMUTABLE_CONFLICT/);await assert.rejects(recover(cutover));assert.equal(cutover.durable.state.writes,1);
});

test('publication: suppressed conversation/artifact and durable terminal tombstone never resurrect purged SQL',async()=>{
 for(const kind of ['artifact','conversation','terminal']){const f=sqlFixture(),a=record();await f.create().commit(commit(a));
  if(kind==='terminal')await f.durable.publication.tombstone({artifactId:a.version.artifactId,versionId:a.version.versionId,retentionDecisionSha256:'a'.repeat(64)});else f.suppressed.add(`${a.version.binding.tenantId}:${kind}:${kind==='artifact'?a.version.artifactId:a.version.binding.conversationId}`);
  await assert.rejects(f.create().read(a.version.versionId));f.state.versions.clear();f.state.heads.clear();const result=await recover(f);assert.deepEqual(result.suppressed,[a.version.artifactId]);assert.equal(f.state.versions.size,0);assert.equal(f.state.heads.size,0);await assert.rejects(f.create().commit(commit(record(11,a.version.versionId))));
 }
});

test('publication: source recovery cannot turn an unrecorded preview claim into publication; historical claim does not rewind later head',async()=>{
 const f=sqlFixture(),a=record(),b=record(11,a.version.versionId),versions=f.create(),source=createPostgresArtifactSourceRecovery({journal:f.journal,versions,tenantId:a.version.binding.tenantId,artifactId:a.version.artifactId,now:()=>NOW});
 await assert.rejects(f.journal.exclusive(()=>source.recover(a)));assert.equal(f.state.versions.size,0);await versions.commit(commit(a));await versions.commit(commit(b));f.state.versions.clear();f.state.heads.clear();await f.journal.exclusive(()=>source.recover(a));assert.equal(f.state.heads.get(a.version.artifactId).version_id,b.version.versionId);assert.deepEqual(await versions.read(b.version.versionId),b);
});

test('publication: recovery metadata uses existing exclusion with fence closed, ordinary reads remain fenced',async()=>{
 const f=sqlFixture(),a=record();await f.create().commit(commit(a));const gate={async assertServable(){throw Object.assign(Error('RETENTION_RECOVERY_BARRIER'),{code:'RETENTION_RECOVERY_BARRIER'});}},versions=f.create({retention:gate});await assert.rejects(versions.read(a.version.versionId),/RECOVERY_BARRIER/);
 await f.journal.exclusive(async()=>{await versions.recoverExclusive();assert.deepEqual(await versions.readExclusive(a.version.versionId),a);});await assert.rejects(versions.read(a.version.versionId),/RECOVERY_BARRIER/);
});

test('publication: missing owner or unavailable evidence fails closed before publication and never bootstraps SQL',async()=>{
 const f=sqlFixture(),a=record(),legacy=createPostgresArtifactVersions({pool:f.pool,now:()=>NOW});await assert.rejects(legacy.commit(commit(a)),/PUBLICATION_UNAVAILABLE/);await assert.rejects(legacy.read(id(10)),/PUBLICATION_UNAVAILABLE/);assert.equal(f.events.length,0);
 f.durable.state.deny=true;await assert.rejects(f.create().commit(commit(a)));assert.equal(f.state.versions.size,0);assert.equal(f.durable.state.writes,0);
});

test('publication: conflicting replay bytes, invocation binding, expired authority and parent ownership never add a decision',async()=>{
 const f=sqlFixture(),a=record();await f.create().commit(commit(a));const changed=structuredClone(a);changed.requestSha256='f'.repeat(64);await assert.rejects(f.create().commit(commit(changed)),/IMMUTABLE_CONFLICT/);
 const other=publicationAuthority(a,NOW);other.invocation.budgetTicketId='different-ticket';await assert.rejects(f.create().commit(commit(a),undefined,other),/IMMUTABLE_CONFLICT/);
 const b=record(11,a.version.versionId),expired=publicationAuthority(b,NOW);expired.authorization.expiresAtMs=NOW;await assert.rejects(f.create().commit(commit(b),undefined,expired),/AUTHORITY/);b.version.binding.actorId='foreign';await assert.rejects(f.create().commit(commit(b)));assert.equal(f.durable.state.writes,1);assert.equal(f.state.versions.size,1);
});

test('publication: suppression after durable decision prevents SQL publication and recovery never restores it',async()=>{
 const f=sqlFixture(),a=record();f.durable.state.writeHook=()=>f.suppressed.add(`${a.version.binding.tenantId}:artifact:${a.version.artifactId}`);
 await assert.rejects(f.create().commit(commit(a)),/SUPPRESSED/);assert.equal(f.durable.state.writes,1);assert.equal(f.state.versions.size,0);assert.equal(f.state.heads.size,0);assert.deepEqual((await recover(f)).suppressed,[a.version.artifactId]);assert.equal(f.state.versions.size,0);
});
