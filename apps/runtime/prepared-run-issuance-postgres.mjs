/** PostgreSQL adapter for the durable issuance store port (S1) over migration meri_conversations 0011 (`run_issuances`). Same contract
 * as the disposable in-process adapter: `claim` is an atomic absent-row insert keyed by the canonical issuance key with a unique
 * (tenant, conversation, run) binding, carrying a durable claim fence; `complete` moves CLAIMED to ISSUED exactly once (optionally
 * fenced to the claimer) with the grant id, capability digest and protected opaque-material reference; `bindFacts` is an immutable
 * compare-or-set; every update is a compare-and-set on `version` that the trigger also enforces; `read` never answers ABSENT for a
 * key that was ever claimed. No raw credential or capability value is accepted, stored or returned. Borrowed pg-compatible pool. */
import {randomUUID} from 'node:crypto';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
const fail=(code,cause)=>{throw Object.assign(Error('ISSUANCE_STORE_'+code),{code:'ISSUANCE_STORE_'+code,...(cause?{cause}:{})});};
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
const intentHash=r=>hash({binding:r.binding,requestSha256:r.requestSha256,expiresAtMs:r.expiresAtMs});
const COLUMNS='issuance_key,binding,request_sha256,expires_at_ms::text AS expires_at_ms,state,claim_fence,version::text AS version,grant_id,capability_sha256,material_ref,facts_sha256,claimed_at,issued_at';
function rowOf(r){if(!r)return null;const row={state:r.state,issuanceKey:r.issuance_key,binding:r.binding,requestSha256:r.request_sha256,expiresAtMs:Number(r.expires_at_ms),claimFence:r.claim_fence,version:Number(r.version),claimedAt:new Date(r.claimed_at).getTime()};
 if(hash(row.binding)!==row.issuanceKey||!Number.isSafeInteger(row.expiresAtMs)||!Number.isSafeInteger(row.version))fail('CORRUPT');
 if(r.state==='ISSUED'){Object.assign(row,{grantId:r.grant_id,capabilitySha256:r.capability_sha256,materialRef:r.material_ref,issuedAt:new Date(r.issued_at).getTime()});if(r.facts_sha256!==null)row.factsSha256=r.facts_sha256;}
 return row;}
export function createPostgresIssuanceStore({pool}){
 if(typeof pool?.query!=='function')fail('CONFIGURATION');
 const query=async(text,args)=>{try{return await pool.query(text,args);}catch(error){if(error?.code&&String(error.code).startsWith('ISSUANCE_STORE_'))throw error;fail('UNAVAILABLE',error);}};
 const readRow=async issuanceKey=>rowOf((await query(`SELECT ${COLUMNS} FROM meri_conversations.run_issuances WHERE issuance_key=$1`,[issuanceKey])).rows[0]??null);
 async function read({issuanceKey}){if(!hex64(issuanceKey))fail('INVALID');return readRow(issuanceKey);}
 /** Atomic absent-row claim: the insert either creates the single row for this key (fresh, with this claimer's fence) or finds the
  * existing one, whose intent must be identical; a different binding for the same run collides on the unique run binding. */
 async function claim(intent){const i=data(own(intent,['issuanceKey','binding','requestSha256','expiresAtMs']));
  if(!hex64(i.issuanceKey)||!i.binding||typeof i.binding!=='object'||hash(i.binding)!==i.issuanceKey||!hex64(i.requestSha256)||!Number.isSafeInteger(i.expiresAtMs)||i.expiresAtMs<1)fail('INVALID');
  const b=i.binding;if(typeof b.tenantId!=='string'||!b.tenantId||!uuid(b.conversationId)||!uuid(b.runId))fail('INVALID');
  const fence=randomUUID();let inserted;
  try{inserted=await pool.query(`INSERT INTO meri_conversations.run_issuances(issuance_key,tenant_id,conversation_id,run_id,binding,binding_sha256,request_sha256,expires_at_ms,state,claim_fence) VALUES($1,$2,$3,$4,$5,$1,$6,$7,'CLAIMED',$8) ON CONFLICT (issuance_key) DO NOTHING RETURNING ${COLUMNS}`,[i.issuanceKey,b.tenantId,b.conversationId,b.runId,b,i.requestSha256,i.expiresAtMs,fence]);}
  catch(error){if(error?.code==='23505')fail('INTENT_CONFLICT',error);fail('UNAVAILABLE',error);}
  if(inserted.rows[0])return {...rowOf(inserted.rows[0]),fresh:true};
  const existing=await readRow(i.issuanceKey);if(!existing)fail('UNAVAILABLE');if(intentHash(existing)!==intentHash(i))fail('INTENT_CONFLICT');return existing;}
 /** CLAIMED to ISSUED exactly once; with `claimFence` the row must still carry the caller's claim. A replay with the same identity returns the row. */
 async function complete(value){const v=data(own(value,['issuanceKey','grantId','capabilitySha256','materialRef'],['claimFence']));
  if(!hex64(v.issuanceKey)||!uuid(v.grantId)||!hex64(v.capabilitySha256)||typeof v.materialRef!=='string'||v.materialRef.length<1||v.materialRef.length>1024||v.claimFence!==undefined&&!uuid(v.claimFence))fail('INVALID');
  const current=await readRow(v.issuanceKey);if(!current)fail('NOT_CLAIMED');
  if(current.state==='ISSUED'){if(current.grantId!==v.grantId||current.capabilitySha256!==v.capabilitySha256||current.materialRef!==v.materialRef)fail('ISSUED_CONFLICT');return current;}
  if(v.claimFence!==undefined&&current.claimFence!==v.claimFence)fail('CLAIM_FENCED');
  const r=await query(`UPDATE meri_conversations.run_issuances SET state='ISSUED',grant_id=$2,capability_sha256=$3,material_ref=$4,issued_at=now(),version=version+1 WHERE issuance_key=$1 AND state='CLAIMED' AND version=$5 RETURNING ${COLUMNS}`,[v.issuanceKey,v.grantId,v.capabilitySha256,v.materialRef,current.version]);
  if(r.rows[0])return rowOf(r.rows[0]);
  const after=await readRow(v.issuanceKey);if(after?.state==='ISSUED'){if(after.grantId!==v.grantId||after.capabilitySha256!==v.capabilitySha256||after.materialRef!==v.materialRef)fail('ISSUED_CONFLICT');return after;}fail('UNAVAILABLE');}
 /** Immutable compare-or-set of the facts hash on an ISSUED row. */
 async function bindFacts(value){const v=data(own(value,['issuanceKey','factsSha256']));if(!hex64(v.issuanceKey)||!hex64(v.factsSha256))fail('INVALID');
  const current=await readRow(v.issuanceKey);if(!current||current.state!=='ISSUED')fail('NOT_ISSUED');if(current.factsSha256!==undefined){if(current.factsSha256!==v.factsSha256)fail('FACTS_CONFLICT');return current;}
  const r=await query(`UPDATE meri_conversations.run_issuances SET facts_sha256=$2,version=version+1 WHERE issuance_key=$1 AND state='ISSUED' AND facts_sha256 IS NULL AND version=$3 RETURNING ${COLUMNS}`,[v.issuanceKey,v.factsSha256,current.version]);
  if(r.rows[0])return rowOf(r.rows[0]);
  const after=await readRow(v.issuanceKey);if(after?.state==='ISSUED'&&after.factsSha256===v.factsSha256)return after;if(after?.factsSha256!==undefined)fail('FACTS_CONFLICT');fail('UNAVAILABLE');}
 async function materialRef({issuanceKey}){const r=await read({issuanceKey});if(!r||r.state!=='ISSUED')fail('NOT_ISSUED');return r.materialRef;}
 return Object.freeze({read,claim,complete,bindFacts,materialRef});
}
