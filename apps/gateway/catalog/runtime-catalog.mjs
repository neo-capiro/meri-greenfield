/** Immutable catalog view; no parallel operation validators or dynamic imports. */
import { assertCatalog } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { deny, parseRawJson } from '../dispatch/operation-result.mjs';

const freeze = value => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const key = operation => `${operation.id}@${operation.version}`;

/** Internal trusted composition only; production index supplies no handlers. */
export function createRuntimeCatalog({ catalogJson, contracts, handlers = new Map() }) {
  const catalog = parseRawJson(catalogJson, 16*1024*1024, 'GATEWAY_CONFIGURATION');
  try { assertCatalog(catalog); } catch { deny('GATEWAY_CONFIGURATION'); }
  if (!contracts || !(handlers instanceof Map)) deny('GATEWAY_CONFIGURATION');
  freeze(catalog);
  const table = new Map([...handlers].map(([id, handler]) => [id, handler &&
    Object.freeze({ sourceSha256: handler.sourceSha256, execute: handler.execute })]));
  const descriptors = new Map(catalog.operations.map(descriptor => [key(descriptor.operation), descriptor]));
  function entry(operation) {
    const descriptor = descriptors.get(key(operation));
    if (!descriptor || descriptor.availability !== 'enabled' || descriptor.qualification !== 'qualified' ||
        descriptor.handler === null || descriptor.sideEffect !== 'none' || descriptor.approvalBoundary !== 'none') return null;
    const handler = table.get(key(operation));
    if (!handler || typeof handler.execute !== 'function' || handler.sourceSha256 !== descriptor.handler.sourceSha256) return null;
    if (typeof contracts.resolveOperationContract !== 'function') deny('GATEWAY_CONFIGURATION');
    const contract = contracts.resolveOperationContract(operation);
    if (!contract || typeof contract.normalizeInput !== 'function' || typeof contract.assertOutput !== 'function' ||
        canonicalSha256(contract.descriptor) !== canonicalSha256(descriptor)) deny('GATEWAY_CONFIGURATION');
    return Object.freeze({ descriptor, contract, execute: handler.execute });
  }
  return Object.freeze({ entry,
    discoverable: () => catalog.operations.map(row => entry(row.operation)).filter(Boolean),
    catalogVersion: catalog.catalogVersion });
}
