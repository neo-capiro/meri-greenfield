/** Thin original handler; existing dispatch owns authorization, reservation and release. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {originalTrackingContract,readContext,ownFields,frozenData} from './request-context.mjs';
import {projectOriginalTrackingPage} from './projection.mjs';
export function createOriginalTrackingReadHandler(options) {
  const {operation:reference,adapter,now,newId}=ownFields(options,['operation','adapter','now','newId']);
  const {operation}=originalTrackingContract(reference),{read}=ownFields(adapter,['read']);
  if(typeof read!=='function'||typeof now!=='function'||typeof newId!=='function')deny('GATEWAY_CONFIGURATION');
  return async function execute(call) {
    try {
      const fields=ownFields(call,['input','request','authority','argumentsSha256'],['signal','normalizationContext']);
      const {argumentsSha256,...sourceCall}=fields;
      const context=readContext({operation,...sourceCall},now);
      if(argumentsSha256!==context.argumentsSha256)deny('INVALID_ARGUMENTS');context.active();
      const native=await read.call(adapter,{input:context.input,request:context.request,authority:context.authority,normalizationContext:context.normalizationContext,
        ...(context.signal===undefined?{}:{signal:context.signal})});
      context.active();const requestId=newId();context.active();const traceId=newId();context.active();
      const page=projectOriginalTrackingPage(native,context,{requestId,traceId,retrievedAt:new Date(context.active()).toISOString()});
      const output=JSON.stringify(frozenData(page));context.active();return output;
    }catch(error){throw safeFailure(error);}
  };
}
