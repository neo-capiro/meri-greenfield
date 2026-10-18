/** Canonical createIntentJournal store adapter. Sole table meri_intents.preparations; no public fallback or DDL execution.
 * Parent released exact DDL source authoring in central allocation 0b0b7abd; SQL execution/integration qualification remain pending. */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {validateShape as validateToolShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertPool,transact} from '../product-persistence/transaction.mjs';
import {refuse,productFailure} from '../product-access/errors.mjs';
import {intentFault,INTENT_FAILURE_CODES} from './faults.mjs';
const TABLE='meri_intents.preparations',COLUMNS='record,record_sha256,state,outcome';
const states=['PENDING','PREPARED','FAILED','UNKNOWN'],digest=/^[a-f0-9]{64}$/u;
function key(raw){
 const k=data(own(raw,['tenantId','actorId','conversationId','deliveryId']));validateShape('Identity',{tenantId:k.tenantId,actorId:k.actorId});
 if(typeof k.conversationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(k.conversationId)||typeof k.deliveryId!=='string'||!/^sdk:[a-f0-9]{64}$/u.test(k.deliveryId))refuse('INTENT_JOURNAL_STATE');
 return [k.tenantId,k.actorId,k.conversationId,k.deliveryId];
}
function record(raw){
 const r=data(own(raw,['operation','argumentsSha256']));own(r.operation,['id','version']);
 if(typeof r.operation.id!=='string'||!/^[a-z][a-z_]{0,62}$/u.test(r.operation.id)||r.operation.version!=='0.2.0'||typeof r.argumentsSha256!=='string'||!digest.test(r.argumentsSha256))refuse('INTENT_JOURNAL_STATE');return r;
}
function outcome(state,raw){
 if(!states.includes(state))refuse('INTENT_JOURNAL_STATE');
 if(state==='PENDING'||state==='UNKNOWN'){if(raw!==null)refuse('INTENT_JOURNAL_STATE');return null;}
 const o=data(own(raw,state==='FAILED'?['code']:['result'],state==='PREPARED'?['release']:[]));
 if(state==='FAILED'&&!INTENT_FAILURE_CODES.includes(o.code))refuse('INTENT_JOURNAL_STATE');
 if(state==='PREPARED'&&(o.result===null||typeof o.result!=='object'||Array.isArray(o.result)))refuse('INTENT_JOURNAL_STATE');
 if(o.release!==undefined){const r=own(o.release,['binding','scopes','expiresAtMs']);validateShape('RunBinding',r.binding);
  if(!Array.isArray(r.scopes)||!r.scopes.length||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<1)refuse('INTENT_JOURNAL_STATE');
  for(const s of r.scopes){validateShape('Scope',s);if(s.tenantId!==r.binding.tenantId)refuse('INTENT_JOURNAL_STATE');}}
 return o;
}
function entry(row){
 if(!row)refuse('INTENT_JOURNAL_STATE');const r=record(row.record);
 if(row.record_sha256!==hash(r))refuse('INTENT_JOURNAL_STATE');return data({record:r,state:row.state,outcome:outcome(row.state,row.outcome)});
}
function journalTransaction(pool){
 assertPool(pool);
 return async function tx(signal,body,{readOnly=false}={}){
  nativeSignal(signal);
  const check=()=>{if(signal?.aborted)refuse('CANCELLED');};
  try{
   const result=await transact(pool,body,{check,readOnly,unavailable:'INTENT_JOURNAL_UNAVAILABLE',uncertain:'INTENT_JOURNAL_UNKNOWN'});
   if(readOnly)check();return result;
  }
  catch(error){const code=productFailure(error)?.code;throw intentFault(code==='CANCELLED'?'CANCELLED':code==='INTENT_JOURNAL_UNAVAILABLE'?'UNAVAILABLE':'UNKNOWN');}
 };
}
export function createPostgresIntentJournalStore({pool}){
 const tx=journalTransaction(pool);
 return Object.freeze({
  async claim({key:rawKey,record:rawRecord,signal}){
   const params=key(rawKey),r=record(rawRecord),sha=hash(r);
   return tx(signal,async client=>{
    const inserted=(await client.query(`INSERT INTO ${TABLE}(tenant_id,actor_id,conversation_id,delivery_id,record,record_sha256,state) VALUES($1,$2,$3,$4,$5::jsonb,$6,'PENDING') ON CONFLICT (tenant_id,actor_id,conversation_id,delivery_id) DO NOTHING RETURNING ${COLUMNS}`,[...params,JSON.stringify(r),sha])).rows;
    if(inserted.length===1){const e=entry(inserted[0]);if(e.state!=='PENDING'||hash(e.record)!==sha)refuse('INTENT_JOURNAL_STATE');return {claimed:true};}
    if(inserted.length!==0)refuse('INTENT_JOURNAL_STATE');
    const rows=(await client.query(`SELECT ${COLUMNS} FROM ${TABLE} WHERE tenant_id=$1 AND actor_id=$2 AND conversation_id=$3 AND delivery_id=$4`,params)).rows;
    if(rows.length!==1)refuse('INTENT_JOURNAL_STATE');return {claimed:false,entry:entry(rows[0])};
   });
  },
  /** One delivery of this tenant/actor/conversation, or null. Read-only; never claims. */
  async read({key:rawKey,signal}){
   const params=key(rawKey);
   return tx(signal,async client=>{
    const rows=(await client.query(`SELECT ${COLUMNS} FROM ${TABLE} WHERE tenant_id=$1 AND actor_id=$2 AND conversation_id=$3 AND delivery_id=$4`,params)).rows;
    if(rows.length>1)refuse('INTENT_JOURNAL_STATE');return rows.length===0?null:entry(rows[0]);
   });
  },
  /** One conversation's deliveries in creation order (keyset after an existing delivery), at most `limit` (1..50). Read-only. */
  async list({conversation:rawConversation,after=null,limit,signal}){
   const [tenantId,actorId,conversationId]=key({...data(own(rawConversation,['tenantId','actorId','conversationId'])),deliveryId:'sdk:'+'0'.repeat(64)});
   if(after!==null&&(typeof after!=='string'||!/^sdk:[a-f0-9]{64}$/u.test(after))||!Number.isSafeInteger(limit)||limit<1||limit>50)refuse('INTENT_JOURNAL_STATE');
   return tx(signal,async client=>{
    const scope='tenant_id=$1 AND actor_id=$2 AND conversation_id=$3';
    if(after!==null&&(await client.query(`SELECT delivery_id FROM ${TABLE} WHERE ${scope} AND delivery_id=$4`,[tenantId,actorId,conversationId,after])).rows.length!==1)refuse('INTENT_JOURNAL_CURSOR');
    const cursor=after===null?'':` AND (created_at,delivery_id) > (SELECT created_at,delivery_id FROM ${TABLE} WHERE ${scope} AND delivery_id=$4)`;
    const rows=(await client.query(`SELECT delivery_id,created_at,${COLUMNS} FROM ${TABLE} WHERE ${scope}${cursor} ORDER BY created_at,delivery_id LIMIT ${limit+1}`,
     after===null?[tenantId,actorId,conversationId]:[tenantId,actorId,conversationId,after])).rows;
    const page=rows.slice(0,limit).map(row=>{
     const created=row.created_at instanceof Date?row.created_at:new Date(row.created_at);
     if(typeof row.delivery_id!=='string'||!/^sdk:[a-f0-9]{64}$/u.test(row.delivery_id)||!Number.isFinite(created.getTime()))refuse('INTENT_JOURNAL_STATE');
     return data({deliveryId:row.delivery_id,createdAt:created.toISOString(),...entry(row)});
    });
    return data({entries:page,next:rows.length>limit?page.at(-1).deliveryId:null});
   });
  },
  async settle({key:rawKey,record:rawRecord,state,outcome:rawOutcome,signal}){
   const params=key(rawKey),r=record(rawRecord);if(state==='PENDING')refuse('INTENT_JOURNAL_STATE');const o=outcome(state,rawOutcome);
   if(state==='PREPARED'&&o.release===undefined)refuse('INTENT_JOURNAL_STATE');
   return tx(signal,async client=>{
    const rows=(await client.query(`UPDATE ${TABLE} SET state=$6,outcome=$7::jsonb,settled_at=clock_timestamp() WHERE tenant_id=$1 AND actor_id=$2 AND conversation_id=$3 AND delivery_id=$4 AND record_sha256=$5 AND state='PENDING' RETURNING ${COLUMNS}`,[...params,hash(r),state,o===null?null:JSON.stringify(o)])).rows;
    if(rows.length!==1)refuse('INTENT_JOURNAL_STATE');return entry(rows[0]);
   });
  },
 });
}

function preparedSchedule(raw,s,instructionsOnly){
 try{
  const row=data(raw),storedKey=data({tenantId:row.tenant_id,actorId:row.actor_id,conversationId:row.conversation_id,deliveryId:row.delivery_id});key(storedKey);
  const retained=entry(row);
  if(storedKey.tenantId!==s.tenantId||retained.state!=='PREPARED')refuse('INTENT_JOURNAL_STATE');
  const custody=own(retained.outcome,['result','release']),result=own(custody.result,['status','proposal']);
  const proposal=validateToolShape('ScheduleMutationOutput',result.proposal);
  const operations=instructionsOnly?['schedule_task','update_scheduled_task']:['schedule_task','update_scheduled_task','cancel_scheduled_task'];
  if(result.status!=='approval_required'||proposal.status!=='approval_required'||!operations.includes(proposal.operation)||retained.record.operation.id!==proposal.operation||proposal.proposalId!==s.proposalId||proposal.intentSha256!==s.intentSha256||proposal.projection.owner.tenantId!==s.tenantId)refuse('INTENT_JOURNAL_STATE');
  if(custody.release.binding.tenantId!==storedKey.tenantId||custody.release.binding.actorId!==storedKey.actorId||custody.release.binding.conversationId!==storedKey.conversationId)refuse('INTENT_JOURNAL_STATE');
  const originalScopes=new Set(custody.release.scopes.map(hash)),proposalScopes=proposal.projection.scopes.map(hash);
  if(custody.release.scopes.length>100||originalScopes.size!==custody.release.scopes.length||!proposalScopes.length||proposalScopes.length>100||new Set(proposalScopes).size!==proposalScopes.length||proposal.projection.scopes.some(scope=>scope.tenantId!==s.tenantId)||proposalScopes.some(scope=>!originalScopes.has(scope)))refuse('INTENT_JOURNAL_STATE');
  return data({key:storedKey,...retained});
 }catch{refuse('INTENT_JOURNAL_STATE');}
}

/** Read-only custody facet over the same canonical table. PREPARED is retained proposal text, never firing authority.
 * Select every row for the tenant/proposal before checking its hash/state/operation: ambiguity or corrupt custody cannot be
 * hidden by a narrower SQL filter. Original release expiry is historical evidence, not a capability renewed by this read. */
function scheduleReader(pool,instructionsOnly){
 const tx=journalTransaction(pool);
 return Object.freeze({async readPreparedSchedule(selection){
  const {signal,...raw}=own(selection,['tenantId','proposalId','intentSha256'],['signal']),s=data(raw);nativeSignal(signal);
  if(typeof s.tenantId!=='string'||!s.tenantId||s.tenantId.length>128||typeof s.proposalId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(s.proposalId)||typeof s.intentSha256!=='string'||!digest.test(s.intentSha256))throw intentFault('INVALID_ARGUMENTS');
  return tx(signal,async client=>{
   const rows=(await client.query(`SELECT tenant_id,actor_id,conversation_id,delivery_id,${COLUMNS} FROM ${TABLE} WHERE tenant_id=$1 AND outcome->'result'->'proposal'->>'proposalId'=$2 LIMIT 2`,[s.tenantId,s.proposalId])).rows;
   if(!Array.isArray(rows)||rows.length>1)refuse('INTENT_JOURNAL_STATE');
   if(rows.length===0)return null;
   return preparedSchedule(rows[0],s,instructionsOnly);
  },{readOnly:true});
 }});
}
export function createPostgresPreparedScheduleReader({pool}){return scheduleReader(pool,true);}
/** Human approval reads all canonical schedule proposals, including cancellation. It confers no approval or firing authority. */
export function createPostgresScheduleProposalReader({pool}){
 const reader=scheduleReader(pool,false);return Object.freeze({readProposal:reader.readPreparedSchedule});
}
