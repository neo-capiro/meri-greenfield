/** Private transport wrapper; raw family DTOs and their truth limits are unchanged. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { assertResultLineage, deny, exactKeys } from './operation-result.mjs';

export function assertDispatchResult({ entry, output, authority, normalized, context }) {
  let result = output;
  if (entry.contract.binding?.dispatchProfile === 'memory-proposals/1') {
    exactKeys(output, ['binding', 'subject', 'operation', 'argumentsSha256', 'result'], 'INVALID_RESULT');
    if (canonicalSha256(output.operation) !== canonicalSha256(entry.descriptor.operation) ||
        output.argumentsSha256 !== normalized.argumentsSha256) deny('INVALID_RESULT');
    result = output.result;
  }
  try { entry.contract.assertOutput(result, { request: normalized.request, ...context.options(authority) }); }
  catch { deny('INVALID_RESULT'); }
  assertResultLineage(output, authority);
  return result;
}
