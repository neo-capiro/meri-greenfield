/** Native save_memory preparation submits one pending candidate through the governed producer. It never creates a task approval. */
import {randomUUID} from 'node:crypto';
import {normalizeMemoryProposeInput,assertMemoryProposeCommand} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {intentFault} from '../intents/faults.mjs';
export const MEMORY_COMMAND_OPERATION=Object.freeze({id:'save_memory',version:'0.2.0'});
export function createMemoryIntentPreparer({source,binding,scopes,selectedClientId,newId=randomUUID}){
 const selected=data({binding,scopes,selectedClientId});assertNativeConversationScope(selected);
 if(typeof source?.propose!=='function'||typeof newId!=='function')throw intentFault('INTENT_CONFIGURATION');
 const context=data({binding,conversationClientId:selectedClientId});
 return Object.freeze({owner:'memory',operation:MEMORY_COMMAND_OPERATION,binding:selected.binding,
  async prepare(value){
   const {arguments:raw,deliveryId,signal}=own(value,['arguments','deliveryId'],['signal']);
   let command;
   try{
    if(typeof deliveryId!=='string'||!/^sdk:[a-f0-9]{64}$/u.test(deliveryId))throw Error();
    const request=data(raw);if(Object.hasOwn(request,'clientId'))throw Error();
    command=assertMemoryProposeCommand({contractVersion:'0.1.0',commandId:newId(),idempotencyKey:newId(),binding:selected.binding,
     action:'memory.propose',arguments:normalizeMemoryProposeInput(request,context),attachments:[],scopes:selected.scopes},context);
   }catch{throw intentFault('INVALID_ARGUMENTS','none');}
   const result=await source.propose({command,signal});
   return data({status:'review_pending',binding:selected.binding,scopes:selected.scopes,result});
  },
 });
}