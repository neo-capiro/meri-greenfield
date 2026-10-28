/** Schedule-owned immutable proposal custody. Every release/approval still needs fresh current authority. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {scheduleToolValidators as validators,validateShape as toolShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertPool,transact} from '../product-persistence/transaction.mjs';
import {ProductError,productFailure} from '../product-access/errors.mjs';
const table='meri_schedules.management_preparations',columns='tenant_id,actor_id,scope_sha256,request_id,claim_id,record,record_sha256,state,proposal_id,outcome';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,hex=/^[a-f0-9]{64}$/u,same=(a,b)=>hash(a)===hash(b);
const deny=(code='STALE',outcome='NOT_DISPATCHED')=>{throw Object.assign(new ProductError('ROUTINES_'+code,outcome),{code:'ROUTINES_'+code,outcome});};
function key(value){const k=data(own(value,['tenantId','actorId','scopeSha256','requestId']));validateShape('Identity',{tenantId:k.tenantId,actorId:k.actorId});if(!hex.test(k.scopeSha256)||typeof k.requestId!=='string'||!/^[A-Za-z0-9._-]{1,128}$/u.test(k.requestId))deny();return k;}
const params=k=>[k.tenantId,k.actorId,k.scopeSha256,k.requestId];
function record(value,k){
 const r=data(own(value,['operation','request','requestSha256','selectedClientId','scopes','versions']));
 if(r.operation!=='cancel_scheduled_task')deny();const request=validators.normalizeRequest(r.operation,r.request);validateShape('RuntimeVersions',r.versions);
 if(!same(request,r.request)||request.running!=='leave'||request.runs.length||r.requestSha256!==hash({operation:r.operation,request})||!Array.isArray(r.scopes)||r.scopes.length!==1)deny();
 const scope=r.scopes[0];validateShape('Scope',scope);if(scope.tenantId!==k.tenantId||scope.kind!==(r.selectedClientId===null?'private-user':'client')||scope.resourceId!==(r.selectedClientId??k.actorId)||k.scopeSha256!==hash({selectedClientId:r.selectedClientId}))deny();return r;
}
function outcome(state,value,r,k){
 if(state==='PENDING'){if(value!==null)deny();return null;}
 const o=data(own(value,state==='FAILED'?['code']:['status','proposal']));
 if(state==='FAILED'){if(!['REFUSED','UNAVAILABLE','INVALID_REQUEST','STALE'].includes(o.code))deny();return o;}
 if(state!=='PREPARED'||o.status!=='approval_required')deny();const p=toolShape('ScheduleMutationOutput',o.proposal);
 const scopesMatch=r.selectedClientId===null?same(p.projection.scopes,r.scopes):p.projection.scopes.some(scope=>same(scope,r.scopes[0]))&&p.projection.scopes.every(scope=>scope.tenantId===k.tenantId&&scope.policyRevision===r.scopes[0].policyRevision&&(scope.kind!=='private-user'||scope.resourceId===k.actorId));
 if(p.status!=='approval_required'||p.operation!==r.operation||!same(p.projection.owner,{tenantId:k.tenantId,actorId:k.actorId})||!scopesMatch||p.projection.scheduleId!==r.request.scheduleId||!same(p.cancel,{mode:r.request.mode,note:r.request.note,running:'leave',runs:[]}))deny();return o;
}
function entry(row){if(!row)deny();const k=key({tenantId:row.tenant_id,actorId:row.actor_id,scopeSha256:row.scope_sha256,requestId:row.request_id}),r=record(row.record,k),o=outcome(row.state,row.outcome,r,k);
 if(!uuid.test(row.claim_id)||row.record_sha256!==hash(r)||row.proposal_id!==(row.state==='PREPARED'?o.proposal.proposalId:null))deny();return data({key:k,claimId:row.claim_id,record:r,state:row.state,outcome:o});}
export function createRoutineManagementPreparations({pool}){
 assertPool(pool);
 async function tx(body,check,readOnly=false){try{return await transact(pool,body,{check,readOnly,unavailable:'ROUTINES_UNAVAILABLE',uncertain:'ROUTINES_UNKNOWN'});}catch(error){if(error?.code?.startsWith('ROUTINES_'))throw error;const code=productFailure(error)?.code;deny(code==='ROUTINES_UNAVAILABLE'?'UNAVAILABLE':'UNKNOWN',code==='ROUTINES_UNAVAILABLE'?'NOT_DISPATCHED':'UNKNOWN');}}
 return Object.freeze({
  async claim(value,check){const v=own(value,['key','record','claimId']),k=key(v.key),r=record(v.record,k);if(!uuid.test(v.claimId))deny();
   return tx(async client=>{const inserted=await client.query(`INSERT INTO ${table}(tenant_id,actor_id,scope_sha256,request_id,claim_id,record,record_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING') ON CONFLICT DO NOTHING`,[...params(k),v.claimId,r,hash(r)]);check();
    const result=await client.query(`SELECT ${columns} FROM ${table} WHERE tenant_id=$1 AND actor_id=$2 AND scope_sha256=$3 AND request_id=$4`,params(k));check();const row=entry(result.rows[0]);if(row.record.requestSha256!==r.requestSha256)deny();return {claimed:inserted.rowCount===1,row};},check);
  },
  async settle(value,check){const v=own(value,['key','claimId','state','outcome']),k=key(v.key);if(!uuid.test(v.claimId)||!['PREPARED','FAILED'].includes(v.state))deny();
   return tx(async client=>{const selected=await client.query(`SELECT ${columns} FROM ${table} WHERE tenant_id=$1 AND actor_id=$2 AND scope_sha256=$3 AND request_id=$4 FOR UPDATE`,params(k));check();const old=entry(selected.rows[0]);if(old.claimId!==v.claimId)deny();const out=outcome(v.state,v.outcome,old.record,k);
    if(old.state!=='PENDING'){if(old.state!==v.state||!same(old.outcome,out))deny();return old;}
    const changed=await client.query(`UPDATE ${table} SET state=$5,proposal_id=$6,outcome=$7,settled_at=clock_timestamp() WHERE tenant_id=$1 AND actor_id=$2 AND scope_sha256=$3 AND request_id=$4 RETURNING ${columns}`,[...params(k),v.state,v.state==='PREPARED'?out.proposal.proposalId:null,out]);check();return entry(changed.rows[0]);},check);
  },
  async readProposal(value,check){const v=data(own(value,['tenantId','actorId','scopeSha256','proposalId']));validateShape('Identity',{tenantId:v.tenantId,actorId:v.actorId});if(!hex.test(v.scopeSha256)||!uuid.test(v.proposalId))deny();
   return tx(async client=>{const result=await client.query(`SELECT ${columns} FROM ${table} WHERE tenant_id=$1 AND actor_id=$2 AND scope_sha256=$3 AND proposal_id=$4`,[v.tenantId,v.actorId,v.scopeSha256,v.proposalId]);check();return result.rows.length?entry(result.rows[0]):null;},check,true);
  },
 });
}
