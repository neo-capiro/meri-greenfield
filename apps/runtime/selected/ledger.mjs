/** Native allocation-locked body journal; unknown deliveries are never dispatched again. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {fault} from '../config.mjs';
const hash=canonicalSha256,same=(a,b)=>hash(a)===hash(b),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export function createSelectedReadLedger(configuration){
 const c=own(configuration,['allocationOwner','readCompletion','now']);if(typeof c.allocationOwner?.withCurrentAllocation!=='function'||typeof c.readCompletion!=='function'||typeof c.now!=='function')throw fault('SELECTED_LEDGER_CONFIGURATION');
 function selector(raw){const v=data(raw);own(v,['binding','requestSha256','selectionSha256','operation','arguments','deliveryId']);validateShape('RunBinding',v.binding);if(!digest(v.requestSha256)||!digest(v.selectionSha256)||!/^(sdk|compiler):[a-f0-9]{64}$/u.test(v.deliveryId))throw fault('SELECTED_LEDGER_SELECTOR');return v;}
 async function locked(raw,signal,body,deadlineMs){nativeSignal(signal);const v=selector(raw);return c.allocationOwner.withCurrentAllocation({binding:v.binding,signal,...(deadlineMs===undefined?{}:{deadlineMs})},async({client,current})=>{
  if(!same(current.binding,v.binding)||!digest(current.allocationSha256)||current.deadlineMs<=c.now())throw fault('SELECTED_LEDGER_AUTHORITY');
  return body(v,client,current,[v.binding.tenantId,v.binding.conversationId,v.binding.runId,hash({binding:v.binding,deliveryId:v.deliveryId})]);
 });}
 async function claim(raw,{signal}={}){return locked(raw,signal,async(v,client,current,key)=>{
  // The canonical native owner holds the run/allocation locks across this operation.
  const rows=await client.query('SELECT stage,selector,allocation_sha256 FROM meri_conversations.selected_reads WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND delivery_sha256=$4',key);if(rows.rows.length){const row=rows.rows[0];if(rows.rows.length!==1||!same(row.selector,v)||row.allocation_sha256!==current.allocationSha256||!['PENDING','RETAINED','UNKNOWN'].includes(row.stage))throw fault('SELECTED_READ_REPLAY_REFUSED');return {claimed:false,stage:row.stage};}
  const count=await client.query('SELECT count(*) AS n FROM meri_conversations.selected_reads WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',key.slice(0,3));if(Number(count.rows[0].n)>=current.allocation.budgets.maxToolCalls)throw fault('SELECTED_READ_BUDGET');
  await client.query("INSERT INTO meri_conversations.selected_reads(tenant_id,conversation_id,run_id,delivery_sha256,selector,allocation_sha256,stage) VALUES($1,$2,$3,$4,$5::jsonb,$6,'PENDING')",[...key,JSON.stringify(v),current.allocationSha256]);return {claimed:true,stage:'PENDING'};
 });}
 async function retain(raw,result,{signal}={}){const v=selector(raw);if(typeof result!=='string'||Buffer.byteLength(result)>1048576)throw fault('SELECTED_READ_BODY_LIMIT');const body=data(JSON.parse(result));
  const started=c.now(),marker=data(await c.readCompletion({operation:v.operation,arguments:v.arguments,deliveryId:v.deliveryId,signal}));own(marker,['stage','binding','grantId','allocationSha256','producerKeySha256','deadlineMs','checkedAtMs','invocationId','reservationId','factsSha256','rawRequestSha256','operation','argumentsSha256','resultSha256','outputBytes']);
  if(marker.stage!=='SETTLED'||!same(marker.binding,v.binding)||!same(marker.operation,v.operation)||marker.rawRequestSha256!==hash({operation:v.operation,arguments:v.arguments})||![marker.argumentsSha256,marker.factsSha256,marker.producerKeySha256,marker.allocationSha256].every(digest)||marker.resultSha256!==hash(body)||marker.outputBytes!==Buffer.byteLength(result)||!Number.isSafeInteger(marker.checkedAtMs)||!Number.isSafeInteger(marker.deadlineMs)||marker.checkedAtMs<started||marker.checkedAtMs>c.now()||marker.deadlineMs<=c.now())throw fault('SELECTED_READ_NATIVE_MARKER_REFUSED');
  return locked(v,signal,async(v,client,current,key)=>{if(marker.allocationSha256!==current.allocationSha256)throw fault('SELECTED_READ_NATIVE_MARKER_REFUSED');
   const retained=await client.query("UPDATE meri_conversations.selected_reads SET stage='RETAINED',result_text=$5,completion=$6::jsonb WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND delivery_sha256=$4 AND stage='PENDING' AND allocation_sha256=$7 AND selector=$8::jsonb RETURNING stage",[...key,result,JSON.stringify(marker),current.allocationSha256,JSON.stringify(v)]);if(retained.rows.length!==1)throw fault('SELECTED_READ_NOT_RETAINED');return {retained:true};
  },marker.deadlineMs);}
 async function unknown(raw,{signal}={}){return locked(raw,signal,async(_v,client,_current,key)=>{await client.query("UPDATE meri_conversations.selected_reads SET stage='UNKNOWN' WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND delivery_sha256=$4 AND stage='PENDING'",key);return {stage:'UNKNOWN'};});}
 return Object.freeze({claim,retain,unknown});
}
