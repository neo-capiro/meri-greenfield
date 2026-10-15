/** Audit (TOOL-COVERAGE-96.csv) versus p3 inventory accounting. Pure; explains every difference instead of choosing one. */

export const DIFFERENCES = Object.freeze({
  'product-state-read': 'Audit counts it as a read (sideEffect none); p3 counts it as a product operation because its contract group is Meri product state (schedules, chat attachments, memory proposals), owned by a product service rather than a Capiro source. This is why 85 audit reads = 82 p3 reads + 3.',
  'declared-by-bill-watch': 'The only selected non-read whose current contract is declared: the preserved Bill Watch manifest (apps/control/document-application/research-brief/manifest.json) allows create_word. The pasted 14-product enumeration and the 13 original manifests miss it; the full 14-manifest index includes it. Declared is not reachable: the two-skill MCP constructor does not admit Bill Watch.',
  'historical-successor': 'Selected legacy query_action_items maps to the current actions.query (undeclared by any manifest) and also to the retained historical client-scoped query_action_items contract that every relevant manifest still declares: the 97th contract. Audit counts it undeclared (its current replacement is undeclared) and subtracts it from the 48 literal matches; p3 counts it renamed with a one-to-many mapping. Scoped and unscoped semantics must not be aliased.',
  'renamed-declared': 'Declared under its renamed mail/meeting contract. The earlier pasted enumeration left these 6 in the apparent missing set; the audit counts them declared, p3 counts them "reached through renamed contracts". Both agree once renames are applied.',
  'renamed-undeclared': 'Renamed contract that no manifest declares under either name.',
});

const sortedEqual = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const fail = message => { throw Object.assign(new Error(message), {code: 'SCOPE_LEDGER_INVALID'}); };

/** Per-row reconciliation fields for an included capability. */
export function rowReconciliation(capability, operation, csvRow, literalDeclared) {
  const auditKind = operation.sideEffect === 'none' ? 'read' : 'non-read';
  const relation = capability.operations[0].relation, differences = [];
  if (auditKind === 'read' && capability.kind === 'product-operation') differences.push('product-state-read');
  if (auditKind === 'non-read' && csvRow.declaredCurrentContract) differences.push('declared-by-bill-watch');
  if (capability.operations.length > 1) differences.push('historical-successor');
  else if (relation === 'renamed') differences.push(csvRow.declaredCurrentContract ? 'renamed-declared' : 'renamed-undeclared');
  return {auditKind, p3Kind: capability.kind, relation, auditDeclared: csvRow.declaredCurrentContract, auditGroup: csvRow.group,
    legacyNameDeclared: literalDeclared, differences};
}

/** Global counts and the bridge between the two accountings. Throws when either side's published arithmetic no longer holds. */
export function reconcile(included, inventory) {
  const reads = included.filter(r => r.reconciliation.auditKind === 'read');
  const declared = included.filter(r => r.reconciliation.auditDeclared);
  const undeclared = included.filter(r => !r.reconciliation.auditDeclared);
  const literalReads = reads.filter(r => r.reconciliation.legacyNameDeclared);
  const renamedDeclaredReads = reads.filter(r => r.reconciliation.differences.includes('renamed-declared'));
  const literalButSuccessorUndeclared = literalReads.filter(r => !r.reconciliation.auditDeclared);
  const declaredReads = declared.filter(r => r.reconciliation.auditKind === 'read');
  if (literalReads.length + renamedDeclaredReads.length - literalButSuccessorUndeclared.length !== declaredReads.length)
    fail('Declared-read arithmetic does not close');
  const productStateReads = included.filter(r => r.reconciliation.differences.includes('product-state-read')).map(r => r.id);
  const undeclaredReads = undeclared.filter(r => r.reconciliation.auditKind === 'read');
  const domainReads = undeclaredReads.filter(r => r.reconciliation.auditGroup === 'reads29');

  const dir = inventory.reconciliation.originalsDirectory, full = inventory.reconciliation.fullSkillIndex;
  const ids = list => list.map(entry => entry.split(' ')[0]);
  const auditGroup = name => included.filter(r => r.reconciliation.auditGroup === name).map(r => r.id);
  if (!sortedEqual(auditGroup('reads29'), dir.readsWithoutSkillRoute)) fail('Audit reads29 differs from p3 reads without a skill route');
  if (!sortedEqual(auditGroup('product14'), ids(dir.productOperationsAndGovernedWrites))) fail('Audit product14 differs from p3 product/governed set');
  const p3Kinds = inventory.counts.selectedByKind;

  return {
    audit: {
      source: 'docs/coordination/ledgers/TOOL-COVERAGE-96.csv (audit README "Corrected tool and scope accounting")',
      reads: reads.length, nonReads: included.length - reads.length,
      declared: declared.length, declaredReads: declaredReads.length,
      declaredNonReads: declared.filter(r => r.reconciliation.auditKind !== 'read').map(r => r.id),
      undeclared: undeclared.length, undeclaredReads: undeclaredReads.length, undeclaredNonReads: undeclared.length - undeclaredReads.length,
      undeclaredReadBreakdown: {domainReads: domainReads.length, currentSuccessor: undeclaredReads.filter(r => r.reconciliation.differences.includes('historical-successor')).map(r => r.id),
        productStateReads: undeclaredReads.filter(r => r.reconciliation.differences.includes('product-state-read')).map(r => r.id)},
      declaredReadEquation: `${literalReads.length} literal legacy-name read matches + ${renamedDeclaredReads.length} renamed read IDs - ${literalButSuccessorUndeclared.length} historical query_action_items match = ${declaredReads.length} declared current reads; + create_word = ${declared.length}`,
      renamedDeclaredReads: renamedDeclaredReads.map(r => r.id),
    },
    p3: {
      source: 'docs/coordination/proposals/general-reads/inventory.json',
      selectedByKind: p3Kinds, contracts: inventory.counts.operationContracts,
      sameName: inventory.mapping.sameName, renamed: inventory.mapping.renamed.length, equation: inventory.mapping.equation,
      originalsDirectory: dir.summary, fullSkillIndex: full.summary,
    },
    differenceExplanations: DIFFERENCES,
    bridge: [
      {measure: 'reads', audit: reads.length, p3: p3Kinds.read, explanation: `${reads.length} audit reads = ${p3Kinds.read} p3 reads + ${productStateReads.length} product-state reads (${productStateReads.join(', ')})`},
      {measure: 'non-reads', audit: included.length - reads.length, p3: p3Kinds['product-operation'] + p3Kinds['governed-write'],
        explanation: `${included.length - reads.length} audit non-reads = ${p3Kinds['product-operation']} p3 product operations + ${p3Kinds['governed-write']} governed writes - ${productStateReads.length} product-state reads`},
      {measure: 'undeclared / not named by skills', audit: undeclared.length, p3: dir.selectedNotNamedBySkills,
        explanation: `p3 originals-directory ${dir.summary}. Removing the ${dir.reachedThroughRenamedContracts.length} renamed mail/meeting reads (declared under new names) leaves ${dir.selectedNotNamedBySkills - dir.reachedThroughRenamedContracts.length} = ${dir.productOperationsAndGovernedWrites.length} product/governed + ${dir.readsWithoutSkillRoute.length} reads. The audit's ${undeclared.length} = ${undeclared.length - undeclaredReads.length + undeclaredReads.filter(r => r.reconciliation.differences.includes('product-state-read')).length} product IDs + ${domainReads.length} domain reads + 1 current successor: the same set with create_word (declared by Bill Watch) swapped for query_action_items -> actions.query (historical name declared, successor not).`},
      {measure: 'legacy names literally declared (full 14-manifest index)', audit: literalReads.length + declared.filter(r => r.reconciliation.auditKind !== 'read' && r.reconciliation.legacyNameDeclared).length, p3: included.length - full.selectedNotNamedBySkills,
        explanation: `With Bill Watch the p3 count is ${full.summary}; ${included.length} - ${full.selectedNotNamedBySkills} = ${included.length - full.selectedNotNamedBySkills} legacy names literally named, which equals the audit's literal intersection (${literalReads.length} reads + create_word).`},
      {measure: 'contracts', audit: 97, p3: inventory.counts.operationContracts, explanation: `Audit README: 97 descriptors. p3: ${inventory.mapping.equation}; the retained historical contract is query_action_items (superseded by actions.query).`},
    ],
  };
}
