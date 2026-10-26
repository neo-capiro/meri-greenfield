import canonicalize from 'canonicalize';
const same=(a,b)=>canonicalize(a)===canonicalize(b);
/** Receiving checks bind the response to the sent request, never grant authority. */
export function assertFeedbackResponse(route,result,request,current,fail){
 const receipts=route==='feedback'?[result.receipt]:result.receipts,ids=new Set(),requests=new Set();
 if(route==='feedback-read'&&result.runId!==request.runId)fail('FEEDBACK_RESPONSE_MISMATCH');
 for(const r of receipts){
  if(r.target.runId!==(route==='feedback'?request.target.runId:request.runId)||
   current&&(r.conversationId!==current.binding.conversationId||r.actorId!==current.binding.actorId)||
   ids.has(r.feedbackId)||requests.has(r.requestId))fail('FEEDBACK_RESPONSE_MISMATCH');
  if((r.target.kind==='artifact')!==(r.revision.artifact.status==='bound'))fail('FEEDBACK_RESPONSE_MISMATCH');
  if(r.target.kind==='artifact'&&(r.revision.artifact.artifactId!==r.target.artifactId||r.revision.artifact.versionId!==r.target.versionId))fail('FEEDBACK_RESPONSE_MISMATCH');
  if(new Set(r.linkedReceipts.map(e=>e.eventId)).size!==r.linkedReceipts.length)fail('FEEDBACK_RESPONSE_MISMATCH');
  ids.add(r.feedbackId);requests.add(r.requestId);
 }
 if(route==='feedback'){
  const r=result.receipt,source=r.sourceRevision.status==='bound'?r.sourceRevision.eventId:null;
  if(r.requestId!==request.requestId||!same(r.target,request.target)||!same(r.signal,request.signal)||source!==request.sourceEventId)fail('FEEDBACK_RESPONSE_MISMATCH');
 }
 return result;
}
