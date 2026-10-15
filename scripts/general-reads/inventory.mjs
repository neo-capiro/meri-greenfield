/** Pure inventory construction over decoded sources. No IO; deterministic output. */

export const SCHEMA = 'meri-general-reads-inventory/1';
/** Contract groups whose operations are Meri product state or effects rather than Capiro source reads. */
export const PRODUCT_GROUPS = Object.freeze(['artifacts', 'schedule-tools', 'client-knowledge-attachments', 'memory-proposals']);
export const GOVERNED_WRITE_GROUPS = Object.freeze(['command-tools']);
/** Adapter families in the product owner's requested integration order. */
export const ADAPTER_FAMILY_ORDER = Object.freeze(['mail', 'meeting-source', 'action-items-complete', 'operational-reads',
  'tenant-contacts', 'entity-candidates', 'client-knowledge-profile', 'client-documents', 'client-knowledge-memory',
  'client-knowledge-monday', 'dataset-metadata', 'memory-proposals', 'research-portfolio-evidence']);
const GENERIC_CONTEXT = Object.freeze(['nowMs', 'actorId']);
const BASE_READ_CHECKS = Object.freeze(['gateway.current-tool-authority', 'gateway.dispatch-rechecks']);

const fail = message => { throw Object.assign(new Error(message), {code: 'INVENTORY_INVALID'}); };
const key = op => `${op.id}@${op.version}`;
const sorted = values => [...values].sort();

function kindOf(original, scopeRow, binding) {
  if (original.disposition === 'deferred') return scopeRow.readOnly ? 'read' : 'governed-write';
  if (GOVERNED_WRITE_GROUPS.includes(binding.group)) return 'governed-write';
  if (PRODUCT_GROUPS.includes(binding.group)) return 'product-operation';
  return 'read';
}

function dispatchContext(descriptor, binding, supported) {
  if (descriptor.sideEffect !== 'none') return `governed-path:${binding.dispatchProfile}`;
  // A read whose profile the gateway read dispatcher does not accept runs on its product owner's path.
  if (binding.dispatchProfile) return supported.includes(binding.dispatchProfile) ? `supported:${binding.dispatchProfile}` : `product-path:${binding.dispatchProfile}`;
  if (binding.contextKeys === null || binding.contextKeys.every(name => GENERIC_CONTEXT.includes(name))) return 'generic';
  return `missing:${binding.contextKeys.join(',')}`;
}

export function buildInventory(sources) {
  const {catalog, scopeRows, skills, adapters, routes, bindings, dispatchProfiles, admittedSkills} = sources;
  const descriptors = new Map(catalog.operations.map(row => [row.operation.id, row]));
  const scopeById = new Map(scopeRows.map(row => [row.id, row]));
  if (scopeById.size !== scopeRows.length) fail('Duplicate scope ledger rows');

  const adapterByOp = new Map();
  for (const adapter of adapters.adapters) for (const id of adapter.operations) {
    if (!descriptors.has(id)) fail(`Adapter ${adapter.path} declares unknown operation ${id}`);
    if (adapterByOp.has(id)) fail(`Operation ${id} has two adapters`);
    adapterByOp.set(id, adapter);
  }
  const skillsByOp = new Map();
  for (const skill of skills) for (const ref of skill.operations) {
    const id = ref.slice(0, ref.lastIndexOf('@'));
    if (!descriptors.has(id) || key(descriptors.get(id).operation) !== ref) fail(`Skill ${skill.skillId} references unknown ${ref}`);
    skillsByOp.set(id, sorted(new Set([...(skillsByOp.get(id) ?? []), skill.skillId])));
  }

  const operations = catalog.operations.map(row => {
    const id = row.operation.id, binding = bindings.get(id), adapter = adapterByOp.get(id) ?? null;
    const context = dispatchContext(row, binding, dispatchProfiles);
    const usedBy = skillsByOp.get(id) ?? [];
    return {
      id, version: row.operation.version, displayName: row.displayName, group: binding.group,
      sideEffect: row.sideEffect, approvalBoundary: row.approvalBoundary, requiredGrants: row.requiredGrants,
      aliases: row.aliases, replacement: row.replacement ? row.replacement.id : null,
      availability: row.availability, qualification: row.qualification, handler: row.handler,
      dispatchProfile: binding.dispatchProfile, contextKeys: binding.contextKeys, commandAction: binding.action,
      dispatchContext: context,
      adapter: adapter ? adapter.path : 'missing',
      authorization: row.sideEffect !== 'none' ? 'governed-path' : [...BASE_READ_CHECKS, `dispatch:${context}`,
        ...(adapter ? adapter.adapterChecks : ['adapter:missing'])],
      skills: usedBy, runtimeAdmittedSkills: usedBy.filter(s => admittedSkills.includes(s)),
      inputSchema: row.inputSchema.id, outputSchema: row.outputSchema.id,
      live: false,
    };
  });
  const operationById = new Map(operations.map(op => [op.id, op]));

  const capabilities = catalog.originals.map(original => {
    const scopeRow = scopeById.get(original.id);
    if (!scopeRow) fail(`Scope ledger lacks ${original.id}`);
    if (scopeRow.disposition !== original.disposition) fail(`Disposition mismatch for ${original.id}`);
    if (original.disposition === 'deferred') {
      if (original.replacement !== null || descriptors.has(original.id)) fail(`Deferred ${original.id} has a contract`);
      return {id: original.id, disposition: 'deferred', registry: {readOnly: scopeRow.readOnly, backend: scopeRow.backend, surfaces: scopeRow.surfaces},
        kind: kindOf(original, scopeRow, null), operations: [], adapter: 'none (deferred)', authorization: 'none (deferred)',
        availability: 'deferred', qualification: 'deferred', skills: [], route: 'none (deferred)', skillWiring: 'none', live: false};
    }
    const replacement = original.replacement?.id;
    if (!replacement || !descriptors.has(replacement)) fail(`Selected ${original.id} lacks a replacement contract`);
    const contracts = [{id: replacement, relation: replacement === original.id ? 'same-name' : 'renamed'}];
    const historical = descriptors.get(original.id);
    if (historical && original.id !== replacement) {
      if (historical.replacement?.id !== replacement) fail(`Historical ${original.id} does not point at ${replacement}`);
      contracts.push({id: original.id, relation: 'historical-superseded'});
    }
    const primary = operationById.get(replacement), binding = bindings.get(replacement);
    const kind = kindOf(original, scopeRow, binding);
    const mapped = contracts.map(c => operationById.get(c.id));
    const skillIds = sorted(new Set(mapped.flatMap(op => op.skills)));
    const admitted = sorted(new Set(mapped.flatMap(op => op.runtimeAdmittedSkills)));
    const adapterPaths = sorted(new Set(mapped.map(op => op.adapter).filter(p => p !== 'missing')));
    const productRoute = routes.routes[original.id];
    if (kind !== 'read' && !productRoute) fail(`Product operation ${original.id} lacks a route`);
    const withAdapter = mapped.some(op => op.adapter !== 'missing' && op.runtimeAdmittedSkills.length);
    return {
      id: original.id, disposition: 'selected',
      registry: {readOnly: scopeRow.readOnly, backend: scopeRow.backend, surfaces: scopeRow.surfaces},
      kind, operations: contracts,
      adapter: adapterPaths.length ? adapterPaths : 'missing',
      authorization: kind === 'read' || productRoute?.route === 'general-read-server' ? primary.authorization : productRoute.authority,
      availability: primary.availability, qualification: primary.qualification, handler: primary.handler,
      skills: skillIds,
      route: productRoute ? (productRoute.intentTool ? `${productRoute.route}:${productRoute.intentTool}` : productRoute.route) : 'general-read-server',
      routeStatus: productRoute ? productRoute.status : (primary.adapter === 'missing' ? 'adapter missing' : 'adapter present (unqualified)'),
      skillWiring: withAdapter ? 'source-level: runtime-admitted skill + adapter (no SDK->gateway->backend test)'
        : admitted.length ? 'source-level: runtime-admitted skill, adapter missing'
        : skillIds.length ? 'manifest-only: skill not admitted by the worker skill runtime' : 'none',
      live: false,
    };
  });

  const counts = summarize(capabilities, operations, scopeRows, adapters);
  const deferredIds = capabilities.filter(c => c.disposition === 'deferred').map(c => c.id);
  return {
    schema: SCHEMA,
    note: 'Generated by scripts/general-reads/cli.mjs. Source evidence only: every operation is unimplemented/pending with a null handler; nothing here is live, enabled or qualified.',
    catalog: {catalogId: catalog.catalogId, catalogVersion: catalog.catalogVersion, sourceRegistryCommit: catalog.sourceRegistryCommit},
    provenance: sources.provenance,
    gatewayDispatchProfiles: dispatchProfiles,
    workerAdmittedSkills: admittedSkills,
    counts,
    mapping: mappingExplanation(capabilities, operations),
    reconciliation: reconcile(capabilities, operations, skills, sources.originalManifestPaths),
    families: families(capabilities, operations),
    deferredToolReferences: deferredReferences(deferredIds, sources.scannedTexts, catalog.operations),
    capabilities, operations,
  };
}

function tally(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort());
}

function summarize(capabilities, operations, scopeRows, adapters) {
  const selected = capabilities.filter(c => c.disposition === 'selected');
  return {
    legacyCapabilities: capabilities.length,
    selected: selected.length, deferred: capabilities.length - selected.length,
    scopeLedger: {rows: scopeRows.length, selected: scopeRows.filter(r => r.disposition === 'selected').length,
      deferred: scopeRows.filter(r => r.disposition === 'deferred').length},
    operationContracts: operations.length,
    selectedByKind: tally(selected.map(c => c.kind)),
    deferredByKind: tally(capabilities.filter(c => c.disposition === 'deferred').map(c => c.kind)),
    operationsBySideEffect: tally(operations.map(o => o.sideEffect)),
    operationsByAvailability: tally(operations.map(o => `${o.availability}/${o.qualification}`)),
    adapters: adapters.adapters.length,
    operationsWithAdapter: operations.filter(o => o.adapter !== 'missing').length,
    selectedWithAdapter: selected.filter(c => c.adapter !== 'missing').length,
    selectedReadsWithAdapter: selected.filter(c => c.kind === 'read' && c.adapter !== 'missing').length,
    selectedReadsWithoutAdapter: selected.filter(c => c.kind === 'read' && c.adapter === 'missing').length,
    readOperationsByDispatchContext: tally(operations.filter(o => o.sideEffect === 'none')
      .map(o => o.dispatchContext.split(':')[0])),
    live: capabilities.filter(c => c.live).length,
  };
}

function mappingExplanation(capabilities, operations) {
  const selected = capabilities.filter(c => c.disposition === 'selected');
  const replacementIds = selected.map(c => c.operations[0].id);
  const referenced = new Set(selected.flatMap(c => c.operations.map(o => o.id)));
  const targets = tally(selected.flatMap(c => c.operations.map(o => o.id)));
  return {
    rule: 'Each selected legacy capability has exactly one catalog replacement contract; a legacy id that is also a retained contract id adds that historical contract.',
    selectedCapabilities: selected.length,
    distinctReplacementContracts: new Set(replacementIds).size,
    sameName: selected.filter(c => c.operations[0].relation === 'same-name').length,
    renamed: selected.filter(c => c.operations[0].relation === 'renamed')
      .map(c => ({legacy: c.id, contract: c.operations[0].id})),
    oneToMany: selected.filter(c => c.operations.length > 1)
      .map(c => ({legacy: c.id, contracts: c.operations.map(o => `${o.id} (${o.relation})`)})),
    manyToOne: Object.entries(targets).filter(([, n]) => n > 1).map(([id]) => id),
    contractsWithoutLegacyCapability: operations.map(o => o.id).filter(id => !referenced.has(id)),
    historicalContractsBeyondReplacements: operations.filter(o => !replacementIds.includes(o.id))
      .map(o => ({id: o.id, supersededBy: o.replacement})),
    equation: `${new Set(replacementIds).size} replacement contracts + ${operations.length - new Set(replacementIds).size} retained historical contract = ${operations.length}`,
  };
}

function reconcile(capabilities, operations, skills, originalManifestPaths) {
  const selected = capabilities.filter(c => c.disposition === 'selected');
  const originalsDirSkills = skills.filter(s => originalManifestPaths.includes(s.manifestPath));
  const method = (label, skillSet) => {
    const opIds = new Set(skillSet.flatMap(s => s.operations.map(ref => ref.slice(0, ref.lastIndexOf('@')))));
    const unusedByName = selected.filter(c => !opIds.has(c.id));
    const renamedReached = unusedByName.filter(c => opIds.has(c.operations[0].id));
    const rest = unusedByName.filter(c => !opIds.has(c.operations[0].id));
    const product = rest.filter(c => c.kind !== 'read'), reads = rest.filter(c => c.kind === 'read');
    return {
      method: label, skills: skillSet.map(s => s.skillId),
      selectedNotNamedBySkills: unusedByName.length,
      reachedThroughRenamedContracts: renamedReached.map(c => `${c.id} -> ${c.operations[0].id}`),
      productOperationsAndGovernedWrites: product.map(c => `${c.id} (${c.kind})`),
      readsWithoutSkillRoute: reads.map(c => c.id),
      readsWithoutSkillRouteWithAdapter: reads.filter(c => c.adapter !== 'missing').map(c => c.id),
      readsWithoutSkillRouteWithoutAdapter: reads.filter(c => c.adapter === 'missing').map(c => c.id),
      summary: `${unusedByName.length} = ${product.length} product/governed + ${reads.length} reads without a skill route + ${renamedReached.length} reached through renamed contracts`,
    };
  };
  return {
    earlierClaim: '49 selected not used by skill manifests = 14 product operations + 29 reads with no route + 6 legacy mail/meeting names reached through renamed contracts',
    originalsDirectory: method('legacy names vs the 13 manifests under packages/skills/originals', originalsDirSkills),
    fullSkillIndex: method('legacy names vs all 14 manifests in packages/skills/assets.json (adds Bill Watch)', skills),
    productStateReads: selected.filter(c => c.kind === 'product-operation' && operations.find(o => o.id === c.operations[0].id).sideEffect === 'none').map(c => c.id),
  };
}

function families(capabilities, operations) {
  const groups = new Map();
  for (const op of operations) {
    const row = groups.get(op.group) ?? {group: op.group, operations: [], adapters: new Set(), legacy: new Set(), skills: new Set(), dispatch: new Set(), sideEffects: new Set()};
    row.operations.push(op.id); if (op.adapter !== 'missing') row.adapters.add(op.adapter);
    op.skills.forEach(s => row.skills.add(s)); row.dispatch.add(op.dispatchContext); row.sideEffects.add(op.sideEffect);
    groups.set(op.group, row);
  }
  for (const c of capabilities) for (const o of c.operations) groups.get(operations.find(op => op.id === o.id).group).legacy.add(c.id);
  const rows = [...groups.values()].map(row => ({group: row.group, operations: row.operations,
    legacyCapabilities: sorted(row.legacy), adapters: sorted(row.adapters), skills: sorted(row.skills),
    dispatchContexts: sorted(row.dispatch), readOnly: [...row.sideEffects].every(s => s === 'none'),
    product: PRODUCT_GROUPS.includes(row.group) || GOVERNED_WRITE_GROUPS.includes(row.group)}));
  const reads = rows.filter(r => r.readOnly);
  const withAdapters = ADAPTER_FAMILY_ORDER.map(g => reads.find(r => r.group === g)).filter(Boolean);
  if (withAdapters.some(r => !r.adapters.length)) fail('Adapter family order names a family without an adapter');
  // Without adapters: dispatch context already supplied first, then most skill demand, then name.
  const order = (a, b) => Number(a.dispatchContexts.some(d => d.startsWith('missing'))) - Number(b.dispatchContexts.some(d => d.startsWith('missing'))) ||
    b.skills.length - a.skills.length || a.group.localeCompare(b.group);
  const rest = reads.filter(r => !ADAPTER_FAMILY_ORDER.includes(r.group));
  if (rest.some(r => r.adapters.length)) fail('A family with an adapter is missing from the adapter order');
  const sourceReads = rest.filter(r => !r.product).sort(order), productReads = rest.filter(r => r.product).sort(order);
  return {
    integrationOrder: [...withAdapters.map((r, i) => ({phase: 1, step: i + 1, group: r.group})),
      ...sourceReads.map((r, i) => ({phase: 2, step: i + 1, group: r.group})),
      ...productReads.map((r, i) => ({phase: 3, step: i + 1, group: r.group}))],
    rows: rows.sort((a, b) => a.group.localeCompare(b.group)),
  };
}

/** Deferred legacy tool names appearing in model-visible source text or catalog descriptors. */
function deferredReferences(deferredIds, scannedTexts, descriptors) {
  const pattern = new RegExp(`\\b(${deferredIds.join('|')})\\b`, 'g'), found = [];
  for (const {path, text} of scannedTexts) for (const match of text.matchAll(pattern))
    found.push({where: `${path}:${text.slice(0, match.index).split('\n').length}`, tool: match[1]});
  for (const row of descriptors) {
    const text = JSON.stringify([row.displayName, row.whenToUse, row.limitations, row.positiveExamples, row.negativeExamples]);
    for (const match of text.matchAll(pattern)) found.push({where: `catalog descriptor ${row.operation.id}`, tool: match[1]});
  }
  return found;
}
