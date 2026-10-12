/** Concrete pg8.23.1-compatible borrowed pool; never connects or migrates on import. */
import {data,keys,options,same,deny,code,method,retained} from './binding.mjs';
export function createPostgresTaskLookupStore(configuration){
 const {pool}=options(configuration,['pool']);
 const connect=method(pool,'connect');
 async function transaction(body,check){
  let client,begun=false,committing=false,reusable=false,failure,value;
  try{
   check();client=await connect();check();const query=method(client,'query');
   await query('BEGIN');begun=true;check();await query("SET LOCAL statement_timeout = '5s'");check();await query("SET LOCAL lock_timeout = '2s'");check();
   const q=async(sql,args)=>{check();const result=await query(sql,args);check();return result;};
   value=await body(q);check();committing=true;await query('COMMIT');reusable=true;check();
  }catch(error){failure=Object.assign(new Error(committing?'LOOKUP_COMMIT_UNKNOWN':code(error)??'LOOKUP_STORE_UNAVAILABLE'),{code:committing?'LOOKUP_COMMIT_UNKNOWN':code(error)??'LOOKUP_STORE_UNAVAILABLE'});if(begun&&!committing)try{await method(client,'query')('ROLLBACK');reusable=true;}catch{}}
  finally{if(client)try{method(client,'release')(reusable?undefined:failure);}catch{failure??=Object.assign(new Error('LOOKUP_RELEASE_UNKNOWN'),{code:'LOOKUP_RELEASE_UNKNOWN'});}}
  if(failure)throw failure;return value;
 }
 const response=(b,state)=>data({lookupId:b.context.lookupId,bindingSha256:b.bindingSha256,state});
 async function locked(q,b){
  const rows=(await q('SELECT payload,state,record FROM meri_task_lookup.lookups WHERE tenant_id=$1 AND lookup_id=$2 FOR UPDATE',[b.context.binding.tenantId,b.context.lookupId])).rows;
  if(rows.length!==1)deny('LOOKUP_STORE_UNKNOWN');const row=data(rows[0]);keys(row,['payload','state','record']);if(!same(row.payload,b))deny('LOOKUP_CONFLICT');return row;
 }
 async function claim(binding,started,check){const b=data(binding),e=data(started),c=b.context;
  return transaction(async q=>{
   const r=await q("INSERT INTO meri_task_lookup.lookups(tenant_id,lookup_id,result_reference,payload,state) VALUES($1,$2,$3,$4::jsonb,'CLAIMED') ON CONFLICT DO NOTHING RETURNING lookup_id",[c.binding.tenantId,c.lookupId,c.resultReference,JSON.stringify(b)]);
   if(r.rows.length!==1)deny('LOOKUP_REPLAY');
   for(const [kind,slot]of Object.entries(c.slots))await q('INSERT INTO meri_task_lookup.events(tenant_id,run_id,sequence,event_id,lookup_id,kind,event) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[c.binding.tenantId,c.binding.runId,slot.sequence,slot.eventId,c.lookupId,kind,kind==='started'?JSON.stringify(e):null]);
   return response(b,'CLAIMED');
  },check);
 }
 async function markDispatching(binding,check){const b=data(binding);return transaction(async q=>{const row=await locked(q,b);if(row.state!=='CLAIMED')deny('LOOKUP_REPLAY');await q("UPDATE meri_task_lookup.lookups SET state='DISPATCHING' WHERE tenant_id=$1 AND lookup_id=$2",[b.context.binding.tenantId,b.context.lookupId]);return response(b,'DISPATCHING');},check);}
 async function complete(binding,value,check){const b=data(binding),record=retained(value);if(!same(record.binding,b))deny('LOOKUP_CONFLICT');return transaction(async q=>{
  const row=await locked(q,b);if(row.state!=='DISPATCHING')deny('LOOKUP_STORE_UNKNOWN');
  await q("UPDATE meri_task_lookup.lookups SET state='RESULT',record=$3::jsonb WHERE tenant_id=$1 AND lookup_id=$2",[b.context.binding.tenantId,b.context.lookupId,JSON.stringify(record)]);
  const changed=await q("UPDATE meri_task_lookup.events SET event=$3::jsonb WHERE tenant_id=$1 AND lookup_id=$2 AND kind='terminal' AND event IS NULL",[b.context.binding.tenantId,b.context.lookupId,JSON.stringify(record.events[1])]);if(changed.rowCount!==1)deny('LOOKUP_STORE_UNKNOWN');return response(b,'RESULT');
 },check);}
 async function recordError(binding,errorEvent,check){const b=data(binding),e=data(errorEvent);return transaction(async q=>{
  const row=await locked(q,b);if(!['CLAIMED','DISPATCHING'].includes(row.state))deny('LOOKUP_STORE_UNKNOWN');
  await q("UPDATE meri_task_lookup.lookups SET state='ERROR' WHERE tenant_id=$1 AND lookup_id=$2",[b.context.binding.tenantId,b.context.lookupId]);
  const changed=await q("UPDATE meri_task_lookup.events SET event=$3::jsonb WHERE tenant_id=$1 AND lookup_id=$2 AND kind='terminal' AND event IS NULL",[b.context.binding.tenantId,b.context.lookupId,JSON.stringify(e)]);if(changed.rowCount!==1)deny('LOOKUP_STORE_UNKNOWN');return response(b,'ERROR');
 },check);}
 async function read(key,check){const k=data(key);keys(k,['tenantId','resultReference']);return transaction(async q=>{const rows=(await q('SELECT record FROM meri_task_lookup.lookups WHERE tenant_id=$1 AND result_reference=$2 AND state=\'RESULT\'',[k.tenantId,k.resultReference])).rows;if(rows.length>1)deny('LOOKUP_STORE_UNKNOWN');return rows.length?retained(rows[0].record):null;},check);}
 return Object.freeze({claim,markDispatching,complete,recordError,read});
}
