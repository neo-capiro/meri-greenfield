import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFeedbackShape} from '../conversation-application/feedback-validate.mjs';
import {assertFeedbackResponse} from '../conversation-application/feedback-semantics.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,sha='a'.repeat(64);
const request={requestId:id(1),target:{kind:'message',runId:id(2),throughSequence:7,messageId:id(3)},sourceEventId:null,signal:{kind:'preference',value:'helpful',note:null}};
const receipt={feedbackId:id(4),requestId:id(1),conversationId:id(5),actorId:'actor',recordedAt:'2026-10-26T00:00:00.000Z',target:request.target,signal:request.signal,
 revision:{sha256:sha,artifact:{status:'not_applicable',reason:'message_target'}},sourceRevision:{status:'not_applicable',reason:'no_source_selected'},
 taskRevision:{status:'not_applicable',reason:'no_native_task_revision_on_target'},execution:{status:'unavailable',reason:'usage_not_recorded'},
 disposition:{status:'recorded',review:'not_reviewed',effect:'none'},linkedReceipts:[]};
const fail=code=>{throw Error(code);};
test('public feedback schema accepts three distinct signals and refuses authority/model claims',()=>{
 for(const signal of [request.signal,{kind:'factual_correction',proposedCorrection:'Correct date'},{kind:'recommendation',recommendation:'Add context'}])assertFeedbackShape('ConversationFeedbackRequest',{...request,signal});
 for(const extra of [{modelId:'selected'},{approved:true},{training:true},{taskRevisionId:id(6)}])assert.throws(()=>assertFeedbackShape('ConversationFeedbackRequest',{...request,...extra}));
 for(const disposition of [{status:'accepted',review:'not_reviewed',effect:'none'},{status:'recorded',review:'reviewed',effect:'applied'}])assert.throws(()=>assertFeedbackShape('ConversationFeedbackReceipt',{...receipt,disposition}));
});
test('response receiving binds request, source, actor, conversation and target; duplicates cannot become readback',()=>{
 const current={binding:{conversationId:id(5),actorId:'actor'}},response={receipt,replayed:false};
 assertFeedbackShape('ConversationFeedbackResponse',response);assertFeedbackResponse('feedback',response,request,current,fail);
 for(const patch of [{requestId:id(8)},{target:{...request.target,runId:id(9)}},{signal:{kind:'preference',value:'not_helpful',note:null}},{actorId:'other'},{conversationId:id(10)},{sourceRevision:{status:'bound',eventId:id(11),eventSha256:sha}},{revision:{sha256:sha,artifact:{status:'bound',artifactId:id(12),versionId:id(13)}}}])assert.throws(()=>assertFeedbackResponse('feedback',{receipt:{...receipt,...patch},replayed:false},request,current,fail),/MISMATCH/);
 assert.throws(()=>assertFeedbackResponse('feedback-read',{runId:id(2),receipts:[receipt,receipt]},{runId:id(2)},current,fail),/MISMATCH/);
 assert.throws(()=>assertFeedbackResponse('feedback-read',{runId:id(9),receipts:[]},{runId:id(2)},current,fail),/MISMATCH/);
});
