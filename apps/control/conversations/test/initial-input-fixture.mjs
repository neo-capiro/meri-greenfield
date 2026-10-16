/** In-memory PostgreSQL protocol extension, sharing the existing fixture's serialized connection and rollback. No DB engine. */
import {storeFixture,binding,scopes,versions,id} from './store-fixture.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {prepareOriginalInputFacts} from '../initial-input-facts.mjs';
import {resolveWindow} from '../../../../packages/window-resolution/index.mjs';
export function initialInputFixture(){
 const f=storeFixture(),allocations=new Map(),faults={afterAccept:false,onAccept:null,onCommit:null};let tick=1800000000000;
 const key=p=>p.slice(0,2).join(':'),copy=v=>structuredClone(v);
 const pool={async connect(){const c=await f.pool.connect();let backup;return {async query(sql,p=[]){
  if(sql==='BEGIN')backup=copy(allocations);
  if(sql==='ROLLBACK'){allocations.clear();for(const [k,v] of backup)allocations.set(k,v);}
  if(sql==='COMMIT'){const result=await c.query(sql,p);faults.onCommit?.();return result;}
  if(!sql.includes('meri_conversations.initial_inputs'))return c.query(sql,p);
  f.state.calls.push(sql);let rows=[];
  if(sql.startsWith('SELECT *')){const r=allocations.get(key(p));if(r)rows=[r];}
  else if(sql.startsWith('INSERT INTO')){
   if(!allocations.has(key(p))&&![...allocations.values()].some(r=>r.request_id===p[3])){
    const r={tenant_id:p[0],conversation_id:p[1],run_id:p[2],request_id:p[3],allocation:copy(p[4]),allocation_sha256:p[5],state:'RESERVED',accepted_request_sha256:null};allocations.set(key(p),r);rows=[r];
   }
  }else if(sql.startsWith('UPDATE')){const r=allocations.get(key(p));if(r?.state==='RESERVED'&&r.allocation_sha256===p[2]){r.state='ACCEPTED';r.accepted_request_sha256=p[3];rows=[r];}
   faults.onAccept?.();if(faults.afterAccept)throw Error('synthetic post-update failure');
  }else throw Error('Unexpected initial-input SQL');return {rows:copy(rows),rowCount:rows.length};
 },release:reason=>c.release(reason)};}};
 const now=()=>tick,store=()=>createPostgresConversationStore({pool,now});
 async function proposal({input={requestId:id(60),prompt:'Original prompt'},context={},expiresAtMs=tick+30000}={}){
  const b=context.binding??binding,s=context.scopes??scopes,v=context.versions??versions,selectedClientId=context.selectedClientId??id(5),createdAt=new Date(tick).toISOString();
  const request={requestId:input.requestId,prompt:input.prompt,skill:null,window:input.windowRequest?resolveWindow(input.windowRequest,{referenceAt:createdAt,fiscalCalendars:[]}):null,windowRequest:input.windowRequest??null};
  const facts=await prepareOriginalInputFacts({binding:b,scopes:s,versions:v,selectedClientId,input,request,allocatedAtMs:tick,expiresAtMs});
  const run={binding:b,state:'queued',scopes:s,versions:v,createdAt,policyRevision:s[0].policyRevision},conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes:s,createdAt,policyRevision:run.policyRevision};
  const event={contractVersion:'0.1.0',eventId:id(61),binding:b,sequence:1,createdAt,scopes:s,type:'run.status',data:{state:'queued',reasonCode:null}};
  return {facts,input,acceptance:{conversation,run,request,event,selectedClientId}};
 }
 return {...f,pool,allocations,faults,now,store,proposal,advance(ms){tick+=ms;},key:()=>key([binding.tenantId,binding.conversationId])};
}
