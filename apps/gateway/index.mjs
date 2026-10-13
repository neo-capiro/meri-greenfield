/** Source-disabled production composition. No listeners, live adapters or activation toggle. */
import catalog from '../../packages/contracts/retrieval-0.2/catalog.json' with { type: 'json' };
import * as contracts from '../../packages/contracts/retrieval-0.2/validate.mjs';
import { createRuntimeCatalog } from './catalog/runtime-catalog.mjs';
import { createCurrentToolAuthority } from './authorization/current-tool-authority.mjs';
import { createToolDispatch } from './dispatch/tool-dispatch.mjs';
import { deny } from './dispatch/operation-result.mjs';

/** Shared fresh authority only; this does not register or execute a command. */
export function createCommandAuthority(options) {
  if (!options || Object.keys(options).some(key => !['authorityPorts', 'now', 'maxFactBytes'].includes(key))) deny('GATEWAY_CONFIGURATION');
  const { authorityPorts, now, maxFactBytes } = options;
  return createCurrentToolAuthority({ ports: authorityPorts, now, maxFactBytes, capabilityAction: 'command.execute' });
}

export function createSourceDisabledGateway(options) {
  if (!options || Object.keys(options).some(key => !['authorityPorts', 'budget', 'limits', 'now', 'newId'].includes(key))) deny('GATEWAY_CONFIGURATION');
  const { authorityPorts, budget, limits, now, newId } = options;
  const authority = createCurrentToolAuthority({ ports: authorityPorts, now, maxFactBytes: limits?.maxResponseBytes });
  const view = createRuntimeCatalog({ catalogJson: JSON.stringify(catalog), contracts });
  const dispatcher = createToolDispatch({ catalog: view, authority, budget, limits, now, newId, sourceEnabled: false });
  return Object.freeze({ ...dispatcher, sourceEnabled: false,
    status: 'SOURCE_ONLY_NO_PRODUCTION_ADAPTERS', catalogVersion: view.catalogVersion });
}

import { createDurableToolDispatch } from './budget/durable-tool-dispatch.mjs';
import { allocation as parseBudgetAllocation } from './budget/tool-budget-binding.mjs';
import { canonicalSha256 } from '../../packages/contracts/validate.mjs';

/** Concrete durable-budget entry; canonical source connectivity remains disabled. */
export function createDurableSourceDisabledGateway(options) {
  if (!options || Object.keys(options).some(key => !['authorityPorts', 'pool', 'allocationJson', 'limits', 'now', 'newId'].includes(key))) deny('GATEWAY_CONFIGURATION');
  const { authorityPorts, pool, allocationJson, limits, now, newId } = options;
  if (parseBudgetAllocation(allocationJson).catalogSha256 !== canonicalSha256(catalog)) deny('GATEWAY_CONFIGURATION');
  const authority = createCurrentToolAuthority({ ports: authorityPorts, now, maxFactBytes: limits?.maxResponseBytes });
  const view = createRuntimeCatalog({ catalogJson: JSON.stringify(catalog), contracts });
  const dispatcher = createDurableToolDispatch({ pool, allocationJson, catalog: view, authority,
    limits, now, newId, sourceEnabled: false });
  return Object.freeze({ ...dispatcher, sourceEnabled: false,
    status: 'SOURCE_ONLY_DURABLE_BUDGET_NO_PRODUCTION_ADAPTERS', catalogVersion: view.catalogVersion });
}

/** Trusted application composition; this export does not activate any source. */
export {createPostgresBudgetExecution} from './budget/postgres-tool-budget.mjs';

/** Read-only persisted current state; requires independently active canonical admission. */
export {createPostgresAdmittedRunOwner} from './budget/admitted-run-owner.mjs';

/** Fixed read capability action; uses the same canonical current authority owner. */
export function createReadAuthority(options) {
  if (!options || Object.keys(options).some(key => !['authorityPorts', 'now', 'maxFactBytes'].includes(key))) deny('GATEWAY_CONFIGURATION');
  const {authorityPorts,now,maxFactBytes}=options;
  return createCurrentToolAuthority({ports:authorityPorts,now,maxFactBytes,capabilityAction:'tool.read'});
}
export {createTaskLookupAuthorizer} from './authorization/task-lookup-authorizer.mjs';

/** Explicit owned fixture only; this does not enable the production catalog. */
export {createQualificationActionGateway,qualificationActionTransport} from './qualification/action-gateway.mjs';
export {validateQualificationGrantSet} from './budget/admitted-run-binding.mjs';
