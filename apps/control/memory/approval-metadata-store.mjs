/** Memory's immutable proposal metadata rows in the existing commands table. The task metadata store is intentionally task-only;
 * this store validates the memory payload independently and takes the same conversation lock as the memory candidate journal
 * before INSERT. No table, migration or retention authority is created here. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {CommandError,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertPool,transact} from '../product-persistence/transaction.mjs';
import {ProductError,productFailure} from '../product-access/errors.mjs';
import {subjectKey} from '../retention/boundary.mjs';
import {memoryMetadataPayload} from './approval-metadata.mjs';

const TABLE='meri_commands.approval_metadata';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const fail=code=>{throw new ProductError(code);};
const metadataError=(error,mutation)=>{
 const failure=productFailure(error);
 return Object.assign(new CommandError(failure?.code==='MEMORY_METADATA_UNKNOWN'?'APPROVAL_METADATA_UNKNOWN':'COMMAND_PREPARATION_REFUSED'),
  {outcome:failure?.code==='MEMORY_METADATA_UNKNOWN'?'UNKNOWN':mutation?'NOT_STORED':'READ_UNAVAILABLE'});
};
function decoded(row){
 if(!row||typeof row!=='object'||typeof row.payload_sha256!=='string')fail('MEMORY_METADATA_REFUSED');
 const payload=memoryMetadataPayload(row.payload);
 if(canonicalSha256(payload)!==row.payload_sha256)fail('MEMORY_METADATA_REFUSED');return payload;
}
export function createPostgresMemoryApprovalMetadataStore({pool}){
 assertPool(pool);
 const tx=(check,body,readOnly=false)=>transact(pool,body,{check,readOnly,unavailable:'MEMORY_METADATA_REFUSED',uncertain:'MEMORY_METADATA_UNKNOWN'});
 return Object.freeze({
  async insert(value,check){
   const payload=memoryMetadataPayload(value),r=payload.record,b=r.binding;
   try{return await tx(check,async client=>{
    // Match the candidate journal's recovery/subject lock ordering and read the retention projection after acquiring them.
    await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended('meri_retention_recovery',0))");
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['meri_retention_subject:'+subjectKey({tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId})]);
    const state=(await client.query('SELECT owner_actor_id,state,ledger_sequence,entry_sha256,projection,projection_sha256 FROM meri_conversations.retention_subjects WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',
     [b.tenantId,b.conversationId])).rows;
    if(!Array.isArray(state)||state.length>1)fail('MEMORY_METADATA_REFUSED');
    if(state[0]){
     const subject=state[0],projection=subject.projection;
     if(subject.state!=='RELEASED'||subject.owner_actor_id!==b.actorId||projection?.ownerActorId!==b.actorId||
      projection.state!==subject.state||Number(subject.ledger_sequence)!==projection.ledgerSequence||
      subject.entry_sha256!==projection.entrySha256||canonicalSha256(projection)!==subject.projection_sha256)fail('MEMORY_METADATA_REFUSED');
    }
    check();
    const inserted=(await client.query(`INSERT INTO ${TABLE} (tenant_id,actor_id,proposal_id,command_id,idempotency_key,command_sha256,payload_sha256,payload,memory_conversation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING payload,payload_sha256`,
    [b.tenantId,b.actorId,r.proposalId,r.commandId,r.idempotencyKey,payload.commandSha256,canonicalSha256(payload),JSON.stringify(payload),b.conversationId])).rows;
    if(!Array.isArray(inserted)||inserted.length!==1||canonicalSha256(decoded(inserted[0]))!==canonicalSha256(payload))fail('MEMORY_METADATA_REFUSED');
    return payload;
   });}catch(error){throw metadataError(error,true);}
  },
  async read(value,check){
   const k=own(value,['tenantId','actorId','proposalId']);
   if(typeof k.tenantId!=='string'||!k.tenantId||typeof k.actorId!=='string'||!k.actorId||typeof k.proposalId!=='string'||!UUID.test(k.proposalId))
    throw metadataError(null,false);
   try{return await tx(check,async client=>{
    const rows=(await client.query(`SELECT payload,payload_sha256,payload_purged_at,memory_conversation_id FROM ${TABLE} WHERE tenant_id=$1 AND actor_id=$2 AND proposal_id=$3`,
     [k.tenantId,k.actorId,k.proposalId])).rows;
    if(!Array.isArray(rows)||rows.length>1)fail('MEMORY_METADATA_REFUSED');
    if(!rows.length)return null;
    // The identity and unique replay fences remain after conversation erasure. A tombstone is terminal, never prepared again.
    if(rows[0].payload===null){if(rows[0].payload_purged_at===null||rows[0].memory_conversation_id===null)fail('MEMORY_METADATA_REFUSED');return null;}
    const payload=decoded(rows[0]),b=payload.record.binding;
    if(b.tenantId!==k.tenantId||b.actorId!==k.actorId||b.conversationId!==rows[0].memory_conversation_id||
     payload.record.proposalId.toLowerCase()!==k.proposalId.toLowerCase()||rows[0].payload_purged_at!==null)fail('MEMORY_METADATA_REFUSED');
    return payload;
   },true);}catch(error){throw metadataError(error,false);}
  },
 });
}
