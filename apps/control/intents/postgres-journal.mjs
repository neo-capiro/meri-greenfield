/** Canonical createIntentJournal store adapter. Sole table meri_intents.preparations; no public fallback or DDL execution.
 * Parent released exact DDL source authoring in central allocation 0b0b7abd; SQL execution/integration qualification remain pending. */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
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
export function createPostgresIntentJournalStore({pool}){
 assertPool(pool);
 async function tx(signal,body){
  nativeSignal(signal);
  try{return await transact(pool,body,{check:()=>{if(signal?.aborted)refuse('CANCELLED');},unavailable:'INTENT_JOURNAL_UNAVAILABLE',uncertain:'INTENT_JOURNAL_UNKNOWN'});}
  catch(error){const code=productFailure(error)?.code;throw intentFault(code==='CANCELLED'?'CANCELLED':code==='INTENT_JOURNAL_UNAVAILABLE'?'UNAVAILABLE':'UNKNOWN');}
 }
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
