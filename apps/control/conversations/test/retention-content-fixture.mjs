/** Explicit synthetic snapshot columns. Unknown tables are never defaulted by
 * production; these scripted store fixtures implement only the listed owners. */
import {conversationContentTables} from '../retention-content-rows.mjs';
export function contentRows(state={},binding){
 const rows=Object.fromEntries(conversationContentTables.map(t=>[t.name,[]]));
 const map={sdkSessions:'sdk_sessions',sdkStreams:'sdk_session_streams',sdkEntries:'sdk_session_entries',sdkBatches:'sdk_session_batches',
  executions:'native_executions',allocations:'native_allocations',restorations:'native_restorations',selectedOutputs:'selected_outputs'};
 for(const [property,table] of Object.entries(map)){
  const values=state[property] instanceof Map?[...state[property].values()]:state[property]??[];
  rows['meri_conversations.'+table]=structuredClone(values.filter(r=>!binding||r.tenant_id===binding.tenantId&&r.conversation_id===binding.conversationId));
 }
 return rows;
}
export function rawInventory(state,binding){
 const filter=rows=>rows.filter(r=>r.tenant_id===binding.tenantId&&r.conversation_id===binding.conversationId);
 return {subject:{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId,ownerActorId:binding.actorId},
  conversation:state.conversations.get(`${binding.tenantId}:${binding.conversationId}`),runs:filter([...state.runs.values()]),
  events:filter([...state.events.values()].flat().map(e=>({...e,tenant_id:e.event.binding.tenantId,conversation_id:e.event.binding.conversationId,run_id:e.event.binding.runId}))),
  controls:filter([...state.controls.values()]),checkpoints:filter([...state.checkpoints.values()]),completionCheckpoints:filter([...state.completions.values()]),
  nextRuns:filter([...state.nextRuns.values()]),memoryContinuations:[],memoryContextRows:[],memoryCandidates:[],contentRows:contentRows(state,binding)};
}
