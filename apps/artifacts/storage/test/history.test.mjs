/** Canonical publication/SQL protocol checks only; no live database or storage qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {record,commit,sqlFixture,id} from './sql-fixture.mjs';
async function fixture(){const f=sqlFixture(),a=record(),b=record(11,a.version.versionId),c=record(12,b.version.versionId);for(const r of[a,b,c])await f.create().commit(commit(r));return {f,a,b,c};}
test('history reconstructs the complete immutable chain from any anchor after owner restart without writes',async()=>{
 const {f,a,b,c}=await fixture(),before=f.events.length,writes=f.durable.state.writes;
 const result=await f.create().history(a.version.versionId);
 assert.deepEqual(result,{artifactId:a.version.artifactId,anchorVersionId:a.version.versionId,headVersionId:c.version.versionId,records:[c,b,a]});
 assert.equal(f.durable.state.writes,writes);assert.equal(f.events.slice(before).some(e=>/^(INSERT|UPDATE|DELETE)/u.test(e.sql)),false);
 assert.deepEqual((await f.create().history(b.version.versionId)).records,[c,b,a]);
});
test('unknown, corrupt and missing published versions cannot become history',async()=>{
 const {f,a,b}=await fixture();await assert.rejects(f.create().history(id(99)),{code:'ENOENT'});
 const row=f.state.versions.get(b.version.versionId);row.record_sha256='f'.repeat(64);await assert.rejects(f.create().history(a.version.versionId),/CORRUPT/);
 f.state.versions.delete(b.version.versionId);await assert.rejects(f.create().history(a.version.versionId),{code:'ARTIFACT_PUBLICATION_PROJECTION_STALE'});
});
test('artifact and conversation retention refuse history, including suppression during collection',async()=>{
 const {f,a}=await fixture(),binding=a.version.binding;
 for(const key of[`${binding.tenantId}:artifact:${a.version.artifactId}`,`${binding.tenantId}:conversation:${binding.conversationId}`]){f.suppressed.add(key);await assert.rejects(f.create().history(a.version.versionId),{code:'RETENTION_SUPPRESSED'});f.suppressed.clear();}
 f.durable.state.readHook=()=>f.suppressed.add(`${binding.tenantId}:artifact:${a.version.artifactId}`);
 await assert.rejects(f.create().history(a.version.versionId),{code:'RETENTION_SUPPRESSED'});
});
test('publication changes during collection refuse the snapshot',async()=>{
 const {f,a,c}=await fixture();let reads=0;
 f.durable.state.readHook=()=>{if(++reads===2)f.durable.state.index.tombstones.push({artifactId:a.version.artifactId,versionId:c.version.versionId,retentionDecisionSha256:'f'.repeat(64)});};
 await assert.rejects(f.create().history(a.version.versionId),{code:'ARTIFACT_PUBLICATION_STALE'});
});
