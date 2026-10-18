/** Canonical client evidence handler; current policy, budget and release stay in dispatch. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields,clientEvidenceContract,readContext,assertClientEvidenceResult} from './request-context.mjs';

export function createClientEvidenceReadHandler(options) {
  const {operation:reference,adapter,now}=ownFields(options,['operation','adapter','now']);
  const {operation}=clientEvidenceContract(reference),{read}=ownFields(adapter,['read']);
  if(typeof read!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
  return async function execute(call) {
    try {
      const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal','invocationId']);
      const context=readContext({operation,input:fields.input,request:fields.request,authority:fields.authority,normalizationContext:fields.normalizationContext,
        ...(fields.signal===undefined?{}:{signal:fields.signal}),...(fields.invocationId===undefined?{}:{invocationId:fields.invocationId})},now);
      if(fields.argumentsSha256!==canonicalSha256(context.input))deny('INVALID_ARGUMENTS');
      context.active();
      const result=frozenData(await read.call(adapter,{operation,input:context.input,request:context.request,
        authority:context.authority,normalizationContext:context.options,...(context.signal===undefined?{}:{signal:context.signal}),
        ...(context.invocationId===undefined?{}:{invocationId:context.invocationId})}));
      assertClientEvidenceResult(result,context);
      const output=JSON.stringify(operation.id==='get_client_context'?{binding:context.authority.binding,
        subject:context.authority.subject,operation,argumentsSha256:context.argumentsSha256,result}:result);context.active();return output;
    } catch(error) {throw safeFailure(error);}
  };
}
