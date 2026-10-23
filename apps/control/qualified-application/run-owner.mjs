/** Current product run and admitted task identity. No model grant, tariff, reservation or financial state.
 * Qualification task grants and allocation provenance remain temporary tool/session dependencies (item 0 steps 4/5).
 */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {rowRun,same,uuid} from '../conversations/boundary.mjs';
import {orderedConversationRuns} from '../conversations/next-run-journal.mjs';
import {decodeNativeAllocation} from '../conversations/native-preparation-journal.mjs';
import {ProductError,refuse} from '../product-access/errors.mjs';
import {assertPool,transact} from '../product-persistence/transaction.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';

const denied=()=>refuse('CURRENT_RUN_REFUSED');
const instant=value=>{if(!(value instanceof Date)||!Number.isSafeInteger(value.getTime()))denied();return value.getTime();};
const mapping=(row,q)=>{if(!row||row.run_id!==q.runId||row.attempt!==q.attempt||row.worker_arn!==q.workerArn||row.fence!==q.fence||row.policy_revision!==q.policyRevision)denied();};

export function createPostgresRunOwner(configuration){
 const c=own(configuration,['pool','binding','grantId','expiresAtMs'],['now','maxRequestMs']);assertPool(c.pool);
 const binding=data(c.binding);validateShape('RunBinding',binding);uuid(c.grantId);
 const now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now())refuse('CURRENT_RUN_CONFIGURATION');
 const tuple=[binding.tenantId,binding.conversationId,binding.runId];

 async function read(client,check,life,locked){
  const suffix=locked?' FOR UPDATE':'';
  const query=async(sql,args)=>{check();const result=await client.query(sql,args);check();return result.rows;};
  const conversations=await query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2'+suffix,tuple.slice(0,2));
  const conversation=conversations[0];
  if(conversations.length!==1||conversation.tenant_id!==binding.tenantId||conversation.conversation_id!==binding.conversationId||conversation.owner_actor_id!==binding.actorId)denied();
  try{validateShape('Conversation',conversation.projection);if(hash(conversation.projection)!==conversation.projection_sha256)denied();}catch{denied();}
  if(!same(conversation.projection.owner,{tenantId:binding.tenantId,actorId:binding.actorId})||conversation.projection.conversationId!==binding.conversationId)denied();
  const rows=await query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2'+suffix,tuple.slice(0,2));
  let latest,run;try{rows.forEach(rowRun);latest=orderedConversationRuns(rows).at(-1);run=rows.find(row=>row.run_id===binding.runId);}catch{denied();}
  if(!run||!latest||!same(latest.binding,binding)||run.sequence_end!=null||!['queued','starting','running'].includes(run.projection.state)||!same(run.projection.scopes,conversation.projection.scopes)||run.projection.policyRevision!==conversation.projection.policyRevision)denied();
  // Hold/completion writes retain their canonical journal checks. A pending hold does not invalidate the SDK's final session save.
  const allocations=await query('SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3'+suffix,tuple);
  let allocation;try{if(allocations.length!==1)denied();allocation=decodeNativeAllocation(allocations[0],binding);}catch{denied();}
  if(allocation.state!=='ADMITTED'||allocation.expiresAtMs!==c.expiresAtMs||!same(allocation.original.versions,run.projection.versions)||allocation.qualification.policyRevision!==run.projection.policyRevision)denied();
  const intent=allocation.grantIntents.find(grant=>grant.grantId===c.grantId);
  const fact=allocation.resource.grantFactsJsons.map(value=>JSON.parse(value)).find(grant=>grant.grantId===c.grantId);
  if(!intent||!fact)denied();
  const q=fact.qualificationBinding;
  const qualified=await query('SELECT * FROM meri_product_budget.runs WHERE run_id=$1'+suffix,[binding.runId]);
  if(qualified.length!==1)denied();mapping(qualified[0],q);
  const grants=await query('SELECT * FROM meri_product_budget.grants WHERE grant_id=$1'+suffix,[c.grantId]);
  const grant=grants[0];if(grants.length!==1)denied();mapping(grant,q);
  if(grant.grant_id!==c.grantId||grant.state!=='ACTIVE'||grant.capability_sha256!==intent.capabilitySha256||instant(grant.expires_at)!==intent.expiresAtMs)denied();
  const installed=await query('SELECT * FROM meri_product_budget.tool_grant_bindings WHERE grant_id=$1'+suffix,[c.grantId]);
  if(installed.length!==1||installed[0].grant_id!==c.grantId||installed[0].run_id!==binding.runId||!same(installed[0].facts,fact))denied();
  const clocks=await query('SELECT clock_timestamp() AS now');if(clocks.length!==1)denied();const databaseNow=instant(clocks[0].now);
  const deadlineMs=Math.min(c.expiresAtMs,allocation.original.expiresAtMs,intent.expiresAtMs);
  if(allocation.resource.createdAtMs>databaseNow||databaseNow>=deadlineMs)denied();life.limitDeadline(deadlineMs);check();
  return {binding,policyRevision:run.projection.policyRevision,deadlineMs,checkedAtMs:now(),allocationSha256:allocation.allocationSha256};
 }
 function lifetime(value,options={}){
  const b=data(value),o=own(options,[],['signal','deadlineMs']);validateShape('RunBinding',b);nativeSignal(o.signal);
  if(!same(b,binding)||o.deadlineMs!==undefined&&!Number.isSafeInteger(o.deadlineMs))denied();
  const started=now();if(!Number.isSafeInteger(started)||started<0)denied();
  return createOperationLifetime({now,signal:o.signal,deadlineMs:Math.min(started+maxRequestMs,c.expiresAtMs,o.deadlineMs??Infinity),errorFactory:()=>new ProductError('CURRENT_RUN_STOPPED')});
 }
 async function currentRun(value,options){
  const life=lifetime(value,options),check=()=>life.check();
  try{const current=await transact(c.pool,client=>read(client,check,life,false),{check,readOnly:true});check();
   const {allocationSha256,...observation}=current;return JSON.stringify(observation);
  }finally{life.close();}
 }
 async function withCurrentRun(value,effect){
  const v=own(value,['binding'],['signal','deadlineMs']);if(typeof effect!=='function')refuse('CURRENT_RUN_CONFIGURATION');
  const life=lifetime(v.binding,{signal:v.signal,deadlineMs:v.deadlineMs}),check=()=>life.check();
  try{const result=await transact(c.pool,async client=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${binding.tenantId}:${binding.conversationId}`]);check();
   const current=await read(client,check,life,true),pending=new Set();let active=true,result,failure;
   const port=Object.freeze({query(...args){if(!active)return Promise.reject(new ProductError('CURRENT_RUN_EFFECT_CLOSED'));
    const work=(async()=>{check();const out=await client.query(...args);check();return out;})();pending.add(work);work.then(()=>pending.delete(work),()=>pending.delete(work));return work;}});
   try{result=await life.run(()=>effect(Object.freeze({client:port,current:data(current)}),life.limitDeadline));check();}
   catch(error){failure=error;}finally{active=false;}
   if(pending.size){await Promise.allSettled([...pending]);refuse('CURRENT_RUN_EFFECT_PENDING');}
   if(failure)throw failure;
   await read(client,check,life,true);check();return result;
  },{check});try{check();}catch{throw new ProductError('STORE_COMMIT_UNKNOWN','UNKNOWN');}return result;}finally{life.close();}
 }
 // Both observations are read-only. Only the guarded, compiled SQL callback can mutate session rows.
 return Object.freeze({currentRun,currentTaskRun:currentRun,withCurrentRun});
}
