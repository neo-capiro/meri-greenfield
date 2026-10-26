/** Run-owned immutable feedback. No new event stream, review authority or learning promotion. */
import {randomUUID} from 'node:crypto';
import {bounded,hash,same,fail,validateShape} from './boundary.mjs';
import {assertFeedbackShape} from '../../../packages/contracts/conversation-application/feedback-validate.mjs';
import {MAX_RUN_FEEDBACK} from '../../../packages/contracts/conversation-application/feedback-schema.mjs';
import {feedbackRevision} from './feedback-revision.mjs';

export function createFeedbackJournal({tx,rowRun,retentionGate,now=Date.now,newId=randomUUID}){
 async function run(c,context,runId,check){
  const b=context.binding;
  const rows=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,runId])).rows;check();
  if(rows.length!==1)fail('FEEDBACK_TARGET_REFUSED');const r=rowRun(rows[0]);
  if(r.projection.binding.actorId!==b.actorId||!same(r.projection.scopes,context.scopes))fail('SCOPE_REFUSED');
  return r;
 }
 function saved(r){
  if(r.feedback==null){if(r.feedback_sha256!=null)fail('STORE_CORRUPT');return [];}
  if(hash(r.feedback)!==r.feedback_sha256||!Array.isArray(r.feedback)||r.feedback.length>MAX_RUN_FEEDBACK)fail('STORE_CORRUPT');
  const ids=new Set(),requests=new Set();
  for(const receipt of r.feedback){
   try{assertFeedbackShape('ConversationFeedbackReceipt',receipt);}catch{fail('STORE_CORRUPT');}
   if(receipt.conversationId!==r.conversation_id||receipt.target.runId!==r.run_id||receipt.actorId!==r.projection.binding.actorId||
    ids.has(receipt.feedbackId)||requests.has(receipt.requestId))fail('STORE_CORRUPT');
   ids.add(receipt.feedbackId);requests.add(receipt.requestId);
  }
  return r.feedback;
 }
 const options=b=>({beforeConversation:retentionGate?()=>retentionGate.assertServable({tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId}):undefined});
 async function read(context,raw,check){
  validateShape('RunBinding',context.binding);const input=assertFeedbackShape('ConversationFeedbackReadRequest',raw);
  return tx(context.binding,check,async c=>({runId:input.runId,receipts:saved(await run(c,context,input.runId,check))}),options(context.binding));
 }
 async function record(context,raw,check){
  validateShape('RunBinding',context.binding);const input=assertFeedbackShape('ConversationFeedbackRequest',raw);
  return tx(context.binding,check,async c=>{
   const r=await run(c,context,input.target.runId,check),receipts=saved(r),old=receipts.find(value=>value.requestId===input.requestId);
   if(old){
    const original={requestId:old.requestId,target:old.target,sourceEventId:old.sourceRevision.status==='bound'?old.sourceRevision.eventId:null,signal:old.signal};
    if(!same(original,input))fail('FEEDBACK_REPLAY_REFUSED');return {receipt:old,replayed:true};
   }
   if(receipts.length===MAX_RUN_FEEDBACK)fail('FEEDBACK_LIMIT');
   if(Number(r.last_sequence)>10000)fail('FEEDBACK_TARGET_REFUSED');
   const b=r.projection.binding;
   const rows=(await c.query('SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 ORDER BY sequence LIMIT 10001',[b.tenantId,b.conversationId,b.runId])).rows;check();
   const evidence=feedbackRevision(r,rows,input);
   const receipt=assertFeedbackShape('ConversationFeedbackReceipt',{
    feedbackId:newId(),requestId:input.requestId,conversationId:b.conversationId,actorId:context.binding.actorId,
    recordedAt:new Date(now()).toISOString(),target:input.target,signal:input.signal,...evidence,
    disposition:{status:'recorded',review:'not_reviewed',effect:'none'},
   });
   const next=bounded([...receipts,receipt],2097152);
   const updated=(await c.query('UPDATE meri_conversations.runs SET feedback=$4,feedback_sha256=$5 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 RETURNING feedback_sha256',[b.tenantId,b.conversationId,b.runId,next,hash(next)])).rows;check();
   if(updated.length!==1||updated[0].feedback_sha256!==hash(next))fail('STORE_CORRUPT');
   return {receipt,replayed:false};
  },options(context.binding));
 }
 return Object.freeze({read,record});
}
