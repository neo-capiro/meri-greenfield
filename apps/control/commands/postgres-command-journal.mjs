/** Concrete borrowed-Pool command journal. No source-effect retries or migration. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {CommandCommitUncertain,data,deny,own} from './protocol.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
function key(value){
 const payload=data(value);own(payload,['proposal','context']);const c=payload.proposal.command;
 return {payload,tenant:c.binding.tenantId,actor:c.binding.actorId,idem:c.idempotencyKey,id:c.commandId.toLowerCase(),
  commandHash:canonicalSha256(c),proposalHash:canonicalSha256(payload.proposal),payloadHash:canonicalSha256(payload)};
}
function rowValue(value,k){
 const selected=own(value,['tenant_id','actor_id','idempotency_key','command_id','command_sha256','proposal_sha256','payload_sha256','payload','executor','state','outcome'],['created_at','updated_at']);
 const {created_at:ignoredCreated,updated_at:ignoredUpdated,...json}=selected;const r=data(json);
 validateShape('CommandExecutionRequest',r.executor);
 if(r.executor.commandSha256!==k.commandHash||r.executor.proposalId!==k.payload.proposal.proposalId||r.executor.idempotencyKey!==k.idem)deny('COMMAND_IDEMPOTENCY_CONFLICT');
 for(const key of ['tenantId','actorId','conversationId','runId'])if(r.executor.executorBinding[key]!==k.payload.proposal.command.binding[key])deny('COMMAND_IDEMPOTENCY_CONFLICT');
 if(r.tenant_id!==k.tenant||r.actor_id!==k.actor||r.idempotency_key!==k.idem||r.command_id!==k.id||
  r.command_sha256!==k.commandHash||r.proposal_sha256!==k.proposalHash||r.payload_sha256!==k.payloadHash||
  !same(r.payload,k.payload)||!['CLAIMED','UNKNOWN','OUTCOME'].includes(r.state)||
  (r.state==='OUTCOME')!==(r.outcome!==null))deny('COMMAND_IDEMPOTENCY_CONFLICT');
 return r;
}
export function createPostgresCommandJournal(options){
 const {pool}=own(options,['pool']);if(!pool||typeof pool.connect!=='function')deny('COMMAND_CONFIGURATION');
 async function transact(body,check=()=>{}){
  let client,begun=false,committing=false,primary,evict;
  try{
   check();client=await pool.connect();check();
   await client.query('BEGIN');begun=true;check();
   await client.query("SET LOCAL statement_timeout = '5000ms'");check();
   await client.query("SET LOCAL lock_timeout = '1000ms'");check();
   const q=async(text,values)=>{check();const r=await client.query(text,values);check();return r;};
   const result=await body(q);check();committing=true;await client.query('COMMIT');check();return result;
  }catch(error){
   primary=committing?new CommandCommitUncertain():error;
   if(committing||!begun)evict=error;
   if(begun&&!committing){try{await client.query('ROLLBACK');}catch(rollback){evict=rollback;}}
   throw primary;
  }finally{try{client?.release(evict);}catch{if(!primary)deny('COMMAND_CONNECTION_CLEANUP');}}
 }
 const select='SELECT * FROM public.meri_command_journal WHERE tenant_id=$1 AND actor_id=$2 AND (idempotency_key=$3 OR command_id=$4) FOR UPDATE';
 async function locked(q,k){const r=await q(select,[k.tenant,k.actor,k.idem,k.id]);if(r.rows.length!==1)deny('COMMAND_IDEMPOTENCY_CONFLICT');return rowValue(r.rows[0],k);}
 async function claim(payload,executor,check){
  const k=key(payload),e=data(executor);
  return transact(async q=>{
   const r=await q(`INSERT INTO public.meri_command_journal
    (tenant_id,actor_id,idempotency_key,command_id,command_sha256,proposal_sha256,payload_sha256,payload,executor,state)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,'CLAIMED') ON CONFLICT DO NOTHING RETURNING *`,
    [k.tenant,k.actor,k.idem,k.id,k.commandHash,k.proposalHash,k.payloadHash,JSON.stringify(k.payload),JSON.stringify(e)]);
   const row=r.rows.length===1?rowValue(r.rows[0],k):await locked(q,k);
   return data({claimed:r.rows.length===1,row});
  },check);
 }
 async function complete(payload,outcome,check){
  const k=key(payload),observation=data(outcome);
  return transact(async q=>{
   const row=await locked(q,k);
   if(row.state==='OUTCOME'){if(!same(row.outcome,observation))deny('COMMAND_OUTCOME_CONFLICT');return row;}
   if(row.state!=='CLAIMED')deny('COMMAND_OUTCOME_UNKNOWN');
   const r=await q("UPDATE public.meri_command_journal SET state='OUTCOME', outcome=$5::jsonb, updated_at=clock_timestamp() WHERE tenant_id=$1 AND actor_id=$2 AND idempotency_key=$3 AND command_id=$4 AND state='CLAIMED' RETURNING *",[k.tenant,k.actor,k.idem,k.id,JSON.stringify(observation)]);
   if(r.rows.length!==1)deny('COMMAND_OUTCOME_UNKNOWN');return rowValue(r.rows[0],k);
  },check);
 }
 async function markUnknown(payload,check){
  const k=key(payload);return transact(async q=>{
   const row=await locked(q,k);if(row.state!=='CLAIMED')return row;
   const r=await q("UPDATE public.meri_command_journal SET state='UNKNOWN', updated_at=clock_timestamp() WHERE tenant_id=$1 AND actor_id=$2 AND idempotency_key=$3 AND command_id=$4 AND state='CLAIMED' RETURNING *",[k.tenant,k.actor,k.idem,k.id]);
   if(r.rows.length!==1)deny('COMMAND_OUTCOME_UNKNOWN');return rowValue(r.rows[0],k);
  },check);
 }
 async function read(payload,check){const k=key(payload);return transact(async q=>{const r=await q(select,[k.tenant,k.actor,k.idem,k.id]);if(r.rows.length===0)return null;if(r.rows.length!==1)deny('COMMAND_IDEMPOTENCY_CONFLICT');return rowValue(r.rows[0],k);},check);}
 return Object.freeze({claim,complete,markUnknown,read});
}
