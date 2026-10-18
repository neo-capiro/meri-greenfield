/** Canonical meeting page handler; current policy, budget and release stay in dispatch. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields,meetingContract,readContext,assertMeetingResult} from './request-context.mjs';

export function createMeetingReadHandler(options) {
  const {operation:reference,adapter,now}=ownFields(options,['operation','adapter','now']);
  const {operation}=meetingContract(reference),{read}=ownFields(adapter,['read']);
  if(typeof read!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
  return async function execute(call) {
    try {
      const fields=ownFields(call,['input','request','authority','argumentsSha256'],['signal','invocationId']);
      const context=readContext({operation,input:fields.input,request:fields.request,authority:fields.authority,
        ...(fields.signal===undefined?{}:{signal:fields.signal}),...(fields.invocationId===undefined?{}:{invocationId:fields.invocationId})},now);
      if(fields.argumentsSha256!==canonicalSha256(context.input))deny('INVALID_ARGUMENTS');
      context.active();
      const result=frozenData(await read.call(adapter,{operation,input:context.input,request:context.request,
        authority:context.authority,...(context.signal===undefined?{}:{signal:context.signal}),
        ...(context.invocationId===undefined?{}:{invocationId:context.invocationId})}));
      assertMeetingResult(result,context);
      const output=JSON.stringify(result);context.active();return output;
    } catch(error) {throw safeFailure(error);}
  };
}
