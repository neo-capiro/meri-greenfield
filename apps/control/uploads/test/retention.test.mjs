import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,uploadRecord} from '../custody.mjs';
import {uploadHash} from '../policy.mjs';
import {conversationContentTables} from '../../conversations/retention-content-rows.mjs';
import {decodeConversationInventoryRows} from '../../conversations/retention-inventory-decode.mjs';
import {enumerateReferences} from '../../retention/inventory.mjs';
import {conversationPurgeRow} from '../../retention/conversation-purge-rows.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
function fixture(state='stored'){
 const owner={tenantId:id(1),actorId:id(2),conversationId:id(3),clientId:null},scopes=[{tenantId:owner.tenantId,kind:'private-user',resourceId:owner.actorId,policyRevision:'policy1'}];
 const at=Date.parse('2026-10-27T00:00:00.000Z'),bytes=Buffer.from('original'),declaration={filename:'original.txt',mimeType:'text/plain',bytes:bytes.length,sha256:uploadHash(bytes)};
 const record=uploadRecord({uploadId:id(4),requestId:id(5),objectId:id(6),owner,scopes,declaration,state,object:['prepared','writing'].includes(state)?null:
  {objectId:id(6),versionId:'retained-native-version',sha256:declaration.sha256,bytes:bytes.length,scopes},inspection:null,createdAtMs:at,updatedAtMs:at,revision:state==='prepared'?0:2});
 const row={tenant_id:owner.tenantId,owner_actor_id:owner.actorId,conversation_id:owner.conversationId,upload_id:record.uploadId,request_id:record.requestId,revision:record.revision,record,record_sha256:hash(record)};
 const projection={conversationId:owner.conversationId,owner:{tenantId:owner.tenantId,actorId:owner.actorId},scopes,policyRevision:'policy1',createdAt:new Date(at).toISOString()};
 const raw={subject:{tenantId:owner.tenantId,kind:'conversation',subjectId:owner.conversationId,ownerActorId:owner.actorId},
  conversation:{tenant_id:owner.tenantId,conversation_id:owner.conversationId,owner_actor_id:owner.actorId,projection,projection_sha256:hash(projection)},
  runs:[],events:[],controls:[],checkpoints:[],completionCheckpoints:[],nextRuns:[],memoryContinuations:[],memoryContextRows:[],memoryCandidates:[],
  contentRows:Object.fromEntries(conversationContentTables.map(t=>[t.name,t.name==='meri_uploads.originals'?[row]:[]]))};
 return {raw,row,record,decode:()=>decodeConversationInventoryRows(raw)};
}
test('canonical no-run upload inventory retains exact raw object and row targets without inventing an execution',()=>{
 const f=fixture(),snapshot=f.decode(),inventory=enumerateReferences(snapshot);
 assert.equal(snapshot.runs.length,0);assert.equal(inventory.objects.length,1);assert.equal(inventory.objects[0].versionId,f.record.object.versionId);
 assert.deepEqual(inventory.objects[0].classes,['uploads']);
 const target=inventory.rowTargets.find(t=>t.className==='uploads');assert.equal(target.table,'meri_uploads.originals');assert.deepEqual(target.key,{upload_id:f.record.uploadId});
 const purge=conversationPurgeRow(snapshot.subject,{className:'uploads',target});assert.ok(purge);
 assert.equal(JSON.stringify(snapshot).includes('original.txt'),false,'inventory contains identity and hashes, not original filename or text');
});
test('unsettled native attempts cannot produce a partial purge inventory',()=>{
 for(const state of ['writing','removing'])assert.throws(()=>fixture(state).decode(),/STORE_CORRUPT/);
 const prepared=fixture('prepared'),inventory=enumerateReferences(prepared.decode());assert.equal(inventory.objects.length,0);assert.ok(inventory.rowTargets.some(t=>t.className==='uploads'));
});
test('owner, original scope and row tampering fail closed, and the source hash binds every upload reference',()=>{
 for(const change of [f=>{f.row.owner_actor_id=id(9);},f=>{f.row.record.owner.actorId=id(9);f.row.record_sha256=hash(f.row.record);},
  f=>{f.row.record.scopes[0].resourceId=id(9);f.row.record_sha256=hash(f.row.record);},f=>{f.row.record.object.versionId='forged';}]){
  const f=fixture();f.row.record=structuredClone(f.row.record);change(f);assert.throws(()=>f.decode(),/STORE_CORRUPT/);
 }
 const snapshot=structuredClone(fixture().decode());snapshot.uploads[0].object.versionId='different';assert.throws(()=>enumerateReferences(snapshot),/RETENTION_INVALID_REQUEST/);
});
