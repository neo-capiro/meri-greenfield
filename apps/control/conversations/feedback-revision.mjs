/** Exact persisted event and SDK evidence. Selected UI model and text are never inputs. */
import {hash,same,fail,terminal} from './boundary.mjs';
import {assertConversationEvent} from '../../../packages/contracts/conversation-sources/validate.mjs';
import {projectRecordedUsage} from './usage-read/projection.mjs';
import {CONVERSATION_USAGE_SCHEMA,usageCounterNames} from '../../../packages/contracts/conversation-usage/protocol.mjs';

export function feedbackRevision(run,rows,input){
 const b=run.projection.binding;
 if(!terminal(run.projection.state)||input.target.throughSequence!==Number(run.last_sequence))fail('FEEDBACK_REVISION_CHANGED');
 let sequence=0;
 for(const row of rows){
  const e=row.event;assertConversationEvent(e);
  if(hash(e)!==row.event_sha256||row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId||
   row.event_id!==e.eventId||Number(row.sequence)!==e.sequence||e.sequence!==++sequence||!same(e.binding,b)||!same(e.scopes,run.projection.scopes))fail('STORE_CORRUPT');
 }
 if(sequence!==Number(run.last_sequence))fail('STORE_CORRUPT');
 const events=rows.map(row=>row.event),target=input.target;
 let revision;
 if(target.kind==='message'){
  const parts=events.filter(e=>e.type==='message.delta'&&e.data.messageId===target.messageId);
  if(!parts.length)fail('FEEDBACK_TARGET_REFUSED');
  revision={sha256:hash({messageId:target.messageId,events:parts.map(e=>e.eventId),text:parts.map(e=>e.data.text).join('')}),artifact:{status:'not_applicable',reason:'message_target'}};
 }else{
  const event=events.find(e=>e.type==='artifact.available'&&e.data.artifactId===target.artifactId&&e.data.versionId===target.versionId);
  if(!event)fail('FEEDBACK_TARGET_REFUSED');
  revision={sha256:hash(event),artifact:{status:'bound',artifactId:event.data.artifactId,versionId:event.data.versionId}};
 }
 let sourceRevision={status:'not_applicable',reason:'no_source_selected'};
 if(input.sourceEventId!==null){
  const source=events.find(e=>e.eventId===input.sourceEventId&&['source.available','source.native-bill-text','source.native-hearing-record','source.native-upload'].includes(e.type));
  if(!source)fail('FEEDBACK_SOURCE_REFUSED');
  if(source.type==='source.available'&&source.data.scopes.some(scope=>!run.projection.scopes.some(parent=>same(parent,scope))))fail('FEEDBACK_SOURCE_REFUSED');
  sourceRevision={status:'bound',eventId:source.eventId,eventSha256:hash(source)};
 }
 const linkedReceipts=events.filter(e=>['approval.required','checkpoint.verified'].includes(e.type)).map(e=>({kind:e.type==='approval.required'?'approval_request':'completion',eventId:e.eventId,eventSha256:hash(e)}));
 if(linkedReceipts.length>100)fail('FEEDBACK_TARGET_REFUSED');
 return {revision,sourceRevision,taskRevision:{status:'not_applicable',reason:'no_native_task_revision_on_target'},execution:feedbackExecution(run),linkedReceipts};
}

export function feedbackExecution(run){
 const usage=run.sdk_usage;
 if(usage==null){if(run.sdk_usage_sha256!=null)fail('STORE_CORRUPT');return {status:'unavailable',reason:'usage_not_recorded'};}
 if(hash(usage)!==run.sdk_usage_sha256)fail('STORE_CORRUPT');
 const b=run.projection.binding;
 const projected=projectRecordedUsage(usage,{schemaVersion:CONVERSATION_USAGE_SCHEMA,conversationId:b.conversationId,runId:b.runId});
 if(!projected.usage.runDelta)return {status:'unavailable',reason:'run_model_delta_unavailable'};
 const models=projected.usage.runDelta.modelCounters.filter(c=>usageCounterNames.some(key=>c[key]>0)).map(c=>c.model).sort();
 if(!models.length)return {status:'unavailable',reason:'run_model_delta_unavailable'};
 return {status:'recorded',basis:'run_sdk_usage',usageSha256:run.sdk_usage_sha256,sessionId:usage.cumulative.sessionId,models,attribution:'run_including_subagents'};
}
