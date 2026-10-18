/** Durable single-use custody of Core routine cancellation proofs (migrations/0003_run_cancel_proofs.sql). `consume` inserts one
 * immutable row per (issuer, jti) and answers true only when THIS call inserted it. A conflict (replay, second target, concurrent
 * use) refuses REUSED; an unacknowledged COMMIT refuses UNKNOWN. Either way no effect may follow. No DDL, DELETE or UPDATE. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {transact,assertPool} from '../product-persistence/transaction.mjs';
import {productFailure} from '../product-access/errors.mjs';

const fault=code=>Object.assign(Error('SCHEDULE_RUN_CANCEL_PROOF_'+code),{code:'SCHEDULE_RUN_CANCEL_PROOF_'+code});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,HEX64=/^[a-f0-9]{64}$/u;
const ISSUER=/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$/u,KID=/^[A-Za-z0-9._-]{1,64}$/u;
const text=(value,max)=>typeof value==='string'&&value.length>=1&&value.length<=max;
export const RUN_CANCEL_PROOF_RELATION='meri_schedules.run_cancel_proofs';
const INSERT='INSERT INTO meri_schedules.run_cancel_proofs(issuer,key_id,token_id,tenant_id,owner_actor_id,schedule_id,intent_id,intent_sha256,decision_sha256,claims_sha256,proof_sha256,binding,binding_sha256,issued_at_s,expires_at_s) '+
 'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (issuer,token_id) DO NOTHING';
function row(value){
 let v;try{v=data(own(value,['issuer','keyId','tokenId','tenantId','ownerActorId','scheduleId','intentId','intentSha256','decisionSha256','claimsSha256','proofSha256','binding','issuedAtS','expiresAtS']));validateShape('RunBinding',v.binding);}catch{throw fault('REQUEST');}
 if(typeof v.issuer!=='string'||!ISSUER.test(v.issuer)||typeof v.keyId!=='string'||!KID.test(v.keyId)||[v.tokenId,v.scheduleId,v.intentId].some(id=>typeof id!=='string'||!UUID.test(id))||
  !text(v.tenantId,256)||!text(v.ownerActorId,256)||[v.intentSha256,v.decisionSha256,v.claimsSha256,v.proofSha256].some(d=>typeof d!=='string'||!HEX64.test(d))||
  v.binding.tenantId!==v.tenantId||v.binding.actorId!==v.ownerActorId||!Number.isSafeInteger(v.issuedAtS)||v.issuedAtS<0||!Number.isSafeInteger(v.expiresAtS)||v.expiresAtS<=v.issuedAtS||v.expiresAtS-v.issuedAtS>30)throw fault('REQUEST');
 return v;
}
export function createPostgresRunCancelProofLedger(configuration){
 const {pool}=own(configuration,['pool']);assertPool(pool);
 return Object.freeze({async consume(value,check=()=>{}){
  const v=row(value);if(typeof check!=='function')throw fault('REQUEST');
  let inserted;
  try{
   inserted=await transact(pool,async client=>{
    const result=await client.query(INSERT,[v.issuer,v.keyId,v.tokenId,v.tenantId,v.ownerActorId,v.scheduleId,v.intentId,v.intentSha256,v.decisionSha256,v.claimsSha256,v.proofSha256,v.binding,hash(v.binding),v.issuedAtS,v.expiresAtS]);check();
    if(!result||!Number.isSafeInteger(result.rowCount)||result.rowCount<0||result.rowCount>1)throw Error('unexpected row count');return result.rowCount;
   },{check,unavailable:'SCHEDULE_RUN_CANCEL_PROOF_UNAVAILABLE',uncertain:'SCHEDULE_RUN_CANCEL_PROOF_UNKNOWN'});
  }catch(error){throw productFailure(error)?.code==='SCHEDULE_RUN_CANCEL_PROOF_UNKNOWN'?fault('UNKNOWN'):fault('UNAVAILABLE');}
  if(inserted!==1)throw fault('REUSED');return true;
 }});
}
