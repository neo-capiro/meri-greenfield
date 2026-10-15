/** Pure final-scope ledger construction over decoded sources. No IO; deterministic output. */
import {rowReconciliation, reconcile} from './reconcile.mjs';

export const SCHEMA = 'meri-final-scope-ledger/1';
const OWNERSHIP_STATES = Object.freeze(['owned', 'partial', 'unowned']);
const fail = message => { throw Object.assign(new Error(message), {code: 'SCOPE_LEDGER_INVALID'}); };
const sortedEqual = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function tally(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort());
}

function phaseOf(inventory, group) {
  const step = inventory.families.integrationOrder.find(entry => entry.group === group);
  return step ? `${step.phase}.${step.step}` : null;
}

function includedGates(capability, operation, route) {
  const gates = [];
  if (capability.route === 'general-read-server') {
    gates.push('READ-ADAPTER');
    if (operation.dispatchContext.startsWith('missing:')) gates.push('READ-CONTEXT');
    gates.push('READ-SERVER', 'READ-QUALIFICATION');
    if (capability.operations.length > 1) gates.push('SKILL-SUCCESSOR');
    if (capability.kind === 'product-operation') gates.push('STARTUP-COMPOSITION');
  } else {
    gates.push('INTENT-ROUTE', 'STARTUP-COMPOSITION');
    if (route.owner.startsWith('apps/control/document-application/')) {
      if (capability.routeStatus.startsWith('route-gap')) gates.push('ARTIFACT-ADMISSION');
      gates.push('ARTIFACT-NATIVE');
      if (capability.id === 'run_analysis') gates.push('ANALYSIS-SANDBOX');
    }
    if (route.owner.startsWith('apps/control/schedules/') && operation.sideEffect !== 'none') gates.push('SCHEDULE-DISPATCH');
    if (route.owner.startsWith('apps/control/commands/')) gates.push('COMMAND-G5');
  }
  if (operation.group === 'memory-proposals' || operation.commandAction === 'memory.propose') gates.push('MEMORY-PRODUCER');
  gates.push('DEPLOY-G1-G7');
  return gates;
}

function openItems(capability, operation, scopeRow) {
  const items = [];
  if (capability.route === 'general-read-server') {
    items.push('general read server not built (proposal)');
    if (capability.adapter === 'missing') items.push('adapter missing');
    if (operation.dispatchContext.startsWith('missing:')) items.push(`trusted dispatch context missing: ${operation.dispatchContext.slice(8)}`);
  } else items.push('governed intent surface needs approval (P10)');
  if (capability.routeStatus.startsWith('route-gap')) items.push(capability.routeStatus);
  if (capability.routeStatus.includes('personal scope blocked')) items.push('personal-scope producer unavailable');
  if (capability.skillWiring.startsWith('manifest-only')) items.push('declaring skills not admitted by the worker skill runtime');
  if (capability.operations.length > 1) items.push('skills declare the historical contract; successor decision P7');
  if (scopeRow.owner === 'A/C' && capability.route === 'general-read-server')
    items.push('scope owner A/C (browser lane): confirm gateway adapter versus browser session, with no second path');
  return items;
}

function includedRow(capability, sources, maps) {
  const {inventory, routes} = sources;
  const operation = maps.operations.get(capability.operations[0].id);
  const csvRow = maps.csv.get(capability.id);
  if (!csvRow) fail(`Coverage CSV lacks included ${capability.id}`);
  if (csvRow.canonicalId !== operation.id || csvRow.version !== operation.version || csvRow.sideEffect !== operation.sideEffect)
    fail(`Coverage CSV disagrees with the inventory on ${capability.id}`);
  if (!sortedEqual(csvRow.declaredBySkills, operation.skills)) fail(`Declaring skills differ for ${capability.id}`);
  if (csvRow.declaredCurrentContract !== operation.skills.length > 0) fail(`Declared flag differs for ${capability.id}`);
  const literal = maps.operations.get(capability.id)?.skills.length > 0;
  const scopeRow = maps.scope.get(capability.id), route = routes[capability.id];
  return {
    id: capability.id, decision: 'included',
    decisionBasis: 'Selected in the accepted 10 Oct 2026 scope and not excluded by the 15 Oct 2026 owner direction; required under the latest "complete it all" direction.',
    historicalDisposition: 'selected', registry: capability.registry, kind: capability.kind, sideEffect: operation.sideEffect,
    contracts: capability.operations.map(c => ({id: c.id, version: maps.operations.get(c.id).version, relation: c.relation})),
    declaration: {currentContractDeclared: csvRow.declaredCurrentContract, declaredBySkills: csvRow.declaredBySkills,
      runtimeAdmittedSkills: operation.runtimeAdmittedSkills,
      historicalContractDeclaredBy: capability.operations.length > 1 ? maps.operations.get(capability.operations[1].id).skills : []},
    adapter: capability.adapter, dispatchContext: operation.dispatchContext,
    route: capability.route, routeStatus: capability.routeStatus, skillWiring: capability.skillWiring,
    integrationPhase: phaseOf(inventory, operation.group), family: operation.group,
    ownerLane: scopeRow.owner,
    canonicalOwner: route ? route.owner : capability.adapter !== 'missing' ? capability.adapter.join(', ')
      : `unallocated gateway adapter for family ${operation.group} (lane B); Core endpoint (dot)`,
    verifier: 'dot (lane D independent verification)',
    gates: includedGates(capability, operation, route),
    openItems: openItems(capability, operation, scopeRow),
    reconciliation: rowReconciliation(capability, operation, csvRow, literal),
    live: false,
  };
}

function excludedRow(capability, group, references, neutralize) {
  const named = references.filter(ref => ref.tools.includes(capability.id));
  return {
    id: capability.id, decision: 'excluded',
    decisionBasis: 'Product owner direction, 15 Oct 2026 (see ownerDirection). Distinct from the 10 Oct 2026 historical deferral.',
    historicalDisposition: 'deferred', ownerExclusionGroup: group, registry: capability.registry, kind: capability.kind,
    contracts: [], declaration: {currentContractDeclared: false, declaredBySkills: []},
    adapter: 'none (excluded)', route: 'none (excluded; never registered)', ownerLane: 'none (excluded)',
    canonicalOwner: 'Fable enforces non-registration and no implementation; dot keeps the catalog original deferred with replacement null',
    verifier: 'dot (lane D independent verification)',
    gates: ['EXCLUDED-NEVER-REGISTERED', 'EXCLUDED-NO-IMPLEMENTATION', ...(neutralize ? ['EXCLUDED-NEUTRALIZE-GUIDANCE'] : []), 'EXCLUDED-RELEASE-NOTES'],
    references: named.map(ref => ({path: ref.path, class: ref.class})),
    implementationFound: false, live: false,
  };
}

function classifyReferences(sources) {
  const known = new Map(sources.ownerExclusion.knownReferences.map(ref => [ref.path, ref]));
  const classes = sources.ownerExclusion.referenceClasses;
  for (const ref of known.values()) if (!classes[ref.class]) fail(`Unknown reference class ${ref.class} for ${ref.path}`);
  return sources.references.map(ref => {
    const entry = known.get(ref.path);
    if (!entry) fail(`Unclassified file names an excluded tool: ${ref.path} (${ref.tools.join(', ')}); delete an accidental implementation or classify the reference`);
    return {path: ref.path, tools: ref.tools, class: entry.class, ...(entry.alsoCarries ? {alsoCarries: entry.alsoCarries} : {})};
  });
}

function validateProductCapabilities(sources) {
  const byScopeRow = new Map();
  for (const row of sources.productCapabilities) {
    if ((row.scopeRow === null) === !row.title) fail(`Product capability ${row.id} needs exactly one of scopeRow or title`);
    for (const gate of row.gates) if (!sources.gates[gate]) fail(`Product capability ${row.id} names unknown gate ${gate}`);
    if (row.scopeRow !== null) {
      if (byScopeRow.has(row.scopeRow)) fail(`Scope row ${row.scopeRow} appears twice`);
      byScopeRow.set(row.scopeRow, row);
    }
  }
  for (const required of sources.requiredCapabilities) {
    const row = byScopeRow.get(required.capability);
    if (!row) fail(`Required product capability missing from the ledger: ${required.capability}`);
    if (row.plannedOwner !== required.plannedOwner) fail(`Planned owner differs for ${required.capability}`);
    if (row.acceptance !== required.acceptance) fail(`Acceptance text differs for ${required.capability}`);
  }
  if (byScopeRow.size !== sources.requiredCapabilities.length) fail('Ledger names a scope row that the scope document lacks');
  return sources.productCapabilities;
}

function validateOwnershipGraph(sources) {
  const {domains} = sources.ownershipGraph;
  if (new Set(domains.map(d => d.id)).size !== domains.length) fail('Duplicate ownership domain');
  for (const domain of domains) {
    if (!OWNERSHIP_STATES.includes(domain.ownedToday)) fail(`Bad ownership state for ${domain.id}`);
    for (const entry of [...domain.sourceModules, ...domain.persistence]) {
      const path = typeof entry === 'string' ? entry : entry.path;
      if ((typeof entry === 'string' || entry.atBase !== false) && !sources.exists(path)) fail(`Ownership path missing at base: ${path}`);
    }
  }
  return {status: sources.ownershipGraph.status, domains,
    summary: Object.fromEntries(OWNERSHIP_STATES.map(state => [state, domains.filter(d => d.ownedToday === state).map(d => d.id)]))};
}

export function buildLedger(sources) {
  const {inventory, coverage, scopeRows, ownerExclusion} = sources;
  const maps = {
    operations: new Map(inventory.operations.map(op => [op.id, op])),
    csv: new Map(coverage.rows.map(row => [row.legacyId, row])),
    scope: new Map(scopeRows.map(row => [row.id, row])),
  };
  const excludedGroup = new Map(ownerExclusion.groups.flatMap(group => group.tools.map(tool => [tool, group.name])));
  if (excludedGroup.size !== ownerExclusion.groups.reduce((n, group) => n + group.tools.length, 0)) fail('Owner exclusion list repeats a name');
  const deferred = inventory.capabilities.filter(c => c.disposition === 'deferred').map(c => c.id);
  if (!sortedEqual([...excludedGroup.keys()], deferred)) fail('Owner exclusion list differs from the 43 historically deferred capabilities');
  if (!sortedEqual(scopeRows.filter(r => r.disposition === 'deferred').map(r => r.id), deferred)) fail('Scope ledger deferred rows differ from the inventory');
  if (coverage.rows.some(row => excludedGroup.has(row.legacyId))) fail('Coverage CSV names an excluded capability');

  const references = classifyReferences(sources);
  const neutralize = new Set(inventory.deferredToolReferences.map(ref => ref.tool));
  const capabilities = inventory.capabilities.map(capability => {
    if (capability.disposition === 'selected') return includedRow(capability, sources, maps);
    if (capability.operations.length) fail(`Excluded ${capability.id} maps to a contract`);
    return excludedRow(capability, excludedGroup.get(capability.id), references, neutralize.has(capability.id));
  });
  for (const row of capabilities) for (const gate of row.gates) if (!sources.gates[gate]) fail(`${row.id} names unknown gate ${gate}`);
  const included = capabilities.filter(r => r.decision === 'included'), excluded = capabilities.filter(r => r.decision === 'excluded');
  if (included.length !== coverage.rows.length) fail('Included capabilities differ from the coverage CSV rows');

  const productCapabilities = validateProductCapabilities(sources);
  const ownershipGraph = validateOwnershipGraph(sources);
  const usedGates = new Set([...capabilities.flatMap(r => r.gates), ...productCapabilities.flatMap(r => r.gates)]);
  for (const id of Object.keys(sources.gates)) if (!usedGates.has(id)) fail(`Gate ${id} is defined but no row names it`);
  return {
    schema: SCHEMA,
    note: 'Generated by scripts/scope-ledger/cli.mjs. Scope decisions, owners and gates only: every capability is unimplemented or unqualified and nothing is live, enabled or accepted. Proposals for dot are marked as such.',
    provenance: sources.provenance,
    coverageOrigin: sources.coverageOrigin,
    ownerDirection: ownerExclusion.direction,
    counts: {
      legacyCapabilities: capabilities.length, included: included.length, excluded: excluded.length,
      includedByKind: tally(included.map(r => r.kind)), includedByAuditKind: tally(included.map(r => r.reconciliation.auditKind)),
      includedByOwnerLane: tally(included.map(r => r.ownerLane)), includedByRoute: tally(included.map(r => r.route.split(':')[0])),
      excludedByGroup: Object.fromEntries(ownerExclusion.groups.map(group => [group.name, group.tools.length])),
      excludedByRegistryKind: tally(excluded.map(r => r.kind)),
      excludedImplementationsFound: excluded.filter(r => r.implementationFound).length,
      excludedReferenceFiles: tally(references.map(r => r.class)),
      productCapabilities: productCapabilities.length,
      ownershipDomains: Object.fromEntries(Object.entries(ownershipGraph.summary).map(([state, ids]) => [state, ids.length])),
      live: capabilities.filter(r => r.live).length,
    },
    reconciliation: reconcile(included, inventory),
    gates: Object.fromEntries(Object.entries(sources.gates)
      .map(([id, gate]) => [id, {...gate, capabilityRows: capabilities.filter(r => r.gates.includes(id)).length, state: 'open'}])),
    excludedReferenceScan: sources.referenceScan,
    excludedReferences: references,
    productCapabilities, ownershipGraph, capabilities,
  };
}
