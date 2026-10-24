/** In-memory PostgreSQL protocol extension, sharing the existing fixture's serialized connection and rollback. No DB engine. */
import {storeFixture,binding,scopes,versions,id} from './store-fixture.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {prepareOriginalInputFacts} from '../initial-input-facts.mjs';
import {resolveWindow} from '../../../../packages/window-resolution/index.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
export function initialInputFixture(){
 const f=storeFixture(),allocations=new Map(),bindings=[],objectiveRunStarts=new Map(),faults={afterAccept:false,onAccept:null,onCommit:null};let tick=1800000000000;
 // Original inputs are keyed per original RUN (0020); bindings model 0017+0020 generations for the real binding journal.
 const key=p=>p.slice(0,3).join(':'),copy=v=>structuredClone(v);
 const latest=(t,conversation)=>bindings.filter(r=>r.tenant_id===t&&r.conversation_id===conversation).sort((a,b)=>b.generation-a.generation).slice(0,1);
 const one=found=>found?[{present:1}]:[];
 /** The binding journal's reads and writes (its own transaction shape included); null for every other statement. */
 function journal(sql,p){
  if(sql==='BEGIN ISOLATION LEVEL READ COMMITTED')return 'BEGIN';
  if(sql.startsWith("SELECT set_config('statement_timeout'"))return [];
  if(sql.includes('FROM meri_objective_source.run_starts WHERE tenant_id=$1'))return [...objectiveRunStarts.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]&&r.run_id===p[2]);
  if(sql.includes('FROM meri_objective_source.run_starts WHERE generation_job_id=$1'))return [...objectiveRunStarts.values()].filter(r=>r.generation_job_id===p[0]);
  if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings'))return latest(p[0],p[1]);
  if(sql.startsWith('INSERT INTO meri_conversations.initial_run_bindings')){
   if(bindings.some(r=>r.tenant_id===p[0]&&(r.run_id===p[2]||r.conversation_id===p[1]&&r.generation===p[5])))return [];
   const r={tenant_id:p[0],conversation_id:p[1],run_id:p[2],record:copy(p[3]),record_sha256:p[4],generation:p[5]};bindings.push(r);return [r];
  }
  const runs=[...f.state.runs.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]);
  if(sql.startsWith('SELECT 1 FROM meri_conversations.runs'))return one(runs.length);
  if(sql.startsWith('SELECT projection,projection_sha256 FROM meri_conversations.runs'))return runs.sort((a,b)=>Number(a.sequence_base)-Number(b.sequence_base)).slice(0,1).map(r=>({projection:r.projection,projection_sha256:r.projection_sha256}));
  if(sql.startsWith('SELECT 1 FROM meri_conversations.initial_inputs'))return one([...allocations.values()].some(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]));
  const next=[...f.state.nextRuns.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]);
  if(sql.startsWith('SELECT 1 FROM meri_conversations.next_runs'))return one(next.length);
  if(sql.startsWith('SELECT reservation,reservation_sha256 FROM meri_conversations.next_runs'))return next.filter(r=>r.source_run_id===p[2]).map(r=>({reservation:r.reservation,reservation_sha256:r.reservation_sha256}));
  if(sql.startsWith('SELECT 1 FROM meri_conversations.native_allocations'))return one([...f.state.allocations.values()].some(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]&&r.run_id===p[2]));
  return null;
 }
 const pool={async connect(){const c=await f.pool.connect();let backup;return {async query(sql,p=[]){
  if(sql&&typeof sql==='object'){p=sql.values??[];sql=sql.text;}
  const mapped=journal(sql,p);
  if(mapped==='BEGIN')sql='BEGIN';else if(mapped){f.state.calls.push(sql);return {rows:copy(mapped),rowCount:mapped.length};}
  if(sql==='BEGIN')backup=copy({allocations,bindings});
  if(sql==='ROLLBACK'){allocations.clear();for(const [k,v] of backup.allocations)allocations.set(k,v);bindings.splice(0,bindings.length,...backup.bindings);}
  if(sql==='COMMIT'){const result=await c.query(sql,p);faults.onCommit?.();return {...result,command:'COMMIT'};}
  if(!sql.includes('meri_conversations.initial_inputs'))return c.query(sql,p);
  f.state.calls.push(sql);let rows=[];
  if(sql.startsWith('SELECT tenant_id,conversation_id'))rows=[...allocations.values()].filter(r=>r.request_id===p[0]&&(r.tenant_id!==p[1]||r.conversation_id!==p[2])).slice(0,1).map(r=>({tenant_id:r.tenant_id,conversation_id:r.conversation_id}));
  else if(sql.startsWith('SELECT run_id'))rows=[...allocations.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]).slice(0,2).map(r=>({run_id:r.run_id}));
  else if(sql.startsWith('SELECT *'))rows=[...allocations.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]&&(!sql.includes('AND run_id=$3')||r.run_id===p[2]));
  else if(sql.startsWith('INSERT INTO')){
   if(!allocations.has(key(p))&&![...allocations.values()].some(r=>r.tenant_id===p[0]&&r.run_id===p[2]&&r.request_id===p[3])){
    const r={tenant_id:p[0],conversation_id:p[1],run_id:p[2],request_id:p[3],allocation:copy(p[4]),allocation_sha256:p[5],state:'RESERVED',accepted_request_sha256:null};allocations.set(key(p),r);rows=[r];
   }
  }else if(sql.startsWith('UPDATE')){const r=allocations.get(key([p[0],p[1],p[4]]));if(r?.state==='RESERVED'&&r.allocation_sha256===p[2]){r.state='ACCEPTED';r.accepted_request_sha256=p[3];rows=[r];}
   faults.onAccept?.();if(faults.afterAccept)throw Error('synthetic post-update failure');
  }else throw Error('Unexpected initial-input SQL');return {rows:copy(rows),rowCount:rows.length};
 },release:reason=>c.release(reason)};}};
 const now=()=>tick,store=()=>createPostgresConversationStore({pool,now,modelCatalog:MODEL_CATALOG});
 async function proposal({input={requestId:id(60),prompt:'Original prompt'},context={},expiresAtMs=tick+30000}={}){
  const b=context.binding??binding,s=context.scopes??scopes,v=context.versions??versions,selectedClientId=context.selectedClientId===undefined?id(5):context.selectedClientId,createdAt=new Date(tick).toISOString();
  const request={requestId:input.requestId,prompt:input.prompt,skill:null,window:input.windowRequest?resolveWindow(input.windowRequest,{referenceAt:createdAt,fiscalCalendars:[]}):null,windowRequest:input.windowRequest??null};
  const facts=await prepareOriginalInputFacts({binding:b,scopes:s,versions:v,selectedClientId,input,request,allocatedAtMs:tick,expiresAtMs});
  const run={binding:b,state:'queued',scopes:s,versions:v,createdAt,policyRevision:s[0].policyRevision},conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes:s,createdAt,policyRevision:run.policyRevision};
  const event={contractVersion:'0.1.0',eventId:id(61),binding:b,sequence:1,createdAt,scopes:s,type:'run.status',data:{state:'queued',reasonCode:null}};
  return {facts,input,acceptance:{conversation,run,request,event,selectedClientId}};
 }
 return {...f,pool,allocations,faults,now,store,proposal,advance(ms){tick+=ms;},bindings,objectiveRunStarts,key:()=>key([binding.tenantId,binding.conversationId,binding.runId])};
}
