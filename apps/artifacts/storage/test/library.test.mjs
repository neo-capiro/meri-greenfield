/** Internal candidate discovery is publication-backed metadata, not current user authority. */
import test from 'node:test';import assert from 'node:assert/strict';
import {libraryFixture,libraryRecord,id} from '../../test/library-fixture.mjs';import {commit} from './sql-fixture.mjs';
const selection=f=>({tenantId:f.context.binding.tenantId,actorId:f.context.binding.actorId,conversationId:null,clientId:null});
test('candidate discovery returns only current own heads with exact scope filters and no SQL or object writes',async()=>{
 const f=await libraryFixture(),next=libraryRecord(11,{artifactId:f.a.version.artifactId,parentVersionId:f.a.version.versionId});await f.sql.create().commit(commit(next));const before=f.sql.events.length,writes=f.sql.durable.state.writes;
 const list=await f.sql.create().list(selection(f));assert.deepEqual(new Set(list.records.map(r=>r.version.versionId)),new Set([next.version.versionId,f.b.version.versionId,f.c.version.versionId]));assert.equal(f.sql.events.length,before);assert.equal(f.sql.durable.state.writes,writes);
 assert.equal((await f.sql.create().list({...selection(f),conversationId:id(1)})).records.length,1);assert.equal((await f.sql.create().list({...selection(f),clientId:id(500)})).records.length,2);
});
test('terminal publications vanish and corrupt or absent custody fails closed',async()=>{
 const f=await libraryFixture();await f.sql.durable.publication.tombstone({artifactId:f.a.version.artifactId,versionId:f.a.version.versionId,retentionDecisionSha256:'f'.repeat(64)});assert.equal((await f.sql.create().list(selection(f))).records.some(r=>r.version.artifactId===f.a.version.artifactId),false);
 f.sql.durable.state.index.decisions[0].recordSha256='f'.repeat(64);await assert.rejects(f.sql.create().list(selection(f)),{code:'ARTIFACT_PUBLICATION_CORRUPT'});
 const before=f.sql.events.length;await assert.rejects(f.sql.create({journal:null}).list(selection(f)),{code:'ARTIFACT_PUBLICATION_UNAVAILABLE'});assert.equal(f.sql.events.length,before);
});
