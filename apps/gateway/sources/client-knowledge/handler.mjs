/** Thin actual source handler; dispatcher owns grant rechecks, budgets and final release. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {assertResult,frozenData,knowledgeContract,ownFields,readContext} from './request-context.mjs';
export function createClientKnowledgeReadHandler(options) {
  const {operation:reference,adapter,now}=ownFields(options,['operation','adapter','now']);
  const {operation}=knowledgeContract(reference),{read}=ownFields(adapter,['read']);
  if(typeof read!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
  return async function execute(call) {
    try {
      const fields=ownFields(call,['input','request','authority','normalizationContext','argumentsSha256'],['signal']);
      const context=readContext({operation,input:fields.input,request:fields.request,authority:fields.authority,
        normalizationContext:fields.normalizationContext,signal:fields.signal},now);
      if(fields.argumentsSha256!==context.argumentsSha256)deny('INVALID_ARGUMENTS');
      context.active();const result=frozenData(await read.call(adapter,{operation,input:context.input,request:context.request,
        authority:context.authority,normalizationContext:context.normalizationContext,signal:context.signal}));
      context.active();assertResult(result,context);
      const output=JSON.stringify({binding:context.authority.binding,subject:context.authority.subject,operation,
        argumentsSha256:context.argumentsSha256,result});context.active();return output;
    }catch(error){throw safeFailure(error);}
  };
}
