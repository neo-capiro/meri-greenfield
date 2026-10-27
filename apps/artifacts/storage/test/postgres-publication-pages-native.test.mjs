/** Task-owned PostgreSQL16 only; synthetic publication CAS/pages, never S3/target qualification. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomBytes} from 'node:crypto';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresArtifactVersions} from '../postgres-versions.mjs';
import {createPostgresRetentionJournal} from '../../../control/retention/postgres-journal.mjs';
import {pagedPublicationFixture} from './paged-publication-fixture.mjs';
import {publicationAuthority} from './publication-fixture.mjs';import {record,commit,id} from './sql-fixture.mjs';
import {v} from '../boundary.mjs';
const config=JSON.parse(readFileSync(process.env.MERI_PUBLICATION_PG_CONFIG,'utf8'));
if(config.marker!=='wave5-a5-publication-pages-20261027'||config.host!=='127.0.0.1'||!config.name.startsWith('w5-a5-pages-20261027-'))throw Error('OWNED_DATABASE_REQUIRED');
test('native PG16: >1024 publications, immutable projection/grants, concurrency and bounded recovery from an empty restored database',async t=>{
 const suffix=randomBytes(4).toString('hex'),role='w5_pages_control_'+suffix,connection={host:config.host,port:config.port,user:'postgres',password:config.password},admin=new pg.Pool({...connection,database:'postgres',max:2});t.after(()=>admin.end());
 const version=(await admin.query('SHOW server_version')).rows[0].server_version;assert.match(version,/^16\.15/u);for(const setting of['fsync','synchronous_commit','full_page_writes'])assert.equal((await admin.query('SHOW '+setting)).rows[0][setting],'on');
 await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${config.password}'`);
 const databases=[];async function database(label){const name='w5_pages_'+suffix+'_'+label;await admin.query('CREATE DATABASE '+name);databases.push(name);const setup=new pg.Pool({...connection,database:name,max:2});
  for(const path of['apps/control/conversations/migrations/0001_conversations.sql','apps/control/conversations/migrations/0010_retention.sql','apps/control/conversations/migrations/0013_retention_recovery_watermark.sql','apps/artifacts/migrations/0001_versions.sql','apps/artifacts/migrations/0002_retention.sql'])await setup.query(readFileSync(path,'utf8'));
  await setup.query(`GRANT USAGE ON SCHEMA meri_artifacts,meri_conversations TO ${role}; GRANT SELECT,INSERT,UPDATE ON meri_artifacts.versions,meri_artifacts.heads TO ${role}; GRANT SELECT,UPDATE ON meri_artifacts.retention_subjects,meri_conversations.retention_subjects TO ${role}; GRANT SELECT ON meri_conversations.retention_recovery_watermark,meri_artifacts.retention_purges TO ${role}`);
  const pool=new pg.Pool({...connection,database:name,user:role,max:8});t.after(()=>pool.end());t.after(()=>setup.end());return {pool,setup};
 }
 const first=await database('published'),tenant=record().version.binding.tenantId,published=pagedPublicationFixture(tenant,Date.now);await published.owner.upgrade((await published.owner.snapshot()).positionSha256);
 function adapter(pool){const journal=createPostgresRetentionJournal({pool,now:Date.now,maxRequestMs:30000}),retention={async assertServable(subject){const projection=await journal.get(`${subject.tenantId}:${subject.kind}:${subject.subjectId}`);if(projection&&projection.state!=='RELEASED')throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}};return createPostgresArtifactVersions({pool,now:Date.now,maxRequestMs:30000,journal,retention,tenantId:tenant,publication:published.create()});}
 const versions=adapter(first.pool);for(let n=0;n<1030;n++){const r=record(100000+n);r.version.artifactId=id(200000+n);await versions.commit(commit(r),undefined,publicationAuthority(r,Date.now()));}
 assert.equal((await first.setup.query('SELECT count(*)::int AS n FROM meri_artifacts.versions')).rows[0].n,1030);assert.equal((await first.setup.query('SELECT count(*)::int AS n FROM meri_artifacts.heads')).rows[0].n,1030);
 const a=record(100000);a.version.artifactId=id(200000);assert.deepEqual(await adapter(first.pool).read(a.version.versionId),a);
 await assert.rejects(first.pool.query('DELETE FROM meri_artifacts.versions WHERE version_id=$1',[a.version.versionId]),/permission denied/u);
 await assert.rejects(first.pool.query('UPDATE meri_artifacts.versions SET record_sha256=$2 WHERE version_id=$1',[a.version.versionId,'f'.repeat(64)]),/IMMUTABLE/u);
 const b=record(300000,a.version.versionId),c=record(300001,a.version.versionId);b.version.artifactId=c.version.artifactId=a.version.artifactId;
 const outcomes=await Promise.allSettled([b,c].map(r=>adapter(first.pool).commit(commit(r),undefined,publicationAuthority(r,Date.now()))));assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);
 const winner=outcomes[0].status==='fulfilled'?b:c,restored=await database('restored'),recover=adapter(restored.pool);await recover.recoverVersion(tenant,a.version.versionId);
 assert.deepEqual(await recover.read(a.version.versionId),a);assert.equal((await restored.setup.query('SELECT count(*)::int AS n FROM meri_artifacts.versions')).rows[0].n,2);assert.equal((await restored.setup.query('SELECT version_id FROM meri_artifacts.heads WHERE artifact_id=$1',[a.version.artifactId])).rows[0].version_id,winner.version.versionId);
 const projection={state:'SUPPRESSED',ledgerSequence:1};await restored.setup.query('INSERT INTO meri_artifacts.retention_subjects(tenant_id,artifact_id,owner_actor_id,state,suppressed_at,ledger_sequence,entry_sha256,projection,projection_sha256) VALUES($1,$2,$3,$4,now(),1,$5,$6,$7)',[tenant,a.version.artifactId,a.version.binding.actorId,'SUPPRESSED','a'.repeat(64),projection,v.hash(projection)]);
 await assert.rejects(recover.recoverVersion(tenant,a.version.versionId),e=>e.code==='RETENTION_SUPPRESSED');await assert.rejects(recover.read(a.version.versionId),e=>e.code==='RETENTION_SUPPRESSED');
 console.log(JSON.stringify({postgres:version,publishedDecisions:1031,initialArtifacts:1030,restoredRows:2,databases,concurrencyWinners:1,immutableUpdateDenied:true,deleteGrantDenied:true,retentionDenied:true}));
});
