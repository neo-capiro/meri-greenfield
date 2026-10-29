/** Core owns request identity and actor access; retention owns cleanup proof.
 * Only content-free observations cross this boundary, even after metadata and
 * conversation rows have been removed. */
import {refuse} from '../../product-access/errors.mjs';
import {assertConversationHistoryResponse} from '../../../../packages/contracts/conversation-history/validate.mjs';
const reference=value=>Object.fromEntries(['version','requestId','createdAt','conversationId','revision','restoreUntil'].map(key=>[key,value[key]]));
export function createConversationDeletionService({status}){
 const required=core=>{if(typeof core?.deletions!=='function'||typeof core?.deletion!=='function')refuse('CONVERSATION_UNAVAILABLE');};
 return Object.freeze({
  async list({management:core,request}){required(core);return core.deletions(request);},
  async read({management:core,request}){required(core);return core.deletion(request);},
  async release({principal,request,result,management:core,signal,deadlineMs,recheckMembership,publish}){
   required(core);
   if(typeof status?.withStatus!=='function')refuse('CONVERSATION_UNAVAILABLE');
   return status.withStatus({principal,reference:result,signal,deadlineMs},async(observation,assertCurrent)=>{
    await recheckMembership();
    const current=await core.deletion(request);
    if(JSON.stringify(reference(current))!==JSON.stringify(reference(result))||current.metadataState!==result.metadataState)refuse('CONVERSATION_UNAVAILABLE');
    await assertCurrent();
    signal?.throwIfAborted();
    return publish(assertConversationHistoryResponse('deletionStatus',{...reference(current),...observation},request));
   });
  },
 });
}
