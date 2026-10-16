/** Read-only prompt identity from canonical stored continuation envelopes. No UI identity or text-based deduplication. */
import {assertContinuationEnvelope} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {hash,same,own,uuid} from '../boundary.mjs';
import {refuse} from '../../product-access/errors.mjs';
export function promptLineages(runs){
 try{
  const result=new Map();
  for(const row of runs){const binding=row.projection.binding;uuid(row.request.requestId);
   let lineage={kind:'submission',logicalRequestId:row.request.requestId,sourceBinding:null,sourceRequestId:null};
   if(row.continuation!==null&&row.continuation!==undefined){
    if(hash(row.continuation)!==row.continuation_sha256)throw Error('integrity');
    const saved=own(row.continuation,['continuation','sourceRequest']),envelope=assertContinuationEnvelope(saved.continuation),sourceBinding=envelope.checkpoint.binding;uuid(saved.sourceRequest.requestId);
    if(hash(saved.sourceRequest)!==envelope.sourceRequestSha256||hash({window:saved.sourceRequest.window,skill:saved.sourceRequest.skill,scopes:row.projection.scopes})!==envelope.contextSha256||!same({...saved.sourceRequest,requestId:row.request.requestId},row.request)||
     sourceBinding.tenantId!==binding.tenantId||sourceBinding.actorId!==binding.actorId||!same(envelope.checkpoint.scopes,row.projection.scopes)||
     !same(envelope.checkpoint.versions,row.projection.versions))throw Error('integrity');
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
