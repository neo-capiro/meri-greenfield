/** Internal execution seam; production catalog remains source-disabled. */
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { normalizeResearchPortfolioEvidenceInput, assertResearchPortfolioEvidenceOutput } from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import { ownFields, frozenData } from '../source-admission.mjs';
import { deny, safeFailure } from '../../dispatch/operation-result.mjs';
import { evidenceContext, operation } from './request-context.mjs';

export function createResearchPortfolioEvidenceHandler(options) {
  const {adapter,now} = ownFields(options,['adapter','now']);
  if (!adapter || typeof adapter.read !== 'function' || typeof now !== 'function') deny('GATEWAY_CONFIGURATION');
  return async function execute(call) {
    try {
      const fields = ownFields(call,['input','request','authority','argumentsSha256'],['signal']);
      const context = evidenceContext({input:fields.input,authority:fields.authority,signal:fields.signal},now);
      const request = frozenData(fields.request), options = {binding:context.authority.binding,subject:context.authority.subject};
      const normalized = normalizeResearchPortfolioEvidenceInput(operation.id,request,options);
      if (canonicalSha256(normalized.input) !== canonicalSha256(context.input) ||
          fields.argumentsSha256 !== canonicalSha256(context.input)) deny('INVALID_ARGUMENTS');
      const page = await adapter.read({input:context.input,authority:context.authority,signal:context.signal});
      if (context.signal?.aborted) deny('CANCELLED');
      if (now() >= context.deadlineMs) deny('DEADLINE');
      return JSON.stringify(assertResearchPortfolioEvidenceOutput(operation.id,page,request,options));
    } catch (error) { throw safeFailure(error); }
  };
}
