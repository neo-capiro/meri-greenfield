import {hash,same,rowRun} from '../boundary.mjs';
import {decodeOwnedConversation} from '../history/store.mjs';
import {assertConversationEvent} from '../../../../packages/contracts/conversation-sources/validate.mjs';
import {projectRecordedUsage} from '../usage-read/projection.mjs';
import {refuse,productFailure} from '../../product-access/errors.mjs';
/** Decode actual durable rows; no prompt, source body, SDK transcript or execution credential leaves this owner. */
export function projectRunRow(raw,principal){
 try{
  const conversation=decodeOwnedConversation(raw.conversation_row,principal),r=rowRun(raw.run_row),run=r.projection,b=run.binding,e=raw.status_row,event=assertConversationEvent(e?.event);
  if(b.tenantId!==principal.tenantId||b.actorId!==principal.actorId||b.conversationId!==conversation.conversationId||!same(run.scopes,conversation.scopes)||
   !e||e.tenant_id!==b.tenantId||e.conversation_id!==b.conversationId||e.run_id!==b.runId||e.event_id!==event.eventId||hash(event)!==e.event_sha256||
   Number(e.sequence)!==event.sequence||event.sequence>Number(r.last_sequence)||!same(event.binding,b)||!same(event.scopes,run.scopes)||event.type!=='run.status'||event.data.state!==run.state)refuse('RUN_INDEX_CORRUPT');
  if(r.sdk_usage!=null&&hash(r.sdk_usage)!==r.sdk_usage_sha256)refuse('RUN_INDEX_CORRUPT');
  const usage=projectRecordedUsage(r.sdk_usage??null,{conversationId:b.conversationId,runId:b.runId});
  const summary={conversationId:b.conversationId,runId:b.runId,createdAt:new Date(run.createdAt).toISOString(),state:run.state,statusAt:new Date(event.createdAt).toISOString(),lastSequence:Number(r.last_sequence),
   clientIds:[...new Set(run.scopes.filter(s=>s.kind==='client').map(s=>s.resourceId))].sort(),
   usage:{recording:usage.recording==='not-recorded'?'not-recorded':usage.usage.status,sdkEstimateUsd:usage.usage?.status==='recorded'?usage.usage.runDelta.sdkEstimateUsd:null,providerBilledUsd:null},
   references:{conversationId:b.conversationId,runId:b.runId}};
  return {conversation,summary};
 }catch(error){if(['CONVERSATION_NOT_FOUND','RUN_INDEX_CORRUPT'].includes(productFailure(error)?.code))throw error;refuse('RUN_INDEX_CORRUPT');}
}
