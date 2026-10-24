/** Local SQL protocol fixtures never establish native DB admission. */
import test from 'node:test';import assert from 'node:assert/strict';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {id,record,commit,sqlFixture,NOW} from './sql-fixture.mjs';
import {publicationFixture,publicationAuthority} from './publication-fixture.mjs';
test('canonical record/head atomically commit, fresh adapter reads and exact replay remains idempotent after newer head',async()=>{const f=sqlFixture(),a=record(),b=record(11,a.version.versionId),versions=f.create();
 assert.equal((await versions.commit(commit(a))).status,'committed');assert.deepEqual(await f.create().read(a.version.versionId),a);await versions.commit(commit(b));assert.deepEqual(await versions.read(a.version.versionId),a);
 assert.equal((await versions.commit(commit(a))).status,'duplicate');assert.equal(f.state.versions.size,2);assert.equal(f.state.heads.get(id(9)).version_id,b.version.versionId);assert.ok(f.events.some(x=>x.sql.includes('advisory_xact_lock')));assert.ok(f.events.some(x=>x.sql.includes('statement_timeout')));assert.ok(f.releases.every(x=>x===null));
});
test('stale parent rejects with rollback and no immutable row or changed head',async()=>{const f=sqlFixture(),a=record(),b=record(11,a.version.versionId);await f.create().commit(commit(a));await f.create().commit(commit(b));await assert.rejects(f.create().commit(commit(record(12,a.version.versionId))),/STALE_PARENT/);assert.equal(f.state.versions.size,2);assert.equal(f.state.heads.get(id(9)).version_id,b.version.versionId);assert.equal(f.events.at(-1).sql,'ROLLBACK');});
test('same immutable version cannot change request/spec/source object/binding; parent preserves owner/scopes',async()=>{for(const mutate of [r=>r.requestSha256='f'.repeat(64),r=>r.version.binding.runId=id(99),r=>r.version.object.versionId='FOREIGN_NATIVE',r=>{r.spec.title='Changed';r.specSha256=v.hash(r.spec);r.version.filename='Changed.txt';}]){const f=sqlFixture(),a=record();await f.create().commit(commit(a));const changed=structuredClone(a);mutate(changed);await assert.rejects(f.create().commit(commit(changed)),/IMMUTABLE_CONFLICT/);}
 for(const field of ['actorId','conversationId']){const f=sqlFixture(),a=record(),b=record(11,a.version.versionId);await f.create().commit(commit(a));b.version.binding[field]=field==='conversationId'?id(98):'foreign';await assert.rejects(f.create().commit(commit(b)),/PARENT_BINDING/);assert.equal(f.state.versions.size,1);}});
test('retained result hash supports only exact published lineage; request hash alone cannot find random old IDs',async()=>{const f=sqlFixture(),a=record();await f.create().commit(commit(a));const query={kind:'artifact-replay',versionId:id(999),requestSha256:a.requestSha256,resultSha256:v.hash(commit(a))};assert.deepEqual(await f.create().read(query),a);await assert.rejects(f.create().read({...query,resultSha256:null}),/REPLAY_UNRESOLVED/);f.state.heads.clear();await assert.rejects(f.create().read(a.version.versionId),/REPLAY_UNRESOLVED/);});
test('record/projection relational columns and hashes reject corruption',async()=>{for(const kind of ['record-hash','record-tuple','head-hash','head-tuple','object-scope']){const f=sqlFixture(),a=record();await f.create().commit(commit(a));const row=f.state.versions.get(a.version.versionId),head=f.state.heads.get(id(9));if(kind==='record-hash')row.record_sha256='f'.repeat(64);if(kind==='record-tuple')row.actor_id='foreign';if(kind==='head-hash')head.projection_sha256='f'.repeat(64);if(kind==='head-tuple')head.actor_id='foreign';if(kind==='object-scope'){row.record.version.object.scopes[0].policyRevision='foreign';row.record_sha256=v.hash(row.record);}await assert.rejects(f.create().read(a.version.versionId),/CORRUPT/);}});
test('lost commit acknowledgement is UNKNOWN, retained exact record then recovers without writing twice',async()=>{const f=sqlFixture(),a=record();f.flags.commitFailure=true;await assert.rejects(f.create().commit(commit(a)),/COMMIT_UNKNOWN/);assert.equal(f.releases.at(-1).code,'RETENTION_COMMIT_UNKNOWN');f.flags.commitFailure=false;assert.deepEqual(await f.create().read(a.version.versionId),a);assert.equal((await f.create().commit(commit(a))).status,'duplicate');assert.equal(f.events.filter(x=>x.sql.startsWith('INSERT INTO meri_artifacts.versions')).length,1);});
test('late borrowed acquisition is quarantined, and parked rollback is bounded',async()=>{const f=sqlFixture(),park=Promise.withResolvers();await assert.rejects(f.create({pool:{connect:()=>park.promise},maxRequestMs:20}).read(id(10)),/DEADLINE/);park.resolve(f.client);await new Promise(r=>setImmediate(r));assert.equal(f.releases.at(-1).message,'RETENTION_LATE_LEASE');
 f.flags.queryPark=true;f.flags.rollbackPark=true;const started=performance.now();await assert.rejects(f.create({maxRequestMs:20}).read(id(10)),/DEADLINE/);assert.ok(performance.now()-started<300);assert.ok(f.releases.at(-1));});
test('cancel before connection has no SQL and cancellation after insert rolls back',async()=>{const f=sqlFixture(),a=record(),controller=new AbortController();controller.abort();await assert.rejects(f.create().commit(commit(a),controller.signal),/DEADLINE/);assert.equal(f.events.length,0);
 const current=new AbortController();f.flags.hook=sql=>{if(sql.startsWith('INSERT INTO meri_artifacts.versions'))current.abort();};await assert.rejects(f.create().commit(commit(a),current.signal),/CANCELLED/);assert.equal(f.state.versions.size,0);assert.equal(f.state.heads.size,0);});

function multiTenant(){const f=sqlFixture(),indexes=new Map(),reads=[],flags={deny:null,change:null};
 const get=tenant=>{if(!indexes.has(tenant))indexes.set(tenant,publicationFixture(tenant,()=>NOW));return indexes.get(tenant);};
 const publications={forTenant(tenant){const original=get(tenant).publication;return {...original,async snapshot(signal){reads.push(tenant);if(flags.deny===tenant)throw Error('SYNTHETIC_PUBLICATION_DENIED');const out=await original.snapshot(signal);if(flags.change===tenant&&reads.filter(t=>t===tenant).length>1){const index=structuredClone(out.index);index.revision++;return {index,positionSha256:v.hash(index)};}return out;}};}};
 const create=()=>f.create({publication:null,tenantId:null,publications}),a=record(),b=record(20);b.version.artifactId=id(29);b.version.binding.tenantId='tenant-second';b.version.binding.actorId='actor-second';b.version.binding.conversationId=id(21);b.version.scopes.forEach(s=>s.tenantId='tenant-second');b.version.object.scopes.forEach(s=>s.tenantId='tenant-second');
 return {...f,indexes,reads,flags,sqlFlags:f.flags,get,create,a,b,seed:async()=>{await create().commit(commit(a));await create().commit(commit(b));},recover:tenant=>create().recoverTenant(tenant)};
}

test('dynamic versions select actual immutable tenant for commits, reads and exact object queries; suppression is independent',async()=>{
 const f=multiTenant();await f.seed();assert.equal(f.indexes.size,2);assert.deepEqual(await f.create().read(f.a.version.versionId),f.a);assert.deepEqual(await f.create().read(f.b.version.versionId),f.b);
 const query=r=>({tenantId:r.version.binding.tenantId,conversationId:r.version.binding.conversationId,objectId:r.version.object.objectId});assert.equal(await f.create().findByObject(query(f.b)),f.b.version.versionId);await assert.rejects(f.create().findByObject({...query(f.b),tenantId:f.a.version.binding.tenantId}),{code:'ENOENT'});
 f.suppressed.add(`${f.b.version.binding.tenantId}:conversation:${f.b.version.binding.conversationId}`);await assert.rejects(f.create().read(f.b.version.versionId),/RETENTION_SUPPRESSED/);assert.deepEqual(await f.create().read(f.a.version.versionId),f.a);
 assert.ok(f.events.some(e=>e.sql.includes('advisory_xact_lock')&&e.args[0]===`${f.b.version.binding.tenantId}:${f.b.version.artifactId}`));
});
test('dynamic commit cannot reuse another tenant authority or parent, and a corrupt lookup tuple refuses',async()=>{
 const f=multiTenant();await f.seed();const changed=structuredClone(f.b);changed.version.versionId=id(22);changed.version.parentVersionId=f.a.version.versionId;
 await assert.rejects(f.create().commit(commit(changed),undefined,publicationAuthority(f.a,NOW)),/CORRUPT/);
 await assert.rejects(f.create().commit(commit(changed)),/STALE_PARENT|PARENT_BINDING/);assert.equal(f.state.versions.size,2);
 f.state.versions.get(f.b.version.versionId).tenant_id=f.a.version.binding.tenantId;await assert.rejects(f.create().read(f.b.version.versionId),/CORRUPT/);
});
test('lazy recovery restores only the requested tenant, including rows absent from SQL; suppression remains effective',async()=>{
 const f=multiTenant();await f.seed();f.state.versions.clear();f.state.heads.clear();f.reads.length=0;
 f.suppressed.add(`${f.b.version.binding.tenantId}:artifact:${f.b.version.artifactId}`);
 const result=await f.recover(f.a.version.binding.tenantId);assert.deepEqual(result.restored,[f.a.version.artifactId]);assert.equal(f.state.versions.size,1);assert.ok(f.reads.every(t=>t===f.a.version.binding.tenantId));assert.deepEqual(await f.create().read(f.a.version.versionId),f.a);
 assert.deepEqual((await f.recover(f.b.version.binding.tenantId)).suppressed,[f.b.version.artifactId]);assert.equal(f.state.versions.size,1);
 f.suppressed.clear();await f.recover(f.b.version.binding.tenantId);assert.equal(f.state.versions.size,2);assert.deepEqual(await f.create().read(f.b.version.versionId),f.b);
});

test('lazy recovery has no global tenant count limit or enumeration, and a damaged unrelated tenant does not block access',async()=>{
 const f=multiTenant();await f.seed();for(let i=0;i<150;i++)f.get('unrelated-'+i);f.flags.deny=f.b.version.binding.tenantId;f.reads.length=0;
 await f.recover(f.a.version.binding.tenantId);assert.ok(f.reads.every(t=>t===f.a.version.binding.tenantId));await assert.rejects(f.recover(f.b.version.binding.tenantId));
 await assert.rejects(f.create().recoverExclusive(),/TENANT_REQUIRED/);
});

for(const kind of ['missing','denied','changed'])test(`lazy recovery ${kind} canonical document cannot certify its SQL`,async()=>{
 const f=multiTenant();await f.seed();f.reads.length=0;const tenant=f.a.version.binding.tenantId;
 if(kind==='missing')f.indexes.delete(tenant);if(kind==='denied')f.flags.deny=tenant;if(kind==='changed')f.flags.change=tenant;
 await assert.rejects(f.recover(tenant));assert.equal(f.state.versions.size,2);
});

test('lazy recovery cancellation before exclusion and commit uncertainty never certify readiness',async()=>{
 const f=multiTenant();await f.seed();const abort=new AbortController();abort.abort();const before=f.events.length;
 await assert.rejects(f.create().recoverTenant(f.a.version.binding.tenantId,abort.signal));assert.equal(f.events.length,before);
 f.sqlFlags.commitFailure=true;await assert.rejects(f.recover(f.a.version.binding.tenantId));assert.ok(f.releases.some(e=>e?.code==='RETENTION_COMMIT_UNKNOWN'));assert.equal(f.releases.at(-1),null,'confirmed exclusive unlock releases its own clean lease');
});

test('lazy recovery unlock uncertainty discards the lease and never returns successful repair',async()=>{
 const f=multiTenant();await f.seed();f.state.versions.clear();f.state.heads.clear();
 f.sqlFlags.hook=sql=>{if(sql.startsWith('SELECT pg_advisory_unlock'))throw Error('SYNTHETIC_UNLOCK_UNKNOWN');};
 await assert.rejects(f.recover(f.a.version.binding.tenantId),/RETENTION_STORE_UNAVAILABLE/);assert.ok(f.releases.at(-1));
 // Projection may have committed: uncertainty is not a no-effect claim. A clean retry reuses durable publication.
 f.sqlFlags.hook=null;assert.deepEqual((await f.recover(f.a.version.binding.tenantId)).restored,[f.a.version.artifactId]);
 assert.equal(f.get(f.a.version.binding.tenantId).state.index.decisions.length,1);
});

test('dynamic reader still refuses SQL rollback behind a later unpreviewed publication',async()=>{
 const f=multiTenant();await f.seed();const snapshot=structuredClone(f.state);const next=structuredClone(f.b);next.version.versionId=id(25);next.version.parentVersionId=f.b.version.versionId;
 await f.create().commit(commit(next));f.state.versions=snapshot.versions;f.state.heads=snapshot.heads;await assert.rejects(f.create().read(f.b.version.versionId),/PUBLICATION_PROJECTION_STALE/);assert.deepEqual(await f.create().read(f.a.version.versionId),f.a);
});
