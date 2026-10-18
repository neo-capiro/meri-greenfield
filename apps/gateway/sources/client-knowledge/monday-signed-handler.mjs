/** Monday's task-bound source handler; dispatch owns reservation and final release. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {assertResult,frozenData,knowledgeContract,ownFields,readContext} from './request-context.mjs';

const invocation=(value)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);

export function createMondaySignedReadHandler(options) {
  const {operation:reference,adapter,now}=ownFields(options,['operation','adapter','now']);
  const {operation}=knowledgeContract(reference),{read}=ownFields(adapter,['read']);
  if(operation.id!=='read_monday_client_boards'||typeof read!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
  return async function execute(call) {
    try {
      const fields=ownFields(call,['input','request','authority','normalizationContext','argumentsSha256','invocationId'],['signal']);
      if(!invocation(fields.invocationId))deny('ACCESS_DENIED');
      const sourceCall={operation,input:fields.input,request:fields.request,authority:fields.authority,
        normalizationContext:fields.normalizationContext,...(fields.signal===undefined?{}:{signal:fields.signal})};
      const context=readContext(sourceCall,now);
      if(fields.argumentsSha256!==context.argumentsSha256)deny('INVALID_ARGUMENTS');
      context.active();
      const result=frozenData(await read.call(adapter,{...sourceCall,invocationId:fields.invocationId}));
      context.active();assertResult(result,context);
      const output=JSON.stringify({binding:context.authority.binding,subject:context.authority.subject,operation,
        argumentsSha256:context.argumentsSha256,result});
      context.active();return output;
    }catch(error){throw safeFailure(error);}
  };
}
