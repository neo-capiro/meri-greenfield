/** Governed proposal read. Current authority and final release stay in dispatch. */
import {validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {frozenData,operation,ownFields,readContext} from './request-context.mjs';

export function createMemoryProposalReadHandler(options){
 const {adapter,now}=ownFields(options,['adapter','now']);
 const {read}=ownFields(adapter,['read']);
 if(typeof read!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
 return async function execute(call){
  try{
   const fields=ownFields(call,['input','request','authority','argumentsSha256','invocationId'],['signal']);
   const context=readContext({input:fields.input,authority:fields.authority,
    invocationId:fields.invocationId,signal:fields.signal},now);
   const request=frozenData(fields.request);validateShape('MemoryProposalInput',request);
   if(fields.argumentsSha256!==context.argumentsSha256||
      request.clientId!=null&&request.clientId!==context.input.clientId||
      (request.cursor??null)!==context.input.cursor||
      (request.limit??5)!==context.input.limit)deny('INVALID_ARGUMENTS');
   context.active();
   const result=frozenData(await read({input:context.input,authority:context.authority,
    invocationId:context.invocationId,signal:context.signal}));
   context.active();validateShape('MemoryProposalReadResult',result);
   return JSON.stringify({binding:context.authority.binding,subject:context.authority.subject,
    operation,argumentsSha256:fields.argumentsSha256,result});
  }catch(error){throw safeFailure(error);}
 };
}
