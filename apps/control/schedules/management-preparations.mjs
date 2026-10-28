/** Schedule-owned immutable proposal custody. Every release/approval still needs fresh current authority. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {scheduleToolValidators as validators,validateShape as toolShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertPool,transact} from '../product-persistence/transaction.mjs';
import {ProductError,productFailure} from '../product-access/errors.mjs';
const table='meri_schedules.management_preparations',columns='tenant_id,actor_id,scope_sha256,request_id,claim_id,record,record_sha256,state,proposal_id,outcome';
/** MR-04 renewal: the one non-cancel operation this journal holds. A renewal row keeps the cancel row's closed key set
 *  and its append-once/terminal-only discipline, and it allocates no proposal. */
const RENEWAL_OPERATION='renew_routine_consent';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,hex=/^[a-f0-9]{64}$/u,same=(a,b)=>hash(a)===hash(b);
const deny=(code='STALE',outcome='NOT_DISPATCHED')=>{throw Object.assign(new ProductError('ROUTINES_'+code,outcome),{code:'ROUTINES_'+code,outcome});};
function key(value){const k=data(own(value,['tenantId','actorId','scopeSha256','requestId']));validateShape('Identity',{tenantId:k.tenantId,actorId:k.actorId});if(!hex.test(k.scopeSha256)||typeof k.requestId!=='string'||!/^[A-Za-z0-9._-]{1,128}$/u.test(k.requestId))deny();return k;}
const params=k=>[k.tenantId,k.actorId,k.scopeSha256,k.requestId];
/** The exact current client scope carried by either record kind. A cancel preparation carries exactly its ONE current
 *  client scope, unchanged. A renewal carries the FULL original scope set of the immutable intent — the published
 *  ScheduleProjection admits 1..100 unique scopes and Core re-decides that entire set — so its length is the intent's
 *  own and is never truncated to the selected anchor. The current anchor scope must be one MEMBER of that set, which is
 *  how the fresh current authority is tied to the full set; the journal identity stays the current selected anchor. */
function scopeOf(r,k){
 const scopes=Array.isArray(r.scopes)?r.scopes:null;
 if(scopes===null||scopes.length<1||scopes.length>100)deny();
 if(r.operation!==RENEWAL_OPERATION&&scopes.length!==1)deny();
 const anchor=r.selectedClientId===null?'private-user':'client',anchorId=r.selectedClientId??k.actorId;
 const seen=new Set();let anchored=false;
 for(const scope of scopes){
  validateShape('Scope',scope);
  if(scope.tenantId!==k.tenantId)deny();
  const digest=hash(scope);if(seen.has(digest))deny();seen.add(digest);
  if(scope.kind===anchor&&scope.resourceId===anchorId)anchored=true;
 }
 if(!anchored)deny();
 if(k.scopeSha256!==hash({selectedClientId:r.selectedClientId}))deny();
}
function record(value,k){
 const r=data(own(value,['operation','request','requestSha256','selectedClientId','scopes','versions']));
 if(r.operation==='cancel_scheduled_task'){
  const request=validators.normalizeRequest(r.operation,r.request);validateShape('RuntimeVersions',r.versions);
  if(!same(request,r.request)||request.running!=='leave'||request.runs.length||r.requestSha256!==hash({operation:r.operation,request}))deny();
  scopeOf(r,k);return r;
 }
 // MR-04 renewal. The durable decision is exactly this closed request: the reviewed digest, the decision and the
 // decision instant are immutable in the row, so an exact retry re-presents the FIRST stored approval byte for byte.
 // `versions` is the attended session's own current RuntimeVersions object when it carries one, and null when it does
 // not; a present object is validated here exactly as the cancel record validates it.
 if(r.operation!==RENEWAL_OPERATION)deny();
 if(r.versions!==null)validateShape('RuntimeVersions',r.versions);
 const request=data(own(r.request,['scheduleId','reviewSha256','decision','decidedAtMs','expiresAtMs']));
 if(!uuid.test(request.scheduleId)||!hex.test(request.reviewSha256)||request.decision!=='approved'||
  !Number.isSafeInteger(request.decidedAtMs)||request.decidedAtMs<1||!Number.isSafeInteger(request.expiresAtMs)||request.expiresAtMs<=request.decidedAtMs||
  r.requestSha256!==hash({operation:r.operation,request}))deny();
 scopeOf(r,k);return {...r,request};
}
/** The STABLE identity of one request slot: a renewal's reviewed decision WITHOUT any clock value, so an identical
 *  retry at a later clock presents the same identity and reads back the first durable decision instead of being
 *  refused for a re-minted timestamp. A cancel keeps its own request digest, unchanged. */
const identity=r=>r.operation===RENEWAL_OPERATION?hash({operation:r.operation,request:{scheduleId:r.request.scheduleId,reviewSha256:r.request.reviewSha256,decision:r.request.decision}}):r.requestSha256;
function outcome(state,value,r,k){
 if(state==='PENDING'){if(value!==null)deny();return null;}
 // A renewal settles as {status,window} and never as {status,proposal}: the closed key set follows the operation.
 const o=data(own(value,state==='FAILED'?['code']:(r.operation===RENEWAL_OPERATION?['status','window']:['status','proposal'])));
 if(state==='FAILED'){if(!['REFUSED','UNAVAILABLE','INVALID_REQUEST','STALE'].includes(o.code))deny();return o;}
 if(state!=='PREPARED')deny();
 // MR-04 renewal: the settled outcome is the window Core's own row holds for this exact decision, never a proposal.
 // A renewal allocates no proposal id, so the row's proposal_id stays null and the trigger/CHECK keep it terminal.
 if(r.operation===RENEWAL_OPERATION){
  const w=data(own(o.window,['state','generation','policyRevision','issuedAtMs','expiresAtMs','observedAtMs','idempotent']));
  if(o.status!=='renewed'||!['active','expired'].includes(w.state)||!Number.isSafeInteger(w.generation)||w.generation<1||
   typeof w.policyRevision!=='string'||!w.policyRevision||!Number.isSafeInteger(w.issuedAtMs)||!Number.isSafeInteger(w.expiresAtMs)||w.expiresAtMs<=w.issuedAtMs||
   !Number.isSafeInteger(w.observedAtMs)||typeof w.idempotent!=='boolean'||(w.state==='active')!==(w.expiresAtMs>w.observedAtMs))deny();
  return o;
 }
 if(o.status!=='approval_required')deny();const p=toolShape('ScheduleMutationOutput',o.proposal);
 const scopesMatch=r.selectedClientId===null?same(p.projection.scopes,r.scopes):p.projection.scopes.some(scope=>same(scope,r.scopes[0]))&&p.projection.scopes.every(scope=>scope.tenantId===k.tenantId&&scope.policyRevision===r.scopes[0].policyRevision&&(scope.kind!=='private-user'||scope.resourceId===k.actorId));
 if(p.status!=='approval_required'||p.operation!==r.operation||!same(p.projection.owner,{tenantId:k.tenantId,actorId:k.actorId})||!scopesMatch||p.projection.scheduleId!==r.request.scheduleId||!same(p.cancel,{mode:r.request.mode,note:r.request.note,running:'leave',runs:[]}))deny();return o;
}
function entry(row){if(!row)deny();const k=key({tenantId:row.tenant_id,actorId:row.actor_id,scopeSha256:row.scope_sha256,requestId:row.request_id}),r=record(row.record,k),o=outcome(row.state,row.outcome,r,k);
 if(!uuid.test(row.claim_id)||row.record_sha256!==hash(r)||row.proposal_id!==(row.state==='PREPARED'?(o.proposal?.proposalId??null):null))deny();return data({key:k,claimId:row.claim_id,record:r,state:row.state,outcome:o});}
export function createRoutineManagementPreparations({pool}){
 assertPool(pool);
 async function tx(body,check,readOnly=false){try{return await transact(pool,body,{check,readOnly,unavailable:'ROUTINES_UNAVAILABLE',uncertain:'ROUTINES_UNKNOWN'});}catch(error){if(error?.code?.startsWith('ROUTINES_'))throw error;const code=productFailure(error)?.code;deny(code==='ROUTINES_UNAVAILABLE'?'UNAVAILABLE':'UNKNOWN',code==='ROUTINES_UNAVAILABLE'?'NOT_DISPATCHED':'UNKNOWN');}}
 return Object.freeze({
  async claim(value,check){const v=own(value,['key','record','claimId']),k=key(v.key),r=record(v.record,k);if(!uuid.test(v.claimId))deny();
   return tx(async client=>{const inserted=await client.query(`INSERT INTO ${table}(tenant_id,actor_id,scope_sha256,request_id,claim_id,record,record_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING') ON CONFLICT DO NOTHING`,[...params(k),v.claimId,r,hash(r)]);check();
    const result=await client.query(`SELECT ${columns} FROM ${table} WHERE tenant_id=$1 AND actor_id=$2 AND scope_sha256=$3 AND request_id=$4`,params(k));check();const row=entry(result.rows[0]);
    // A replayed attempt presents the STABLE identity of the slot, never a clock-bearing digest of its own new bytes:
    // an identical retry therefore reads back the first durable decision instead of being refused for re-minting it.
    if(identity(row.record)!==identity(r))deny();return {claimed:inserted.rowCount===1,row};},check);
  },
  async settle(value,check){const v=own(value,['key','claimId','state','outcome']),k=key(v.key);if(!uuid.test(v.claimId)||!['PREPARED','FAILED'].includes(v.state))deny();
   return tx(async client=>{const selected=await client.query(`SELECT ${columns} FROM ${table} WHERE tenant_id=$1 AND actor_id=$2 AND scope_sha256=$3 AND request_id=$4 FOR UPDATE`,params(k));check();const old=entry(selected.rows[0]);if(old.claimId!==v.claimId)deny();const out=outcome(v.state,v.outcome,old.record,k);
    if(old.state!=='PENDING'){if(old.state!==v.state||!same(old.outcome,out))deny();return old;}
    const changed=await client.query(`UPDATE ${table} SET state=$5,proposal_id=$6,outcome=$7,settled_at=clock_timestamp() WHERE tenant_id=$1 AND actor_id=$2 AND scope_sha256=$3 AND request_id=$4 RETURNING ${columns}`,[...params(k),v.state,v.state==='PREPARED'?(out.proposal?.proposalId??null):null,out]);check();return entry(changed.rows[0]);},check);
  },
  async readProposal(value,check){const v=data(own(value,['tenantId','actorId','scopeSha256','proposalId']));validateShape('Identity',{tenantId:v.tenantId,actorId:v.actorId});if(!hex.test(v.scopeSha256)||!uuid.test(v.proposalId))deny();
   return tx(async client=>{const result=await client.query(`SELECT ${columns} FROM ${table} WHERE tenant_id=$1 AND actor_id=$2 AND scope_sha256=$3 AND proposal_id=$4`,[v.tenantId,v.actorId,v.scopeSha256,v.proposalId]);check();return result.rows.length?entry(result.rows[0]):null;},check,true);
  },
 });
}
