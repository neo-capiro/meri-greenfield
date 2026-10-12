"""One-time source composition record; no provider, adapter or runtime execution."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[5]
contracts = root / 'packages/contracts/retrieval-0.2'
families = [
    ('legislative-directory', 'LegislativeDirectory', [], False, True, [
        ('get_committee_roster', 'CommitteeRosterInput', 'CommitteeRosterOutput'),
        ('list_members', 'MemberListInput', 'MemberListOutput')]),
    ('pe-references', 'PeReference', [], True, True, [
        ('get_pe_contractors', 'PeContractorsInput', 'PeContractorsOutput'),
        ('get_pe_bills', 'PeBillsInput', 'PeBillsOutput'),
        ('get_pe_report_language', 'PeReportLanguageInput', 'PeReportLanguageOutput')]),
    ('rule-status', 'RuleStatus', ['stageAsOf', 'commentAsOf'], False, True, [
        ('get_state_rule_status', 'RuleStatusInput', 'RuleStatusOutput')]),
    ('certification-status', 'CertificationStatus', ['comparisonLocale'], True, False, [
        ('get_certification_status', 'CertificationStatusInput', 'CertificationStatusOutput')]),
    ('stored-intelligence', 'StoredIntelligence', [], False, True, [
        ('search_intel_articles', 'StoredIntelligenceSearchInput', 'StoredIntelligenceSearchOutput')]),
    ('dataset-metadata', 'DatasetMetadata', [], False, True, [
        ('list_global_datasets', 'DatasetMetadataListInput', 'DatasetMetadataListOutput')]),
    ('facility-representation', 'FacilityRepresentation', ['binding', 'subject'], True, False, [
        ('get_representation', 'FacilityRepresentationInput', 'FacilityRepresentationResult')]),
]
limits = {
    'legislative-directory': [
        'State and territory selection uses the accepted schema vocabulary; stored member identity, nullable fields and source ordering remain distinct from current roster truth.',
        'Unbounded committee rosters are not assigned an invented page cap. Missing selectors and unsupported state/chamber combinations retain refusal outcomes; projection checks do not qualify current source joins.',
    ],
    'pe-references': [
        'Awards in the declared 24-month window and R3 exhibit amounts have separate provenance. Match buckets and missing-table fallbacks do not establish complete contractor coverage.',
        'Report language exposes accepted/candidate review states with stronger matching basis before status; any program-level row requires the declared caveat. Bills and contractors do not gain invented PE echo lineage.',
    ],
    'rule-status': [
        'Trusted stageAsOf and commentAsOf are separate canonical observations; generatedAt is neither clock anchor nor freshness proof. The producer can observe those clocks at different instants.',
        'Strict comment close/open and effective-date thresholds, federal/state date representations and bounded ambiguity projections preserve their distinct semantics.',
    ],
    'certification-status': [
        'Trusted comparisonLocale must be canonical and supported by the local runtime. Admission does not prove the actual source locale, current certification or current visibility.',
        'The searchedEntireDataset claim and candidate count describe a supplied snapshot; optional absence provenance and the first-ten candidate projection remain distinct. HTTP, retries and body allocation are unqualified execution dependencies.',
    ],
    'stored-intelligence': [
        'This boundary describes stored normalized article excerpts and an independent observed count, which can be smaller than the returned row count. It does not refresh feeds or establish current article truth.',
        'UTF-16 title/summary limits and canonical timestamp admission are local wire restrictions. Stored identifiers and URLs remain opaque projected values.',
    ],
    'dataset-metadata': [
        'Only the public-shaped metadata projection is described; private dataset registry implementation and SQL bodies are not imported. Metadata does not authorize queries or access to any dataset row.',
        'Six field kinds, per-field flags and number-only aggregatable semantics are declared; generatedAt and listed datasets do not establish current access or complete source inventory.',
    ],
    'facility-representation': [
        'Trusted binding and one-client subject are required for claimed lineage consistency. The selector, legacy tenant/client lookup and matching returned wrapper do not establish current client visibility or grants.',
        'Missing-client, empty, unresolved and resolved projections remain distinct. No federal geographic join, hidden geocode/district truth, two-senator cap or freshness claim is invented.',
        'State-legislator slots preserve raw state and chamber correlation. Federal state text remains projected data; the private state-name resolver is not recreated. Stored state bounds use codepoints while selectors preserve UTF-16 caps with uppercase-overflow refusal.',
    ],
}

loader = contracts / 'validate.mjs'
text = loader.read_text()
imports = ''.join(f"import {{ create{factory}Validators }} from './{group}-validation.mjs';\n"
                  for group, factory, *_ in families)
text = imports + text
needle = "'federal-legislation', 'bill-text'];"
assert text.count(needle) == 1
text = text.replace(needle, "'federal-legislation', 'bill-text', " + ', '.join(repr(x[0]) for x in families) + '];')
declarations = []
names = []
for group, factory, *_ in families:
    name = factory[0].lower() + factory[1:] + 'Validators'
    names.append(name)
    args = 'validateShape, assertSubject, canonicalSha256' if group == 'facility-representation' else f"validateShape, schema: schemas[groups.indexOf('{group}')]"
    declarations.append(f'const {name} = create{factory}Validators({{{args}}});')
needle = 'export function assertSkillManifest('
assert text.count(needle) == 1
text = text.replace(needle, '\n'.join(declarations) + '\n\n' + needle)
needle = '...billTextValidators})});'
assert text.count(needle) == 1
text = text.replace(needle, '...billTextValidators,\n    ' + ', '.join('...' + x for x in names) + '})});')
loader.write_text(text)

registry = contracts / 'catalog-validation.mjs'
text = registry.read_text()
rows = []
for group, factory, context, direct, with_id, operations in families:
    for op, input_def, output_def in operations:
        options = 'clock(context, binding.contextKeys)'
        args = ('binding.id, ' if with_id else '') + f'request, {options}'
        normalized = f'v.normalize{factory}Input({args})'
        if direct:
            normalized = '{input: ' + normalized + '}'
        output = 'Result' if group == 'facility-representation' else 'Output'
        output_args = ('binding.id, ' if with_id else '') + f'page, request, {options}'
        rows.append(f"  Object.freeze({{id: '{op}', nativeId: '{op}', group: '{group}', input: '{input_def}', output: '{output_def}', version: '0.2.0',\n"
                    f'    contextKeys: Object.freeze({json.dumps(context)}),\n'
                    f'    normalize: (v, request, context, binding) => ({normalized}),\n'
                    f'    outputAssert: (v, page, request, context, binding) => v.assert{factory}{output}({output_args})}}),\n')
needle = 'export const CATALOG_OPERATION_BINDINGS = Object.freeze([\n'
assert text.count(needle) == 1
registry.write_text(text.replace(needle, needle + ''.join(rows)))

catalog_file = contracts / 'catalog.json'
catalog = json.loads(catalog_file.read_text())
assert catalog['catalogVersion'] == '0.2.6' and len(catalog['operations']) == 46
catalog['catalogVersion'] = '0.2.7'
for group, factory, context, direct, with_id, operations in families:
    schema_file = contracts / (group + '.schema.json')
    schema = json.loads(schema_file.read_text())
    digest = hashlib.sha256(schema_file.read_bytes()).hexdigest()
    for op, input_def, output_def in operations:
        original = next(row for row in catalog['originals'] if row['id'] == op)
        assert original['state'] == 'pending' and original['replacement'] is None
        original['state'] = 'mapped'
        original['replacement'] = {'id': op, 'version': '0.2.0'}
        descriptor = json.loads(json.dumps(catalog['operations'][-1]))
        descriptor.update({
            'operation': original['replacement'],
            'displayName': op.replace('_', ' ').capitalize(),
            'whenToUse': 'Inspect the declared source projection through a qualified source owner under current authorization.',
            'limitations': [
                'Pending private contract only; null handler, no enabled source or executable skill.',
                'Source requirements are design declarations; current grants, feature flags, availability and producer authority remain unqualified.',
                'Local source validation does not qualify current identity, source access, result release or runtime.',
                *limits[group],
            ],
            'sourceRequirements': [{'sourceId': group.replace('-', '_'), 'authority': 'derived', 'purpose': 'evidence'}],
            'inputSchema': {'id': schema['$id'] + '#/$defs/' + input_def, 'sha256': digest},
            'outputSchema': {'id': schema['$id'] + '#/$defs/' + output_def, 'sha256': digest},
            'fixtureIds': ['catalog.binding.' + op],
        })
        catalog['operations'].append(descriptor)
assert len(catalog['operations']) == 56
assert sum(x['state'] == 'mapped' for x in catalog['originals']) == 55
catalog_file.write_text(json.dumps(catalog, indent=2) + '\n')
print(json.dumps({'typedUnavailable': 56, 'mappedUnavailable': 55, 'selectedPending': 41, 'sourceEnabled': False}))
