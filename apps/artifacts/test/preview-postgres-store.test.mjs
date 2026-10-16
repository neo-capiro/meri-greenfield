/** Reserved-schema source adapter over the real canonical transaction owner with scripted SQL and synthetic versions. No DB. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPostgresRetentionJournal} from '../../control/retention/postgres-journal.mjs';
import {createPostgresPreviewStore} from '../preview/postgres-store.mjs';import {createArtifactPreviewService} from '../preview/service.mjs';
import {previewClaim} from '../preview/claim.mjs';import {previewRecord} from '../preview/record.mjs';
function fixture(){const createdAt='2026-01-01T00:00:00.000Z',binding={tenantId:'synthetic',actorId:'owner',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'tenant',resourceId:binding.tenantId,policyRevision:'1'}],object={objectId:randomUUID(),versionId:'source-native-v1',sha256:'1'.repeat(64),bytes:123,scopes};
 const version=v.version({contractVersion:'0.1.0',artifactId:randomUUID(),versionId:randomUUID(),parentVersionId:null,binding,scopes,evidence:[],filename:'synthetic.pdf',mimeType:'application/pdf',generationStatus:'draft',previewStatus:'pending',createdAt,object});
 const context=v.context({binding,scopes,evidence:[],assets:[],deadlineMs:Date.parse(createdAt)+60000,maxBytes:8388608}),claim=previewClaim(v,version,{objectId:randomUUID(),versionId:randomUUID()},context,createdAt);
 const known={...object,objectId:claim.objectId,versionId:'preview-native-v1'},record=previewRecord({v,previewId:claim.previewId,version,object:known,pages:1,conversion:{method:'source-pdf',inputSha256:object.sha256,outputSha256:known.sha256,qualificationId:null,imageDigest:null},createdAt});
 const row={tenant_id:binding.tenantId,artifact_id:version.artifactId,conversation_id:binding.conversationId,version_id:version.versionId,source_version_sha256:v.hash(version),source_sha256:object.sha256,
  preview_id:claim.previewId,object_id:claim.objectId,claim,claim_sha256:v.hash(claim),object_reference:known,object_reference_sha256:v.hash(known),object_version_id:known.versionId,record,record_sha256:v.hash(record)};
 const state={rows:[row],lostCommit:false,reads:0},leases=[];
 const pool={async connect(){const lease={queries:[],releases:[],async query(sql,args){lease.queries.push({sql,args});if(sql==='COMMIT'&&state.lostCommit)throw Error('synthetic lost COMMIT');
    return {rows:sql.startsWith('SELECT a.*,p.record')?structuredClone(state.rows):[],rowCount:0};},release(error){lease.releases.push(error);}};leases.push(lease);return lease;}};
 const journal=createPostgresRetentionJournal({pool,maxRequestMs:200}),versions={async read(id){state.reads++;assert.equal(leases.at(-1).releases.length,1,'release the metadata lease before borrowing the source reader');if(id!==version.versionId)throw Error('wrong source');return {version:structuredClone(version)};}};
 const create=options=>createPostgresPreviewStore({journal,versions,tenantId:binding.tenantId,artifactId:version.artifactId,now:Date.now,...options});
 return {row,record,version,state,leases,create};}

test('synthetic preview projection reads canonical packets under the existing transaction and returns detached custody',async()=>{
 const f=fixture(),store=f.create();assert.deepEqual(await store.read(f.version.versionId),f.record);const custody=await store.custody();
 assert.equal(custody[0].state,'COMMITTED');assert.throws(()=>{custody[0].claim.binding.actorId='changed';},TypeError);
 f.row.claim.binding.actorId='changed source';assert.equal(custody[0].claim.binding.actorId,'owner');
 for(const lease of f.leases){const sql=lease.queries.map(q=>q.sql),select=sql.findIndex(q=>q.startsWith('SELECT a.*,p.record'));
  assert.equal(sql[0],'BEGIN ISOLATION LEVEL READ COMMITTED');assert.ok(sql[select-1].startsWith('SELECT pg_advisory_xact_lock_shared'));
  assert.equal(sql.at(-1),'COMMIT');assert.deepEqual(lease.releases,[undefined]);assert.equal(sql.some(q=>/^(INSERT|UPDATE|DELETE)/u.test(q)),false);}
});

test('synthetic preview projection retains potential and known UNKNOWN orphans and cannot activate publication',async()=>{
 const f=fixture();f.state.rows[0].record=null;f.state.rows[0].record_sha256=null;const store=f.create();
 assert.equal((await store.custody())[0].object.versionId,'preview-native-v1');assert.equal((await store.custody())[0].state,'UNKNOWN');
 f.state.rows[0].object_reference=null;f.state.rows[0].object_reference_sha256=null;f.state.rows[0].object_version_id=null;
 const custody=await store.custody();assert.equal(custody[0].object,null);assert.equal(custody[0].claim.objectId,f.row.object_id);assert.equal(await store.read(f.version.versionId),null);
 let puts=0;assert.throws(()=>createArtifactPreviewService({validators:v,previews:store,artifacts:{inspect(){},download(){}},objects:{put(){puts++;},get(){}},ids(){},now:Date.now}),/ARTIFACT_CONFIGURATION/);assert.equal(puts,0);
});

test('synthetic preview projection refuses mismatched row, claim, native custody and immutable record hashes',async()=>{
 const mutations=[r=>{r.tenant_id='other';},r=>{r.version_id=randomUUID();},r=>{r.claim_sha256='0'.repeat(64);},r=>{r.source_version_sha256='0'.repeat(64);},
  r=>{r.object_reference_sha256='0'.repeat(64);},r=>{r.object_version_id='other-native-version';},r=>{r.record_sha256='0'.repeat(64);},r=>{r.record.preview.object.objectId=randomUUID();r.record_sha256=v.hash(r.record);}];
 for(const mutate of mutations){const f=fixture();mutate(f.row);await assert.rejects(f.create().read(f.version.versionId),e=>e.code?.startsWith('ARTIFACT_'));assert.ok(f.leases.every(l=>l.releases.every(e=>e===undefined)));}
});

test('synthetic preview projection refuses overflow, duplicate inventory and uncertain transaction completion without a partial release',async()=>{
 const overflow=fixture();overflow.state.rows.push(structuredClone(overflow.row));await assert.rejects(overflow.create({maxRows:1}).custody(),/ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE/);
 assert.equal(overflow.state.reads,0);assert.deepEqual(overflow.leases[0].releases,[undefined],'overflow releases no inventory and leaves the borrowed lease clean');
 const duplicate=fixture();duplicate.state.rows.push(structuredClone(duplicate.row));await assert.rejects(duplicate.create().custody(),/ARTIFACT_PREVIEW_STORE_CORRUPT/);
 const lost=fixture();lost.state.lostCommit=true;await assert.rejects(lost.create().custody(),/ARTIFACT_PREVIEW_STORE_UNAVAILABLE/);assert.equal(lost.state.reads,0);
 assert.ok(lost.leases[0].releases[0] instanceof Error);assert.equal(lost.leases[0].queries.some(q=>q.sql==='ROLLBACK'),false);
});
