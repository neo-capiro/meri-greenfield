/** Object -> version lookup used by filing. Local SQL protocol fixture only; never native DB admission. */
import test from 'node:test';import assert from 'node:assert/strict';
import {id,record,commit,sqlFixture} from './sql-fixture.mjs';
const query=r=>({objectId:r.version.object.objectId,tenantId:r.version.binding.tenantId,conversationId:r.version.binding.conversationId});
test('finds the one version holding an object within its tenant conversation, decoded and verified',async()=>{
 const f=sqlFixture(),a=record(),b=record(11,a.version.versionId);await f.create().commit(commit(a));await f.create().commit(commit(b));
 assert.equal(await f.create().findByObject(query(a)),a.version.versionId);assert.equal(await f.create().findByObject(query(b)),b.version.versionId);
 const sql=f.events.find(e=>e.sql.includes("record #>> '{version,object,objectId}'"));assert.match(sql.sql,/WHERE tenant_id=\$1 AND conversation_id=\$2 AND/);assert.deepEqual(sql.args,[a.version.binding.tenantId,a.version.binding.conversationId,a.version.object.objectId]);
});
test('another tenant or conversation, an unknown object, a duplicate holder or a corrupt row is refused',async()=>{
 const f=sqlFixture(),a=record();await f.create().commit(commit(a));
 for(const change of [q=>({...q,tenantId:'other-tenant'}),q=>({...q,conversationId:id(77)}),q=>({...q,objectId:id(78)})])await assert.rejects(f.create().findByObject(change(query(a))),{code:'ENOENT'});
 const twin=structuredClone(f.state.versions.get(a.version.versionId));twin.version_id=id(50);f.state.versions.set(id(50),twin);
 await assert.rejects(f.create().findByObject(query(a)),/CORRUPT/);f.state.versions.delete(id(50));
 const row=f.state.versions.get(a.version.versionId);row.record_sha256='f'.repeat(64);await assert.rejects(f.create().findByObject(query(a)),/CORRUPT/);
 for(const bad of [{...query(a),objectId:'x'},{...query(a),tenantId:''},{...query(a),extra:1}])await assert.rejects(f.create().findByObject(bad))
});
