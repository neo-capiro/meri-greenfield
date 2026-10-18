/** Selected-client handler; canonical dispatch still owns current authority and release. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields,operation,readContext} from './request-context.mjs';
import {projectActionItems} from './projection.mjs';
export function createActionItemsReadHandler(options) {
  const {adapter,now,newId}=ownFields(options,['adapter','now','newId']);
  const {read}=ownFields(adapter,['read']);
  if(typeof read!=='function'||typeof now!=='function'||typeof newId!=='function')deny('GATEWAY_CONFIGURATION');
  return async function execute(call) {
    try {
      const fields=ownFields(call,['input','request','authority','argumentsSha256','invocationId'],['signal']);
      const context=readContext({input:fields.input,request:fields.request,authority:fields.authority,
        invocationId:fields.invocationId,signal:fields.signal},now);
      if(fields.argumentsSha256!==context.argumentsSha256)deny('INVALID_ARGUMENTS');
      context.active();
      const native=await read({input:context.input,request:context.request,authority:context.authority,
        invocationId:context.invocationId,signal:context.signal});
      context.active();const requestId=newId();context.active();const traceId=newId();
      const result=projectActionItems(native,context,{requestId,traceId,retrievedAt:new Date(context.active()).toISOString()});
      context.active();
      const output=JSON.stringify(frozenData({binding:context.authority.binding,subject:context.authority.subject,operation,
        argumentsSha256:fields.argumentsSha256,result}));
      context.active();return output;
    }catch(error){throw safeFailure(error);}
  };
}
