/** Bounded saved-message projection over the canonical transcript reader. No new storage or authorization owner. */
import {EXPORT_SCHEMA,conversationHistoryMetadata} from '../../../../packages/contracts/conversation-history/protocol.mjs';
import {refuse} from '../../product-access/errors.mjs';
import {same} from '../boundary.mjs';

export async function exportConversationMessages({read,call,now=Date.now}){
 const limits=conversationHistoryMetadata.export,turns=new Map(),prompts=new Set();
 let after=0,throughSequence,conversation,textBytes=0,messageCount=0;
 const charge=text=>{textBytes+=Buffer.byteLength(text);if(textBytes>limits.textBytes)refuse('CONVERSATION_EXPORT_TOO_LARGE');};
 do{
  call.signal?.throwIfAborted();
  const before=after;
  const page=await read({...call,request:{conversationId:call.request.conversationId,after,limit:100}});
  if(throughSequence===undefined){throughSequence=page.lastSequence;conversation=page.conversation;
   if(throughSequence>limits.events)refuse('CONVERSATION_EXPORT_TOO_LARGE');
  }else if(!same(conversation,page.conversation)||page.lastSequence<throughSequence)refuse('CONVERSATION_STORE_CORRUPT');
  const metadata=new Map(page.turns.map(t=>[t.run.binding.runId,t]));
  for(const {sequence,event} of page.events){
   if(sequence>throughSequence)break;
   if(sequence!==after+1)refuse('CONVERSATION_STORE_CORRUPT');
   after=sequence;
   const runId=event.binding.runId,source=metadata.get(runId);
   if(!source)refuse('CONVERSATION_STORE_CORRUPT');
   let turn=turns.get(runId);
   if(!turn){
    if(turns.size>=limits.turns)refuse('CONVERSATION_EXPORT_TOO_LARGE');
    const prompt=prompts.has(source.promptLineage.logicalRequestId)?null:source.request.prompt;
    if(prompt!==null)charge(prompt);
    prompts.add(source.promptLineage.logicalRequestId);
    turn={runId,prompt,messages:new Map()};turns.set(runId,turn);
   }
   // Tool results, uploads, source payloads, approvals and execution internals are deliberately outside this export.
   if(event.type==='message.delta'){
    const {messageId,text}=event.data;charge(text);
    if(!turn.messages.has(messageId)&&++messageCount>limits.messages)refuse('CONVERSATION_EXPORT_TOO_LARGE');
    turn.messages.set(messageId,(turn.messages.get(messageId)??'')+text);
   }
  }
  if(after===before||after<throughSequence&&!page.hasMore)refuse('CONVERSATION_STORE_CORRUPT');
 }while(after<throughSequence);
 const exportedAt=now();
 const result={schema:EXPORT_SCHEMA,conversation,throughSequence,exportedAt:new Date(exportedAt).toISOString(),expiresAt:new Date(exportedAt+limits.lifetimeMs).toISOString(),
  turns:[...turns.values()].map(t=>({...t,messages:[...t.messages].map(([messageId,text])=>({messageId,text}))}))};
 if(Buffer.byteLength(JSON.stringify(result))>conversationHistoryMetadata.limits.responseBytes)refuse('CONVERSATION_EXPORT_TOO_LARGE');
 return result;
}
