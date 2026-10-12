/** Actual internal handler; only the canonical dispatcher owns authorization/release. */
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { validateShape } from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import { deny, safeFailure } from '../../dispatch/operation-result.mjs';
import { frozenData, operation, ownFields, readContext } from './request-context.mjs';

export function createMemoryProposalReadHandler(options) {
  const {adapter,now}=ownFields(options,['adapter','now']);
  if(!adapter||typeof adapter.read!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
  return async function execute(call) {
    try {
      const fields=ownFields(call,['input','request','authority','argumentsSha256'],['signal']);
      const context=readContext({input:fields.input,authority:fields.authority,signal:fields.signal},now);
      const request=frozenData(fields.request);validateShape('MemoryProposalInput',request);
      if(typeof fields.argumentsSha256!=='string'||fields.argumentsSha256!==canonicalSha256(context.input))deny('INVALID_ARGUMENTS');
      // Request/history normalization is owned by the dispatcher; this repeats only
      // the visible raw-selection correlation, without a second cursor validator.
      if((request.clientId!=null&&request.clientId!==context.input.clientId)||
          (request.cursor??null)!==context.input.cursor||(request.limit??5)!==context.input.limit)deny('INVALID_ARGUMENTS');
      const result=frozenData(await adapter.read({input:context.input,authority:context.authority,signal:context.signal}));
      if(context.signal?.aborted)deny('CANCELLED');if(now()>=context.deadlineMs)deny('DEADLINE');
      validateShape('MemoryProposalReadResult',result);
      return JSON.stringify({binding:context.authority.binding,subject:context.authority.subject,operation,
        argumentsSha256:fields.argumentsSha256,result});
    }catch(error){throw safeFailure(error);}
  };
}
