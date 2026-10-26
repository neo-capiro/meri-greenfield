/** Synthetic SQL protocol fixture over the unchanged real accounting/store owners. No native database claim. */
import assert from 'node:assert/strict';
import {storeFixture,binding,scopes,versions,id} from '../../test/store-fixture.mjs';
import {createPostgresConversationStore} from '../../postgres-store.mjs';
import {sdkUsageSnapshot,accountSdkSnapshot} from '../../usage.mjs';
import {hash} from '../../boundary.mjs';
export {binding,scopes,id};
export const request={schemaVersion:'meri.conversation-usage/1',conversationId:binding.conversationId,runId:binding.runId};
export const check=()=>{},at='2026-10-26T06:00:00.000Z';
export function payload({zero=false,unavailable=false,omitted=0}={}){
 const n=zero?0:1;
 return {usage:unavailable?null:sdkUsageSnapshot({type:'result',session_id:id(50),total_cost_usd:0.3*n,modelUsage:{
  'model.alpha':{inputTokens:100*n,outputTokens:20*n,cacheReadInputTokens:40*n,cacheCreationInputTokens:60*n,webSearchRequests:n,costUSD:0.1*n,provider:'bedrock',costBasis:'list'},
  'model.beta':{inputTokens:200*n,outputTokens:30*n,cacheReadInputTokens:50*n,cacheCreationInputTokens:70*n,webSearchRequests:0,costUSD:0.2*n,provider:'firstParty',costBasis:'list'},
 }}),toolsUsed:{tools:[{tool:'Read',toolUseId:'private-tool-audit',outcome:'completed',durationMs:0},{tool:'mcp__capiro__read',toolUseId:'another-private-tool-audit',outcome:'failed',durationMs:null}],omitted}};
}
export function savedUsage(input=payload(),context={mode:'new'}){
 return {...accountSdkSnapshot(input.usage,context),parentRunId:null,inputSha256:hash(input),toolsUsed:input.toolsUsed};
}
export async function fixture({record=true,general=false,input=payload()}={}){
 const db=storeFixture(),expectedScopes=general?[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'policy1'}]:scopes;
 const contextPrefix='SELECT tenant_id,conversation_id,run_id,request_id,request,request_sha256,projection,projection_sha256,last_sequence FROM meri_conversations.runs';
 const pool={async connect(){const client=await db.pool.connect();return {release:error=>client.release(error),async query(sql,parameters){
  if(!sql.startsWith(contextPrefix))return client.query(sql,parameters);
  assert.equal(sql,contextPrefix+' WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3');assert.doesNotMatch(sql,/sdk_usage/);
  db.state.calls.push(sql);const row=db.state.runs.get(parameters.join(':')),columns=contextPrefix.slice(7,contextPrefix.indexOf(' FROM')).split(',');
  return {rows:row?[Object.fromEntries(columns.map(column=>[column,structuredClone(row[column])]))]:[]};
 }}}};
 const store=createPostgresConversationStore({pool}),run={binding,scopes:expectedScopes,state:'queued',createdAt:at,policyRevision:'policy1',versions};
 await store.accept({run,request:{requestId:id(6),prompt:'Synthetic private prompt',skill:null,window:null},conversation:{conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes:expectedScopes,policyRevision:'policy1',createdAt:at},event:{contractVersion:'0.1.0',eventId:id(7),binding,scopes:expectedScopes,sequence:1,createdAt:at,type:'run.status',data:{state:'queued',reasonCode:null}}},check);
 for(const [n,state]of [[8,'starting'],[9,'running']])await store.append(binding,{eventId:id(n),createdAt:at,type:'run.status',data:{state,reasonCode:null}},check);
 if(record)await store.recordUsage({binding,scopes:expectedScopes,input},check);
 await store.append(binding,{eventId:id(10),createdAt:at,type:'run.status',data:{state:'completed',reasonCode:null}},check);
 return {...db,pool,store,scopes:expectedScopes,row:()=>db.state.runs.get([binding.tenantId,binding.conversationId,binding.runId].join(':'))};
}
