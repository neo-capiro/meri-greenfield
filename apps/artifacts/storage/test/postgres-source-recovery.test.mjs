/** Canonical pg transaction/version owners over scripted SQL. No PostgreSQL execution or authoritative head fabrication. */
import test from 'node:test';import assert from 'node:assert/strict';
import {record,commit,sqlFixture} from './sql-fixture.mjs';import {createPostgresRetentionJournal} from '../../../control/retention/postgres-journal.mjs';
import {createPostgresArtifactSourceRecovery} from '../postgres-source-recovery.mjs';import {createPostgresS3PreviewCustody} from '../../preview/postgres-composition.mjs';
import {s3PreviewFixture} from './s3-preview-fixture.mjs';
import {publicationAuthority} from './publication-fixture.mjs';
function setup(){const f=sqlFixture(),queries=[];const pool={async connect(){return {async query(sql,args=[]){queries.push({sql,args});if(sql.startsWith('SELECT pg_advisory_unlock'))return {rows:[{unlocked:true}],rowCount:1};
  if(sql.startsWith('INSERT INTO meri_artifacts.versions')&&sql.endsWith('ON CONFLICT DO NOTHING')&&f.state.versions.has(args[0]))return {rows:[],rowCount:0};
  return f.client.query(sql==='BEGIN ISOLATION LEVEL READ COMMITTED'?'BEGIN':sql,args);},release(error){f.client.release(error);}};}};
 const journal=createPostgresRetentionJournal({pool,maxRequestMs:100}),versions=f.create({pool}),a=record();
 const recovery=createPostgresArtifactSourceRecovery({journal,versions,tenantId:a.version.binding.tenantId,artifactId:a.version.artifactId,now:Date.now,maxRequestMs:300});
 return {...f,pool,journal,versions,a,recovery,queries,recover:r=>journal.exclusive(()=>recovery.recover(r))};
}

test('synthetic source recovery: restores exact missing immutable row under canonical exclusion and existing published lineage',async()=>{
 const f=setup();await f.versions.commit(commit(f.a));f.state.versions.delete(f.a.version.versionId);f.queries.length=0;const result=await f.recover(f.a);
 assert.equal(result.published,true);assert.deepEqual(await f.versions.read(f.a.version.versionId),f.a);assert.equal(f.queries.some(q=>/^(INSERT|UPDATE|DELETE).*meri_artifacts.heads/u.test(q.sql)),false);
 assert.ok(f.queries.some(q=>q.sql==='BEGIN ISOLATION LEVEL READ COMMITTED'));assert.ok(f.releases.every(r=>r===null));
});

test('synthetic source recovery: absent durable publication stays unavailable; rolled-back SQL head restores only the recorded durable head',async()=>{
 const refusedHead=e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&e.cause?.code==='ARTIFACT_SOURCE_HEAD_UNAVAILABLE';
 const absent=setup();await assert.rejects(absent.recover(absent.a),refusedHead);assert.equal(absent.state.heads.size,0);assert.equal(absent.state.versions.size,0);
 const f=setup(),b=record(11,f.a.version.versionId);await f.versions.commit(commit(f.a));const oldHead=structuredClone(f.state.heads);await f.versions.commit(commit(b));f.state.heads=oldHead;f.state.versions.delete(b.version.versionId);
 await f.recover(b);assert.equal(f.state.heads.get(b.version.artifactId).version_id,b.version.versionId);assert.equal(f.state.versions.size,2);
});

test('synthetic source recovery: batch restores missing head-version prerequisites before canonical lineage verification',async()=>{
 const f=setup(),b=record(11,f.a.version.versionId);await f.versions.commit(commit(f.a));await f.versions.commit(commit(b));f.state.versions.clear();
 const receipts=await f.journal.exclusive(()=>f.recovery.recoverAll([f.a,b]));assert.equal(receipts.length,2);assert.ok(receipts.every(r=>r.published));assert.deepEqual(await f.versions.read(f.a.version.versionId),f.a);
});

test('synthetic source recovery: conflicting immutable bytes and cross-tenant source cannot overwrite or redirect ownership',async()=>{
 const f=setup();await f.versions.commit(commit(f.a));const changed=structuredClone(f.a);changed.requestSha256='f'.repeat(64);await assert.rejects(f.recover(changed));assert.deepEqual(await f.versions.read(f.a.version.versionId),f.a);
 const foreign=structuredClone(f.a);foreign.version.binding.tenantId='foreign';foreign.version.scopes.forEach(s=>s.tenantId='foreign');foreign.version.object.scopes.forEach(s=>s.tenantId='foreign');
 const before=f.queries.length;await assert.rejects(f.recovery.recover(foreign),/BINDING/);assert.equal(f.queries.length,before);
});

test('synthetic source recovery: unknown COMMIT retires its lease and does not report restored publication',async()=>{
 const f=setup();await f.versions.commit(commit(f.a));f.state.versions.delete(f.a.version.versionId);f.flags.commitFailure=true;
 await assert.rejects(f.recover(f.a),e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&e.cause?.code==='ARTIFACT_VERSION_COMMIT_UNKNOWN');assert.ok(f.releases.some(r=>r?.code==='RETENTION_COMMIT_UNKNOWN'));assert.equal(f.state.heads.size,1);
});

test('synthetic concrete composition: default disabled preview/recovery causes no SQL or SDK calls',async()=>{
 const f=setup(),s3=s3PreviewFixture(),composition=createPostgresS3PreviewCustody({journal:f.journal,versionsPool:f.pool,evidenceS3:{client:s3.config.client,bucket:s3.config.bucket,prefix:s3.config.prefix,expectedBucketOwner:s3.config.expectedBucketOwner,kmsKeyId:s3.config.kmsKeyId},tenantId:f.a.version.binding.tenantId,artifactId:f.a.version.artifactId,now:Date.now});
 await assert.rejects(composition.previews.read(f.a.version.versionId),/CUSTODY_DISABLED/);await assert.rejects(composition.recovery.ensureServing(),/CUSTODY_DISABLED/);await assert.rejects(composition.recovery.reconcileExclusive(),/CUSTODY_DISABLED/);
 await assert.rejects(composition.versions.commit(commit(f.a)),/CUSTODY_DISABLED/);await assert.rejects(composition.versions.recoverExclusive(),/CUSTODY_DISABLED/);
 assert.equal(f.queries.length,0);assert.equal(s3.s3.calls.length,0);
});

test('synthetic concrete composition: existing pg/version owners and actual conditional S3 commands publish and restore custody',async()=>{
 const db=sqlFixture(),s3=s3PreviewFixture();
 const journal={...s3.journal,tx(body,options){return s3.journal.tx(c=>body({query(sql,args){return /meri_artifacts\.(versions|heads)/u.test(sql)||sql.startsWith('SELECT s.projection,s.projection_sha256')?db.client.query(sql,args):c.query(sql,args);}}),options);}};
 const composition=createPostgresS3PreviewCustody({journal,versionsPool:db.pool,retention:db.retention,evidenceS3:{client:s3.config.client,bucket:s3.config.bucket,prefix:s3.config.prefix,expectedBucketOwner:s3.config.expectedBucketOwner,kmsKeyId:s3.config.kmsKeyId},tenantId:s3.source.version.binding.tenantId,artifactId:s3.source.version.artifactId,now:Date.now,enabled:true,maxRequestMs:500});
 await composition.versions.commit(commit(s3.source),undefined,publicationAuthority(s3.source,Date.now()));
 const service=s3.service(composition.previews);assert.equal((await service.publish(s3.version.versionId,s3.context)).status,'published');assert.equal(s3.state.puts,1);
 s3.state.rows.clear();db.state.versions.clear();await assert.rejects(composition.recovery.ensureServing());
 await journal.exclusive(()=>composition.recovery.reconcileExclusive());assert.equal((await service.publish(s3.version.versionId,s3.context)).status,'existing');assert.equal(s3.state.puts,1);
 assert.deepEqual(await composition.versions.read(s3.version.versionId),s3.source);assert.equal(s3.s3.roots.size,2);
});
