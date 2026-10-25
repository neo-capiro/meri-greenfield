/** Read-only prompt identity from canonical stored continuation envelopes. No UI identity or text-based deduplication.
 * `custody` is the canonical continuation owner's verification of each continued run's exact stored envelope in the same
 * transaction; a continued row without it is refused rather than projected from the row alone. */
import {assertContinuationEnvelope} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {hash,same,own,uuid} from '../boundary.mjs';
import {refuse} from '../../product-access/errors.mjs';
export function promptLineages(runs,custody){
 try{
  const result=new Map();
  for(const row of runs){const binding=row.projection.binding;uuid(row.request.requestId);
   let lineage={kind:'submission',logicalRequestId:row.request.requestId,sourceBinding:null,sourceRequestId:null};
   if(row.continuation!==null&&row.continuation!==undefined){
    if(hash(row.continuation)!==row.continuation_sha256)throw Error('integrity');
    const saved=own(row.continuation,['continuation','sourceRequest']),envelope=assertContinuationEnvelope(saved.continuation),verified=custody?.get(row.run_id);
    if(verified===undefined||!same(verified,envelope))throw Error('integrity');
    // A native envelope's captured source versions are the canonical control proof's, and the source->target relationship is
    // continuesSession; both are the continuation owner's predicate, so they are never re-derived here. The historical
    // checkpoint envelope keeps its own exact captured-version identity.
    const source=envelope.kind==='native-session'?{binding:envelope.sdkSession.binding,scopes:envelope.scopes}:envelope.checkpoint;
    const sourceBinding=source.binding;uuid(saved.sourceRequest.requestId);
    if(hash(saved.sourceRequest)!==envelope.sourceRequestSha256||hash({window:saved.sourceRequest.window,skill:saved.sourceRequest.skill,scopes:row.projection.scopes})!==envelope.contextSha256||!same({...saved.sourceRequest,requestId:row.request.requestId},row.request)||
     sourceBinding.tenantId!==binding.tenantId||sourceBinding.actorId!==binding.actorId||!same(source.scopes,row.projection.scopes)||
     envelope.kind!=='native-session'&&!same(source.versions,row.projection.versions))throw Error('integrity');
    let logicalRequestId=row.request.requestId;
    if(envelope.mode==='resume'){
     const source=runs.find(r=>r.run_id===sourceBinding.runId),prior=result.get(sourceBinding.runId);
     if(!source||!prior||!same(source.projection.binding,sourceBinding)||!same(source.request,saved.sourceRequest)||
      sourceBinding.conversationId!==binding.conversationId||sourceBinding.writerFence>=binding.writerFence)throw Error('integrity');
     logicalRequestId=prior.logicalRequestId;
    }else if(sourceBinding.conversationId===binding.conversationId||binding.writerFence!==1)throw Error('integrity');
    lineage={kind:envelope.mode,logicalRequestId,sourceBinding,sourceRequestId:saved.sourceRequest.requestId};
   }else if(row.continuation_sha256!==null&&row.continuation_sha256!==undefined)throw Error('integrity');
   if(result.has(binding.runId))throw Error('integrity');result.set(binding.runId,Object.freeze(lineage));
  }
  return result;
 }catch{refuse('CONVERSATION_STORE_CORRUPT');}
}
