/** SYNTHETIC Objective run-start selection and pg pool protocol only. No sockets, credentials, SQL engine, locks, roles,
 * triggers or physical PostgreSQL durability are exercised: the pool recognises the stores' fixed query texts and keeps a
 * per-transaction draft that COMMIT publishes, so adapter control flow, lock order and failure classification are checked. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {objectiveRunIdentity,createObjectiveRunStartRecord,objectiveAcceptedRequest} from '../run-starts.mjs';
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const NOW=1792065600000;
const without=(v,key)=>Object.fromEntries(Object.entries(v).filter(([k])=>k!==key));
const clone=v=>structuredClone(v);

/** A Core selection (admission, typed request, execution context, queued type) for the binding derived from one job. */
export function runStartFixture({tenantId=id(1),actorId=id(2),generationJobId=id(21),requestId=id(20),clientId=id(3),prompt='Synthetic Objective source only.'}={}){
 const identity=objectiveRunIdentity({tenantId,actorId,generationJobId}),binding=identity.binding;
 const request=JSON.parse(readFileSync(new URL('../../../../packages/contracts/strategy-operations-candidate/fixtures/strategy.draft.request.json',import.meta.url),'utf8'));
 request.requestId=requestId;request.jobId=generationJobId;request.principal={tenantId,actorId,clientId,ownerActorId:actorId};
 request.source.objectiveId=id(4);request.source.objectiveRevisionId=id(5);request.input.typeHint='appropriations';
 request.context.draft.clientId=clientId;request.context.draft.selectedOwnerActorId=actorId;request.context.draft.input=clone(request.input);
 for(const row of request.context.evidence)if(row.scope==='client')row.clientId=clientId;
 request.context.contextSha256=hash(without(request.context,'contextSha256'));request.inputSha256=hash(without(request,'inputSha256'));
 const canonical={canonicalPlanId:id(6),tenantId,clientId,objectiveId:id(4),canonicalStrategyId:id(7),canonicalProjectId:id(8),bindingVersion:1,epoch:1,
  requestedIntentId:id(9),requestedObjectiveRevisionId:id(5),requestedObjectiveVersion:2,snapshotHash:request.source.snapshotSha256};
 const sourceAdmission={schemaVersion:1,namespace:'capiro.objective-strategy.admission:v1',canonical,actorUserId:id(14),clerkUserId:actorId,consentId:id(15),controlVersion:1,
  generationJobId,generationRequestId:requestId,admittedAtMs:NOW-1000,effectExpiresAtMs:NOW+150000,expectedStrategyVersionId:null};
 const executionContext={schemaVersion:1,prompt,promptSha256:createHash('sha256').update(prompt).digest('hex'),
  ownerRefs:[{ownerRef:request.context.ownerRefs[0],clerkUserId:actorId}],contextPacketId:request.context.packetId};
 const selection={sourceAdmission,request,executionContext,queuedType:'appropriations'};
 const acceptedRequest=objectiveAcceptedRequest(selection);
 const record=createObjectiveRunStartRecord({binding,generationJobId,selection,nowMs:NOW});
 return {tenantId,actorId,generationJobId,clientId,identity,binding,eventId:identity.eventId,selection,acceptedRequest,record};
}

const answer=(rows=[],command='SELECT')=>({rows:clone(rows),rowCount:rows.length,command});
/** One synthetic pool for meri_objective_source.run_starts and reader_replays plus occupancy probes of meri_conversations. */
export function syntheticObjectivePool({now=()=>NOW}={}){
 const state={runStarts:new Map(),replays:new Map(),occupied:new Set(),trace:[],clients:[],commits:0,connects:0,poolEnds:0,
  commitFailure:null,queryHook:null,releaseThrows:false,connectWait:null};
 const replayKey=v=>v.slice(0,3).join('\0');
 const pool={async connect(){
  state.connects++;const client={id:state.connects,releaseCount:0,destroyed:false,draft:null,wrote:false,
   release(error){this.releaseCount++;if(this.releaseCount>1)throw Error('SYNTHETIC_DOUBLE_RELEASE');if(error)this.destroyed=true;if(state.releaseThrows)throw Error('SYNTHETIC_RELEASE_FAILURE');},
   end(){this.destroyed=true;},
   async query(config){
    if(this.destroyed)throw Error('SYNTHETIC_DESTROYED_CLIENT');
    const {text,values=[],query_timeout}=config;if(typeof text!=='string'||!Number.isSafeInteger(query_timeout)||query_timeout<1||query_timeout>3000)throw Error('SYNTHETIC_QUERY_CONFIG');
    const item={client:this.id,text,values:clone(values)};state.trace.push(item);await state.queryHook?.(item,this);
    if(text==='BEGIN ISOLATION LEVEL READ COMMITTED'){this.draft={runStarts:clone(state.runStarts),replays:clone(state.replays)};this.wrote=false;return answer([],'BEGIN');}
    if(text==='ROLLBACK'){this.draft=null;return answer([],'ROLLBACK');}
    if(text==='COMMIT'){
     state.commits++;const failure=this.wrote&&state.commitFailure?state.commitFailure:null;if(failure)state.commitFailure=null;
     if(failure==='before')throw Error('SYNTHETIC_COMMIT_LOST_BEFORE_WRITE');
     if(this.wrote){state.runStarts=this.draft.runStarts;state.replays=this.draft.replays;}this.draft=null;
     if(failure==='after')throw Error('SYNTHETIC_COMMIT_LOST_AFTER_WRITE');return answer([],'COMMIT');
    }
    if(text.includes("set_config('statement_timeout'"))return answer();
    if(text.includes('pg_advisory_xact_lock'))return answer([{locked:''}]);
    if(text.includes(' AS now_ms'))return answer([{now_ms:String(now())}]);
    const d=this.draft;
    if(text.startsWith('SELECT 1 AS present FROM meri_conversations.')){const table=/meri_conversations\.([a-z_]+)/u.exec(text)[1];return answer(state.occupied.has(`${table}:${values[0]}:${values[1]}`)?[{present:1}]:[]);}
    if(text.includes('FROM meri_objective_source.run_starts WHERE generation_job_id=$1')){const r=d.runStarts.get(values[0]);return answer(r?[r]:[]);}
    if(text.includes('FROM meri_objective_source.run_starts WHERE tenant_id=$1')){return answer([...d.runStarts.values()].filter(r=>r.tenant_id===values[0]&&r.conversation_id===values[1]&&r.run_id===values[2]));}
    if(text.startsWith('INSERT INTO meri_objective_source.run_starts')){
     if(d.runStarts.has(values[0])||[...d.runStarts.values()].some(r=>r.issuance_key===values[4]||r.tenant_id===values[1]&&r.conversation_id===values[2]&&r.run_id===values[3]))return answer([],'INSERT');
     const names=['generation_job_id','tenant_id','conversation_id','run_id','issuance_key','binding','source_admission_sha256','source_request_sha256','typed_request_sha256','selection_sha256','record_sha256','effect_expires_at_ms','record'];
     const r={...Object.fromEntries(names.map((n,i)=>[n,clone(values[i])])),created_at:new Date(now())};r.effect_expires_at_ms=String(r.effect_expires_at_ms);
     d.runStarts.set(r.generation_job_id,r);this.wrote=true;return answer([r],'INSERT');
    }
    if(text.includes('FROM meri_objective_source.reader_replays WHERE issuer=$1')){const r=d.replays.get(replayKey(values));return answer(r?[r]:[]);}
    if(text.startsWith('INSERT INTO meri_objective_source.reader_replays')){
     if(d.replays.has(replayKey(values)))return answer([],'INSERT');
     const names=['issuer','subject','token_id','tenant_id','generation_job_id','purpose','identity','identity_sha256','source','source_sha256','signed_token_sha256','token_expires_at_ms','claim_fence'];
     const r={...Object.fromEntries(names.map((n,i)=>[n,clone(values[i])])),state:'CLAIMED',version:'1',value:null,value_sha256:null,claimed_at:new Date(now()),committed_at:null};
     r.token_expires_at_ms=String(r.token_expires_at_ms);d.replays.set(replayKey(values),r);this.wrote=true;return answer([r],'INSERT');
    }
    if(text.startsWith('UPDATE meri_objective_source.reader_replays')){
     const r=d.replays.get(replayKey(values));
     if(!r||r.claim_fence!==values[3]||r.state!=='CLAIMED'||r.version!=='1')return answer([],'UPDATE');
     Object.assign(r,{state:'COMMITTED',version:'2',value:clone(values[4]),value_sha256:values[5],committed_at:new Date(now())});this.wrote=true;return answer([r],'UPDATE');
    }
    throw Error('SYNTHETIC_UNRECOGNIZED_FIXED_QUERY '+text.slice(0,80));
   }};
  state.clients.push(client);if(state.connectWait)await state.connectWait;return client;
 },end(){state.poolEnds++;throw Error('BORROWED_POOL_MUST_NOT_END');}};
 return {pool,state};
}
