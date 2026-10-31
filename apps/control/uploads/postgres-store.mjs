/** One upload projection per original. No connection on import; caller owns the bounded pg pool. */
import {uploadRecord,uploadOwner,uploadRequestHash,hash,uuid,fail} from './custody.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
const same=(a,b)=>hash(a)===hash(b);
export function decodeUploadRow(row){
 if(!row)return null;const r=uploadRecord(row.record);
 if(row.record_sha256!==hash(r)||row.tenant_id!==r.owner.tenantId||row.owner_actor_id!==r.owner.actorId||row.conversation_id!==r.owner.conversationId||row.upload_id!==r.uploadId||row.request_id!==r.requestId||Number(row.revision)!==r.revision)fail('UPLOAD_STORE_CORRUPT');
 return r;
}
const decode=decodeUploadRow;
function transition(previous,next){
 const a=uploadRecord(previous),b=uploadRecord(next);
 for(const key of ['uploadId','requestId','owner','declaration','scopes','objectId','createdAtMs'])if(!same(a[key],b[key]))fail('UPLOAD_TRANSITION');
 if(b.revision!==a.revision+1||b.updatedAtMs<a.updatedAtMs||a.object!==null&&!same(a.object,b.object))fail('UPLOAD_TRANSITION');
 const allowed={prepared:['writing','removed'],writing:['stored'],stored:['stored','removing'],removing:['removed'],removed:[]};
 if(!allowed[a.state].includes(b.state)||a.state!=='stored'&&b.state!=='removed'&&!same(a.inspection,b.inspection)||b.state==='removing'&&!same(a.inspection,b.inspection))fail('UPLOAD_TRANSITION');
 return [a,b];
}
export function createPostgresUploadStore({pool}){
 const connect=storageMethod(pool,'connect');
 async function transaction(check,body){
  let c,begun=false,committing=false,reusable=false,value,failure;
  try{
   check();c=await connect();check();await c.query('BEGIN');begun=true;
   await c.query("SET LOCAL statement_timeout = '5s'");await c.query("SET LOCAL lock_timeout = '1s'");check();
   value=await body(c);check();committing=true;await c.query('COMMIT');reusable=true;check();
  }catch(cause){failure=cause;
   if(committing)failure=Object.assign(new Error('UPLOAD_COMMIT_UNKNOWN'),{code:'UPLOAD_COMMIT_UNKNOWN',cause});
   if(begun&&!committing)try{await c.query('ROLLBACK');reusable=true;}catch{}
  }finally{if(c)try{c.release(reusable?undefined:failure??new Error('UPLOAD_STORE_UNKNOWN'));}catch(error){failure??=error;}}
  if(failure)throw failure;return value;
 }
 return Object.freeze({
  prepare(value,check){const r=uploadRecord(value);if(r.state!=='prepared'||r.revision!==0||r.inspection!==null)fail('UPLOAD_TRANSITION');
   return transaction(check,async c=>{
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[hash({owner:r.owner,requestId:r.requestId})]);check();
    const old=decode((await c.query('SELECT * FROM meri_uploads.originals WHERE tenant_id=$1 AND owner_actor_id=$2 AND conversation_id=$3 AND request_id=$4 FOR UPDATE',[r.owner.tenantId,r.owner.actorId,r.owner.conversationId,r.requestId])).rows[0]);check();
    if(old){if(uploadRequestHash(old)!==uploadRequestHash(r))fail('UPLOAD_REQUEST_CONFLICT');return old;}
    await c.query('INSERT INTO meri_uploads.originals(tenant_id,owner_actor_id,conversation_id,upload_id,request_id,revision,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[r.owner.tenantId,r.owner.actorId,r.owner.conversationId,r.uploadId,r.requestId,r.revision,r,hash(r)]);check();return r;
   });},
  read(owner,uploadId,check){const o=uploadOwner(owner);uuid(uploadId);
   return transaction(check,async c=>{const r=decode((await c.query('SELECT * FROM meri_uploads.originals WHERE tenant_id=$1 AND owner_actor_id=$2 AND conversation_id=$3 AND upload_id=$4',[o.tenantId,o.actorId,o.conversationId,uploadId])).rows[0]);check();
    if(r&&!same(r.owner,o))fail('UPLOAD_ACCESS_DENIED');return r;});},
  /** Narrow same-transaction read (borrows the caller's client; no nested transaction/pool). Reuses the canonical
   * decode and the full uploadOwner check (tenantId, actorId, conversationId, clientId). */
  readOnClient(client,owner,uploadId,check=()=>{}){
   if(typeof client?.query!=='function')fail('UPLOAD_STORE_CORRUPT');
   const o=uploadOwner(owner);uuid(uploadId);check();
   return client.query('SELECT * FROM meri_uploads.originals WHERE tenant_id=$1 AND owner_actor_id=$2 AND conversation_id=$3 AND upload_id=$4',[o.tenantId,o.actorId,o.conversationId,uploadId]).then(({rows})=>{
    check();const r=decode(rows?.[0]);if(r&&!same(r.owner,o))fail('UPLOAD_ACCESS_DENIED');return r;});},
  readByRequest(owner,requestId,check){const o=uploadOwner(owner);uuid(requestId);
   return transaction(check,async c=>{const r=decode((await c.query('SELECT * FROM meri_uploads.originals WHERE tenant_id=$1 AND owner_actor_id=$2 AND conversation_id=$3 AND request_id=$4',[o.tenantId,o.actorId,o.conversationId,requestId])).rows[0]);check();
    if(r&&!same(r.owner,o))fail('UPLOAD_ACCESS_DENIED');if(r&&r.requestId!==requestId)fail('UPLOAD_STORE_CORRUPT');return r;});},
  transition(previous,next,check){const [a,b]=transition(previous,next);
   return transaction(check,async c=>{
    const result=await c.query('UPDATE meri_uploads.originals SET revision=$5,record=$6,record_sha256=$7 WHERE tenant_id=$1 AND upload_id=$2 AND revision=$3 AND record_sha256=$4 RETURNING *',[a.owner.tenantId,a.uploadId,a.revision,hash(a),b.revision,b,hash(b)]);check();
    if(result.rows.length!==1)fail('UPLOAD_CHANGED');const saved=decode(result.rows[0]);if(!same(saved,b))fail('UPLOAD_STORE_CORRUPT');return saved;
   });},
 });
}
