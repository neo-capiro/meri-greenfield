import test from 'node:test';import assert from 'node:assert/strict';
import {createPostgresUploadStore} from '../postgres-store.mjs';
import {hash} from '../custody.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const owner={tenantId:'synthetic',actorId:'synthetic-actor',conversationId:id(1),clientId:null};
const record={uploadId:id(2),requestId:id(3),owner,declaration:{filename:'original.txt',mimeType:'text/plain',bytes:1,sha256:'a'.repeat(64)},scopes:[{tenantId:owner.tenantId,kind:'private-user',resourceId:owner.actorId,policyRevision:'p'}],objectId:id(4),object:null,state:'prepared',inspection:null,createdAtMs:1,updatedAtMs:1,revision:0};
const row={record,record_sha256:hash(record),tenant_id:owner.tenantId,owner_actor_id:owner.actorId,conversation_id:owner.conversationId,upload_id:record.uploadId,request_id:record.requestId,revision:0};
function fixture(value){const queries=[];let released=false;const store=createPostgresUploadStore({pool:{async connect(){return {async query(sql,args){queries.push({sql,args});return {rows:sql.startsWith('SELECT *')&&value?[value]:[]};},release(){released=true;}};}}});return {store,queries,released:()=>released};}
test('request lookup uses existing owner/request columns, validates client and never writes',async()=>{
 const f=fixture(row);assert.deepEqual(await f.store.readByRequest(owner,id(3),()=>{}),record);
 const query=f.queries.find(q=>q.sql.startsWith('SELECT *'));
 assert.equal(query.sql,'SELECT * FROM meri_uploads.originals WHERE tenant_id=$1 AND owner_actor_id=$2 AND conversation_id=$3 AND request_id=$4');
 assert.deepEqual(query.args,[owner.tenantId,owner.actorId,owner.conversationId,id(3)]);
 assert.equal(f.queries.some(q=>/INSERT|UPDATE|DELETE/.test(q.sql)),false);assert.equal(f.released(),true);
 await assert.rejects(f.store.readByRequest({...owner,clientId:id(9)},id(3),()=>{}),{code:'UPLOAD_ACCESS_DENIED'});
 assert.equal(await fixture(null).store.readByRequest(owner,id(3),()=>{}),null);
 await assert.rejects(f.store.readByRequest(owner,id(8),()=>{}),{code:'UPLOAD_STORE_CORRUPT'});
 await assert.rejects(fixture({...row,record_sha256:'bad'}).store.readByRequest(owner,id(3),()=>{}),{code:'UPLOAD_STORE_CORRUPT'});
});
