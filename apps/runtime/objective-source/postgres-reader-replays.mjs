/** Default-off, tenant-bound durable `runOnce` for the signed Objective reader v2 gate (reader-gate.mjs `idempotency`), over
 * meri_objective_source.reader_replays (migration 0003). Borrowed pool only.
 *
 * Key: (issuer, subject, jti). The full gate identity (signed-token digest, route, body, source and custody digests, expiry)
 * and the source are bound at claim time; a reused jti with any other identity or source is a conflict, never a replay.
 *   1. claim  : one transaction inserts CLAIMED v1 (or reads the existing row) under the key's advisory lock.
 *   2. effect : runs outside any transaction, at most once per durable claim.
 *   3. commit : one transaction moves exactly this claim fence CLAIMED v1 -> COMMITTED v2 with the released value.
 * A COMMITTED identical replay returns the exact stored value as `replayed`; the gate then repeats its own fresh custody
 * checks. A CLAIMED row (effect failed, crashed or commit unacknowledged) is UNKNOWN forever: the effect is never rerun and
 * Core must use a new token. Lost acknowledgements are sticky in this instance. Rows are retained beyond token expiry; no
 * purge owner is allocated. */
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {readerLimits,readerPurposes} from '../../../packages/contracts/objective-reader-2/schema.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createObjectivePostgresTransactions,advisory} from './postgres-transaction.mjs';

const unavailable=()=>Object.assign(Error('OBJECTIVE_READER_REPLAY_UNAVAILABLE'),{code:'OBJECTIVE_READER_REPLAY_UNAVAILABLE'});
const unknown=()=>Object.assign(Error('OBJECTIVE_READER_REPLAY_UNKNOWN'),{code:'OBJECTIVE_READER_REPLAY_UNKNOWN'});
const conflictError=()=>Object.assign(Error('OBJECTIVE_READER_REPLAY_CONFLICT'),{code:'OBJECTIVE_READER_REPLAY_CONFLICT'});
const refuse=()=>{throw unavailable();};
const conflict=()=>{throw conflictError();};
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(v);
const jti=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
const text=(v,max)=>typeof v==='string'&&v.length>=1&&v.length<=max;
export const OBJECTIVE_READER_IDENTITY_KEYS=Object.freeze(['issuer','subject','audience','tokenId','signedTokenSha256','purpose','operation','phase','method','path','query',
 'bodySha256','generationJobId','sourceAdmissionSha256','sourceSha256','custodyIdentitySha256','expiresAtMs']);
const ROW=['issuer','subject','token_id','tenant_id','generation_job_id','purpose','identity','identity_sha256','source','source_sha256','signed_token_sha256',
 'token_expires_at_ms','state','claim_fence','version','value','value_sha256','claimed_at','committed_at'];
const COLUMNS=ROW.map(c=>['token_expires_at_ms','version'].includes(c)?`${c}::text AS ${c}`:c).join(',');
const SELECT='SELECT '+COLUMNS+' FROM meri_objective_source.reader_replays WHERE issuer=$1 AND subject=$2 AND token_id=$3';
const INSERT='INSERT INTO meri_objective_source.reader_replays(issuer,subject,token_id,tenant_id,generation_job_id,purpose,identity,identity_sha256,source,source_sha256,signed_token_sha256,token_expires_at_ms,state,claim_fence,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,\'CLAIMED\',$13,1) ON CONFLICT DO NOTHING RETURNING '+COLUMNS;
const COMMIT_CLAIM='UPDATE meri_objective_source.reader_replays SET state=\'COMMITTED\',version=2,value=$5,value_sha256=$6,committed_at=clock_timestamp() WHERE issuer=$1 AND subject=$2 AND token_id=$3 AND claim_fence=$4 AND state=\'CLAIMED\' AND version=1 RETURNING '+COLUMNS;
const maybe=rows=>{if(!Array.isArray(rows)||rows.length>1)refuse();return rows[0]??null;};

/** The gate's source: {generationJobId, binding, sourceAdmissionSha256}. */
export function assertObjectiveReaderSource(value){
 const s=data(own(value,['generationJobId','binding','sourceAdmissionSha256']));validateShape('RunBinding',s.binding);
 if(!uuid(s.generationJobId)||!digest(s.sourceAdmissionSha256))refuse();return s;
}
/** The gate's replay identity, bound to its exact source (reader-gate.mjs `identity`). */
export function assertObjectiveReaderIdentity(value,source){
 const i=data(own(value,OBJECTIVE_READER_IDENTITY_KEYS)),d=readerPurposes[i.purpose];
 if(!d||!Object.hasOwn(readerPurposes,i.purpose)||!text(i.issuer,256)||i.issuer.trim()!==i.issuer||i.subject!==d.subject||i.audience!==d.audience||!jti(i.tokenId)||
    i.operation!==d.operation||i.phase!==d.phase||i.method!=='POST'||i.path!==d.path||i.query!==''||
    !['signedTokenSha256','bodySha256','sourceAdmissionSha256','sourceSha256','custodyIdentitySha256'].every(k=>digest(i[k]))||
    !Number.isSafeInteger(i.expiresAtMs)||i.expiresAtMs<1||i.generationJobId!==source.generationJobId||i.sourceAdmissionSha256!==source.sourceAdmissionSha256||
    i.sourceSha256!==hash(source))refuse();
 return i;
}
function exact(value,minimum){
 if(typeof value==='string'){if(!/^(?:0|[1-9][0-9]*)$/u.test(value)||value.length>16)refuse();value=Number(value);}
 if(!Number.isSafeInteger(value)||value<minimum)refuse();return value;
}
function decode(row,{tenantId,identity,source}){
 let r,version,i;try{r=own(row,ROW);version=exact(r.version,1);i=assertObjectiveReaderIdentity(r.identity,assertObjectiveReaderSource(r.source));}catch{refuse();}
 if(r.tenant_id!==tenantId||r.source.binding.tenantId!==tenantId||r.issuer!==i.issuer||r.subject!==i.subject||r.token_id!==i.tokenId||r.purpose!==i.purpose||
    r.generation_job_id!==i.generationJobId||r.identity_sha256!==hash(i)||r.source_sha256!==hash(r.source)||r.signed_token_sha256!==i.signedTokenSha256||
    exact(r.token_expires_at_ms,1)!==i.expiresAtMs||!uuid(r.claim_fence))refuse();
 if(hash(i)!==hash(identity)||hash(r.source)!==hash(source))conflict();
 if(r.state==='CLAIMED'){if(version!==1||r.value!==null||r.value_sha256!==null||r.committed_at!==null)refuse();return {state:'CLAIMED',claimFence:r.claim_fence};}
 if(r.state!=='COMMITTED'||version!==2||!digest(r.value_sha256)||r.value===null||typeof r.value!=='object'||hash(r.value)!==r.value_sha256||r.committed_at===null)refuse();
 return {state:'COMMITTED',claimFence:r.claim_fence,value:data(r.value)};
}

export function createPostgresObjectiveReaderReplayStore(configuration={}){
 let enabled=false,tenantId,tx,allocateFence=randomUUID;
 try{
  const flag=configuration&&typeof configuration==='object'&&!types.isProxy(configuration)?Object.getOwnPropertyDescriptor(configuration,'enabled'):null;
  if(flag&&'value'in flag&&flag.value===true){
   const c=own(configuration,['enabled','pool','tenantId'],['now','maxRequestMs','allocateFence']);tenantId=c.tenantId;allocateFence=c.allocateFence??allocateFence;
   if(typeof tenantId!=='string'||!tenantId||tenantId.trim()!==tenantId||tenantId.length>128||typeof allocateFence!=='function'||types.isProxy(allocateFence))refuse();
   tx=createObjectivePostgresTransactions({connect:storageMethod(c.pool,'connect'),now:c.now??Date.now,maxRequestMs:c.maxRequestMs??3000,unavailable,unknown,semantic:['OBJECTIVE_READER_REPLAY_CONFLICT']});
   enabled=true;
  }
 }catch{enabled=false;}
 const uncertain=new Set();
 async function runOnce(value,effect){
  if(!enabled||typeof effect!=='function'||types.isProxy(effect))refuse();
  let v,source,identity;
  try{v=own(value,['identity','source'],['signal']);source=assertObjectiveReaderSource(v.source);identity=assertObjectiveReaderIdentity(v.identity,source);}catch{refuse();}
  if(source.binding.tenantId!==tenantId)refuse();
  const key=[identity.issuer,identity.subject,identity.tokenId],lock='meri_objective_source:reader-replay:'+hash(key),name=hash(key);
  const sticky=fn=>fn().catch(error=>{if(error?.code==='OBJECTIVE_READER_REPLAY_UNKNOWN')uncertain.add(name);throw error;});
  const claim=await sticky(()=>tx.operation(v.signal,life=>tx.transaction(life,true,async q=>{
   await advisory(q,lock);
   const prior=maybe((await q(SELECT,key)).rows);
   if(prior){const saved=decode(prior,{tenantId,identity,source});if(saved.state!=='COMMITTED')throw unknown();return {replayed:saved.value};}
   if(uncertain.has(name))throw unknown();
   const fence=allocateFence();if(!uuid(fence))refuse();
   const inserted=maybe((await q(INSERT,[...key,tenantId,identity.generationJobId,identity.purpose,identity,hash(identity),source,hash(source),identity.signedTokenSha256,identity.expiresAtMs,fence])).rows);
   if(!inserted)conflict();const saved=decode(inserted,{tenantId,identity,source});if(saved.state!=='CLAIMED'||saved.claimFence!==fence)refuse();
   return {fence};
  })));
  if(claim.replayed){uncertain.delete(name);return data({status:'replayed',value:claim.replayed});}
  // The durable claim is committed: from here every failure leaves the row CLAIMED (UNKNOWN) and is never retried.
  let released;
  try{const result=data(await effect());if(!result||typeof result!=='object'||Array.isArray(result))refuse();
   if(Buffer.byteLength(JSON.stringify(result),'utf8')>readerLimits.maxResponseBytes)refuse();released=result;}
  catch{uncertain.add(name);throw unknown();}
  // The effect has run: any failure to settle its own claim is UNKNOWN, whatever the transaction reports.
  const committed=await tx.operation(v.signal,life=>tx.transaction(life,true,async q=>{
   await advisory(q,lock);
   const row=maybe((await q(COMMIT_CLAIM,[...key,claim.fence,released,hash(released)])).rows);if(!row)throw unknown();
   const saved=decode(row,{tenantId,identity,source});if(saved.state!=='COMMITTED'||saved.claimFence!==claim.fence||hash(saved.value)!==hash(released))refuse();
   return saved.value;
  })).catch(()=>{uncertain.add(name);throw unknown();});
  uncertain.delete(name);return data({status:'executed',value:committed});
 }
 return Object.freeze({available:()=>enabled,runOnce});
}
