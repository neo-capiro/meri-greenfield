/** Source-disabled production composition. No listeners, live adapters or activation toggle. */
import catalog from '../../packages/contracts/retrieval-0.2/catalog.json' with { type: 'json' };
import * as contracts from '../../packages/contracts/retrieval-0.2/validate.mjs';
import { createRuntimeCatalog } from './catalog/runtime-catalog.mjs';
import { createCurrentToolAuthority } from './authorization/current-tool-authority.mjs';
import { createToolDispatch } from './dispatch/tool-dispatch.mjs';
import { deny } from './dispatch/operation-result.mjs';

export function createSourceDisabledGateway(options) {
  if (!options || Object.keys(options).some(key => !['authorityPorts', 'budget', 'limits', 'now', 'newId'].includes(key))) deny('GATEWAY_CONFIGURATION');
  const { authorityPorts, budget, limits, now, newId } = options;
  const authority = createCurrentToolAuthority({ ports: authorityPorts, now, maxFactBytes: limits?.maxResponseBytes });
  const view = createRuntimeCatalog({ catalogJson: JSON.stringify(catalog), contracts });
  const dispatcher = createToolDispatch({ catalog: view, authority, budget, limits, now, newId, sourceEnabled: false });
  return Object.freeze({ ...dispatcher, sourceEnabled: false,
    status: 'SOURCE_ONLY_NO_PRODUCTION_ADAPTERS', catalogVersion: view.catalogVersion });
}
