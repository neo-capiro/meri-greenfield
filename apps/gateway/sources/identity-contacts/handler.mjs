/** Thin canonical handler; current policy, budget, release remain with gateway dispatch. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {identityContactsContract,readContext,assertIdentityContactsResult,frozenData,ownFields} from './request-context.mjs';
export function createIdentityContactsReadHandler(options){
 const {operation:reference,adapter,now}=ownFields(options,['operation','adapter','now']);
 const {operation}=identityContactsContract(reference),{read}=ownFields(adapter,['read']);
 if(typeof read!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
 return async function execute(call){try{
  const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  const context=readContext({operation,input:fields.input,request:fields.request,authority:fields.authority,normalizationContext:fields.normalizationContext,...(fields.signal===undefined?{}:{signal:fields.signal})},now);
  if(fields.argumentsSha256!==context.argumentsSha256)deny('INVALID_ARGUMENTS');context.active();
  const result=frozenData(await read.call(adapter,{operation,input:context.input,request:context.request,authority:context.authority,normalizationContext:context.normalizationContext,...(context.signal===undefined?{}:{signal:context.signal})}));
  assertIdentityContactsResult(result,context);const output=JSON.stringify(result);context.active();return output;
 }catch(error){throw safeFailure(error);}};
}
