/** SYNTHETIC pg pool protocol only. No sockets, credentials, SQL engine, locks,
 * role grants or physical PostgreSQL durability are exercised by this fixture. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createObjectiveCustodyRecord} from '../projection.mjs';
import {objectiveCustodyRecordColumns} from '../postgres-records.mjs';
import {createPostgresObjectiveCustodyStore} from '../postgres-custody.mjs';
import {custodyFixture,id} from './custody-fixture.mjs';
const clone=value=>structuredClone(value),answer=(rows=[],command='SELECT')=>({rows:clone(rows),rowCount:rows.length,command});
export function postgresCustodyFixture(){
 const f=custodyFixture(),record=createObjectiveCustodyRecord({accepted:f.accepted,issued:f.issued});
 const state={rows:new Map(),trace:[],clients:[],commits:0,connects:0,poolEnds:0,releaseThrows:false,connectWait:null,
  queryHook:null,commitFailure:null,commitWait:null,afterCommit:null,runChange:null,issuanceChange:null};
 function sourceRows(){
  const run=f.state.accepted.run,request=f.state.accepted.request,b=run.binding,i=f.state.issued.issuance;
  const runRow={tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,projection:clone(run),projection_sha256:hash(run),
   request_id:request.requestId,request:clone(request),request_sha256:hash(request)};
  const issuanceRow={issuance_key:i.issuanceKey,tenant_id:i.binding.tenantId,conversation_id:i.binding.conversationId,run_id:i.binding.runId,
   binding:clone(i.binding),binding_sha256:hash(i.binding),request_sha256:i.requestSha256,expires_at_ms:String(i.expiresAtMs),state:'ISSUED',
   grant_id:i.grantId,capability_sha256:i.capabilitySha256,facts_sha256:i.factsSha256};
  state.runChange?.(runRow);state.issuanceChange?.(issuanceRow);return {runRow,issuanceRow};
 }
 const pool={async connect(){
  state.connects++;const client={id:state.connects,releaseCount:0,destroyed:false,ended:0,draft:null,writeKind:null,
   release(error){this.releaseCount++;if(this.releaseCount>1)throw Error('SYNTHETIC_DOUBLE_RELEASE');if(error)this.destroyed=true;
    if(state.releaseThrows)throw Error('SYNTHETIC_RELEASE_FAILURE');},end(){this.ended++;this.destroyed=true;},
   async query(config){
    if(this.destroyed)throw Error('SYNTHETIC_DESTROYED_CLIENT');
    const {text,values=[],query_timeout}=config;if(typeof text!=='string'||!Number.isSafeInteger(query_timeout)||query_timeout<1||query_timeout>3000)throw Error('SYNTHETIC_QUERY_CONFIG');
    const item={client:this.id,text,values:clone(values),queryTimeout:query_timeout};state.trace.push(item);await state.queryHook?.(item,this);
    if(this.destroyed)throw Error('SYNTHETIC_DESTROYED_CLIENT');
    if(text==='BEGIN ISOLATION LEVEL READ COMMITTED'){this.draft=clone(state.rows);return answer([],'BEGIN');}
    if(text==='ROLLBACK'){this.draft=null;return answer([],'ROLLBACK');}
    if(text==='COMMIT'){
     state.commits++;const failure=state.commitFailure?.kind===this.writeKind?state.commitFailure:null;if(failure)state.commitFailure=null;
     if(failure?.mode==='before')throw Error('SYNTHETIC_COMMIT_REPLY_LOST_BEFORE_WRITE');
     if(this.writeKind)state.rows=clone(this.draft);this.draft=null;state.afterCommit?.(this.writeKind);
     if(failure?.mode==='defer')await state.commitWait;
     if(failure?.mode==='after')throw Error('SYNTHETIC_COMMIT_REPLY_LOST_AFTER_WRITE');return answer([],'COMMIT');
    }
    if(text.includes("set_config('statement_timeout'"))return answer();
    if(text.includes('pg_advisory_xact_lock'))return answer([{locked:''}]);
    if(text.includes(' AS now_ms'))return answer([{now_ms:String(f.state.now)}]);
    const native=sourceRows();
    if(text.includes('FROM meri_conversations.runs')){
     const r=native.runRow;return answer(r.tenant_id===values[0]&&r.conversation_id===values[1]&&r.run_id===values[2]?[r]:[]);
    }
    if(text.includes('FROM meri_conversations.run_issuances')){
     const r=native.issuanceRow;return answer(r.issuance_key===values[0]&&r.tenant_id===values[1]&&r.conversation_id===values[2]&&r.run_id===values[3]?[r]:[]);
    }
    if(text.startsWith('SELECT tenant_id FROM meri_objective_source.custody')){
     const r=this.draft.get(values[0]);return answer(r?[{tenant_id:r.tenant_id}]:[]);
    }
    if(text.startsWith('SELECT generation_job_id FROM meri_objective_source.custody'))return answer([...this.draft.values()].filter(r=>r.issuance_key===values[0]&&r.tenant_id===values[1]).map(r=>({generation_job_id:r.generation_job_id})));
    if(text.includes('FROM meri_objective_source.custody')){
     const r=this.draft.get(values[0]);return answer(r?.tenant_id===values[1]?[r]:[]);
    }
    if(text.startsWith('INSERT INTO meri_objective_source.custody')){
     if(this.draft.has(values[0])||[...this.draft.values()].some(r=>r.issuance_key===values[4]))return answer([],'INSERT');
     const names=['generation_job_id','tenant_id','conversation_id','run_id','issuance_key','binding_sha256','binding','source_admission_sha256',
      'source_request_sha256','facts_sha256','record_sha256','original_expires_at_ms','record','claim_fence'];
     const r={...Object.fromEntries(names.map((name,index)=>[name,clone(values[index])])),state:'CLAIMED',version:'1',claimed_at:new Date(f.state.now),committed_at:null};
     r.original_expires_at_ms=String(r.original_expires_at_ms);this.draft.set(r.generation_job_id,r);this.writeKind='claim';return answer([r],'INSERT');
    }
    if(text.startsWith('UPDATE meri_objective_source.custody')){
     const r=this.draft.get(values[0]);if(!r||r.tenant_id!==values[1]||r.claim_fence!==values[2]||r.state!=='CLAIMED'||r.version!=='1'||r.record_sha256!==values[3])return answer([],'UPDATE');
     Object.assign(r,{state:'COMMITTED',version:'2',committed_at:new Date(f.state.now)});this.writeKind='final';return answer([r],'UPDATE');
    }
    throw Error('SYNTHETIC_UNRECOGNIZED_FIXED_QUERY');
   },
  };
  state.clients.push(client);if(state.connectWait)await state.connectWait;return client;
 },end(){state.poolEnds++;throw Error('BORROWED_POOL_MUST_NOT_END');}};
 const create=(options={})=>createPostgresObjectiveCustodyStore({pool,tenantId:f.binding.tenantId,now:()=>f.state.now,allocateFence:()=>id(80),enabled:true,...options});
 const input={generationJobId:record.generationJobId,record};
 const reverse={issuanceKey:record.issued.issuance.issuanceKey,binding:record.binding,factsSha256:record.issued.factsSha256};
 const seed=(lifecycle='CLAIMED',changes={})=>{
  const row={...objectiveCustodyRecordColumns(record,{tenantId:f.binding.tenantId}),state:lifecycle,claim_fence:id(81),version:lifecycle==='CLAIMED'?'1':'2',
   claimed_at:new Date(f.state.now),committed_at:lifecycle==='CLAIMED'?null:new Date(f.state.now),...changes};state.rows.set(record.generationJobId,row);return row;
 };
 return {f,record,state,pool,create,input,reverse,seed,sourceRows};
}
