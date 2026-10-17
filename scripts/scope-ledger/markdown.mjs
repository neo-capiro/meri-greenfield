/** Renders the generated tables of the scope ledger Markdown and splices them between fixed markers. Pure. */

export const BEGIN = '<!-- scope-ledger:generated:begin (scripts/scope-ledger/cli.mjs --write; do not edit by hand) -->';
export const END = '<!-- scope-ledger:generated:end -->';

const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const code = value => `\`${value}\``;
const list = values => (values.length ? values.join(', ') : 'none');
const table = (header, rows) => [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.map(cell).join(' | ')} |`)].join('\n');

function includedTable(rows) {
  return table(['Capability', 'Kind (p3 / audit)', 'Current contract(s)', 'Declared by skills', 'Adapter', 'Route', 'Lane / canonical owner', 'Gates', 'Open items'],
    rows.map(r => [code(r.id), `${r.kind} / ${r.reconciliation.auditKind}`,
      r.contracts.map(c => `${code(c.id)} (${c.relation})`).join('; '),
      r.declaration.currentContractDeclared ? `yes (${r.declaration.declaredBySkills.length})` : 'no',
      Array.isArray(r.adapter) ? r.adapter.map(code).join(', ') : r.adapter,
      `${r.route}${r.integrationPhase ? ` [${r.integrationPhase}]` : ''}`,
      `${r.ownerLane}; ${r.canonicalOwner}`, r.gates.join(', '), list(r.openItems)]));
}

function excludedTable(rows) {
  const byClass = refs => Object.entries(refs.reduce((out, ref) => ({...out, [ref.class]: (out[ref.class] ?? 0) + 1}), {}))
    .sort(([a], [b]) => a.localeCompare(b)).map(([name, n]) => `${name} ${n}`).join(', ');
  return table(['Capability', 'Owner group', 'Registry kind', 'Implementation found', 'Files naming it, by class', 'Gates'],
    rows.map(r => [code(r.id), r.ownerExclusionGroup, r.kind, r.implementationFound ? 'YES' : 'no',
      r.references.length ? byClass(r.references) : 'none', r.gates.join(', ')]));
}

function referenceTable(references) {
  return table(['File', 'Class', 'Excluded names in it'],
    references.map(ref => [ref.path, ref.alsoCarries ? `${ref.class} (also ${ref.alsoCarries})` : ref.class,
      ref.tools.length > 4 ? `${ref.tools.length} names` : ref.tools.map(code).join(', ')]));
}

function differenceTable(rows) {
  return table(['Capability', 'Difference', 'Audit view', 'p3 view'],
    rows.filter(r => r.reconciliation?.differences.length).map(r => [code(r.id), r.reconciliation.differences.join(', '),
      `${r.reconciliation.auditKind}; declared ${r.reconciliation.auditDeclared ? 'yes' : 'no'}; CSV group ${r.reconciliation.auditGroup}`,
      `${r.reconciliation.p3Kind}; ${r.reconciliation.relation}; literal legacy name declared ${r.reconciliation.legacyNameDeclared ? 'yes' : 'no'}`]));
}

function sourceExposure(snapshot) {
  const counts=snapshot.counts;
  return [
    '### Current selected read source exposure (16 October 2026)', '',
    'This is source reconciliation only. The historical proposal tables below retain their original status; current adapter/server presence is recorded here and in `scope-ledger.json.sourceExposure.rows`. No source receipt is repinned and live availability remains zero.', '',
    table(['Measure','Current source'], [
      ['Selected capabilities / continued exclusions',`${counts.selectedCapabilities} / ${counts.excludedCapabilities}`],
      ['Selected source reads / separate product or governed capabilities',`${counts.selectedSourceReads} / ${counts.selectedProductOrGoverned}`],
      ['Single meri_reads registry',`${counts.registeredGeneralOperations} operations / ${counts.registeredFamilies} families`],
      ['Registry accounting',`${counts.generalSelectedSourceReads} selected source reads + ${counts.generalSelectedProductStateReads} product-state read + ${counts.generalHistoricalOperations} historical contract`],
      ['Selected source reads declared in skill manifests',`${counts.sourceReadsWithCurrentContractDeclarations} current contracts + ${counts.sourceReadsWithHistoricalOnlySkillDeclaration} historical-only contract`],
      ['Selected source reads reachable through admitted skill source',counts.sourceReadsWithAdmittedSkillSourceRoute],
      ['Existing source adapters lacking general-conversation registration',counts.existingSourceAdaptersWithoutGeneralExposure],
      ['Selected source reads lacking adapters',`${counts.missingSourceAdapters} (${counts.missingAdaptersDeclaredBySkills} declared by skills; ${counts.missingAdaptersWithoutSkillDeclaration} without a skill declaration)`],
      ['Pinned actual Core producer mappings (not qualification)',counts.mappedBackendProducers],
      ['Live',counts.live],
    ]), '',
    `Only ${snapshot.admittedSkills.map(code).join(', ')} are admitted by the original skill server. A declaration in another manifest is not source reachability. The historical \`query_action_items\` and successor \`actions.query\` represent one selected capability. \`memory.list_own_proposals\` is a product-state read; product writes and effects remain on their separate governed route.`, '',
    table(['Source-admitted skill','Exact adapter-backed operations'],snapshot.admittedSkills.map(skill=>[code(skill),[...new Set(snapshot.rows.filter(row=>row.sourceAdmittedSkills.includes(skill)).flatMap(row=>row.sourceAdmittedOperations))].sort().map(code).join(', ')])), '',
    table(['Registered family','Exact operations'],snapshot.generalRegistration.map(row=>[code(row.family),row.operations.map(code).join(', ')])), '',
    snapshot.existingAdaptersWithoutGeneralExposure.length?`Implemented source adapters awaiting general exposure: ${snapshot.existingAdaptersWithoutGeneralExposure.map(code).join(', ')}. Implementation does not establish a usable SDK input contract or availability.`:'Every canonical source adapter already present is exposed.', '',
    'The finite native families listed above retain their receiving-contract truth limits and require current task, tenant/user and native credentials. Research portfolio, portfolio changes and Florida budget project reads remain exposed through their existing retained-context path. These source paths are not qualified or live. The remaining selected source reads lack an adapter; producer mapping alone does not implement them. Their exact unresolved families and operations are:', '',
    table(['Missing adapter family','Selected operations'],snapshot.missingAdapterFamilies.map(row=>[code(row.family),row.operations.map(code).join(', ')])), '',
    snapshot.missingAdapterAction,
    ...(snapshot.backendProducerEvidence?['',`The 63 producer mappings pin Core \`${snapshot.backendProducerEvidence.backend.commit}\` / tree \`${snapshot.backendProducerEvidence.backend.tree}\`. [Sanitized repository publication](${snapshot.backendProducerEvidence.publication.url}) is pinned at \`${snapshot.backendProducerEvidence.publication.commit}\`. Its reviewed v2 index SHA is \`${snapshot.backendProducerEvidence.reviewedIndex.sha256}\`; publication review SHA \`${snapshot.backendProducerEvidence.reviewedIndex.reviewSha256}\`. Every mapped operation in JSON retains its exact scoped report hash/pointer, required receiving context and compatibility status. Original local v2 and superseded evidence remain preserved by their owner.`, '',...snapshot.backendProducerEvidence.constraints.map(value=>`- ${value}`)]:[]),
  ].join('\n');
}

export function renderGenerated(ledger) {
  const included = ledger.capabilities.filter(r => r.decision === 'included');
  const excluded = ledger.capabilities.filter(r => r.decision === 'excluded');
  const {audit, bridge} = ledger.reconciliation;
  return [
    BEGIN,
    '',
    '### Generated counts',
    '',
    table(['Measure', 'Value'], [
      ['Legacy capabilities', ledger.counts.legacyCapabilities],
      ['Included / excluded', `${ledger.counts.included} / ${ledger.counts.excluded}`],
      ['Included by p3 kind', JSON.stringify(ledger.counts.includedByKind)],
      ['Included by audit kind', JSON.stringify(ledger.counts.includedByAuditKind)],
      ['Included by planned lane', JSON.stringify(ledger.counts.includedByOwnerLane)],
      ['Included by route', JSON.stringify(ledger.counts.includedByRoute)],
      ['Excluded by owner group', JSON.stringify(ledger.counts.excludedByGroup)],
      ['Excluded by registry kind', JSON.stringify(ledger.counts.excludedByRegistryKind)],
      ['Excluded implementations found', ledger.counts.excludedImplementationsFound],
      ['Files naming an excluded tool, by class', JSON.stringify(ledger.counts.excludedReferenceFiles)],
      ['Audit declared-read equation', audit.declaredReadEquation],
      ['Live', ledger.counts.live],
    ]),
    '',
    sourceExposure(ledger.sourceExposure),
    '',
    '### Historical accounting bridge (audit CSV versus p3 inventory)',
    '',
    table(['Measure', 'Audit', 'p3', 'Explanation'], bridge.map(b => [b.measure, b.audit, b.p3, b.explanation])),
    '',
    '### Rows where the two accountings differ',
    '',
    differenceTable(included),
    '',
    ...Object.entries(ledger.reconciliation.differenceExplanations ?? {}).map(([id, text]) => `- ${code(id)}: ${text}`),
    '',
    `### Included capabilities (${included.length})`,
    '',
    includedTable(included),
    '',
    `### Excluded by owner direction, 15 October 2026 (${excluded.length})`,
    '',
    excludedTable(excluded),
    '',
    `Every file under ${ledger.excludedReferenceScan} that names an excluded tool (${ledger.excludedReferences.length}); none is an implementation:`,
    '',
    referenceTable(ledger.excludedReferences),
    '',
    `### Required product capabilities outside the legacy registry (${ledger.productCapabilities.length})`,
    '',
    table(['Capability', 'Decision', 'Planned owner', 'Canonical owner', 'Current state', 'Gates'],
      ledger.productCapabilities.map(p => [p.scopeRow ?? p.title, p.decision, p.plannedOwner, p.canonicalOwner, p.currentState, list(p.gates)])),
    '',
    `### Ownership graph proposal for dot (${ledger.ownershipGraph.domains.length} domains)`,
    '',
    table(['Domain', 'Owned today', 'Composed by startup', 'Unowned responsibilities', 'Proposed canonical owner'],
      ledger.ownershipGraph.domains.map(d => [d.title, d.ownedToday, d.composedByStartup, list(d.unowned), d.proposedCanonicalOwner])),
    '',
    `### Gates (${Object.keys(ledger.gates).length}, all open)`,
    '',
    table(['Gate', 'Title', 'Owner', 'Rows', 'Requirement'],
      Object.entries(ledger.gates).map(([id, g]) => [code(id), g.title, g.owner, g.capabilityRows, g.requirement])),
    '',
    END,
  ].join('\n');
}

/** Replaces the text between the markers; refuses when the markers are absent or out of order. */
export function splice(document, generated) {
  const start = document.indexOf(BEGIN), end = document.indexOf(END);
  if (start < 0 || end < start) throw Object.assign(new Error('Scope ledger markers missing or out of order'), {code: 'SCOPE_LEDGER_MARKERS'});
  return `${document.slice(0, start)}${generated}${document.slice(end + END.length)}`;
}
