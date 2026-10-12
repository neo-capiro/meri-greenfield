"""One-time source composition record; no provider, adapter or runtime execution."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[5]
contracts = root / 'packages/contracts/retrieval-0.2'
families = [
    ('outreach-query', 'OutreachQuery', ['clientResolution'], False, True, [
        ('query_outreach', 'OutreachQueryInput', 'OutreachQueryOutput')]),
    ('program-elements', 'ProgramElement', ['evidenceAccuracyMode'], True, True, [
        ('search_program_elements', 'ProgramElementSearchInput', 'ProgramElementSearchOutput'),
        ('get_program_element', 'ProgramElementDetailInput', 'ProgramElementDetailOutput'),
        ('get_pe_budget_timeline', 'ProgramElementTimelineInput', 'ProgramElementTimelineOutput')]),
]
limits = {
    'outreach-query': [
        'Exact records and campaign lists preserve distinct creator/tenant/client policy obligations. Trusted client-resolution facts are correlated assertions, never current grants or client visibility proof.',
        'Complete projected record, meeting, prep and metadata-only debrief fields remain separate from campaign-list fields. Opaque stored JSON is inert data, not trusted instructions; body truncation preserves the source projection.',
        'Observed campaign totals describe the fetched source slice. Hidden updatedAt sorting is not reconstructed from createdAt, and no send, source read or mutation is implemented.',
    ],
    'program-elements': [
        'Search, full detail and budget timelines preserve distinct fiscal years, budget stages, chamber/cycle and provenance projections; stored or asserted claims do not establish actual source truth or currentness.',
        'Trusted evidence-accuracy mode selects the declared source projection without granting authority. Exact legacy serialization and normalized monetary wire behavior require a qualified source adapter.',
        'Private Decimal fields preserve precision without coercion into derived numeric funding claims. Current querying, source completeness, identity resolution and producer qualification remain unavailable.',
    ],
}

freeze = json.loads((Path(__file__).resolve().parent / 'candidate-freezes.json').read_text())
assert freeze['unintegratedPendingReview'] == []
assert {f['family'] for f in freeze['families']} >= {'outreach-query', 'program-elements'}
assert all(f['verdict'] == 'ACCEPT_SOURCE' for f in freeze['families'])

loader = contracts / 'validate.mjs'
text = loader.read_text()
imports = ''.join(f"import {{ create{factory}Validators }} from './{group}-validation.mjs';\n"
                  for group, factory, *_ in families)
text = imports + text
needle = "'sam-opportunities', 'florida-budget'];"
assert text.count(needle) == 1
text = text.replace(needle, "'sam-opportunities', 'florida-budget', " + ', '.join(repr(x[0]) for x in families) + '];')
declarations = []
names = []
for group, factory, *_ in families:
    name = factory[0].lower() + factory[1:] + 'Validators'
    names.append(name)
    args = f"validateShape, schema: schemas[groups.indexOf('{group}')]"
    declarations.append(f'const {name} = create{factory}Validators({{{args}}});')
needle = 'export function assertSkillManifest('
assert text.count(needle) == 1
text = text.replace(needle, '\n'.join(declarations) + '\n\n' + needle)
needle = 'floridaBudgetValidators})});'
assert text.count(needle) == 1
text = text.replace(needle, 'floridaBudgetValidators,\n    ' + ', '.join('...' + x for x in names) + '})});')
loader_text = text

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
        output = 'Output'
        output_args = ('binding.id, ' if with_id else '') + f'page, request, {options}'
        output_call = f'v.assert{factory}{output}({output_args})'
        rows.append(f"  Object.freeze({{id: '{op}', nativeId: '{op}', group: '{group}', input: '{input_def}', output: '{output_def}', version: '0.2.0',\n"
                    f'    contextKeys: Object.freeze({json.dumps(context)}),\n'
                    f'    normalize: (v, request, context, binding) => ({normalized}),\n'
                    f'    outputAssert: (v, page, request, context, binding) => {output_call}}}),\n')
needle = 'export const CATALOG_OPERATION_BINDINGS = Object.freeze([\n'
assert text.count(needle) == 1
registry_text = text.replace(needle, needle + ''.join(rows))

catalog_file = contracts / 'catalog.json'
catalog = json.loads(catalog_file.read_text())
assert catalog['catalogVersion'] == '0.2.9' and len(catalog['operations']) == 67
catalog['catalogVersion'] = '0.2.10'
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
assert len(catalog['operations']) == 71
assert sum(x['state'] == 'mapped' for x in catalog['originals']) == 70
loader.write_text(loader_text)
registry.write_text(registry_text)
catalog_file.write_text(json.dumps(catalog, indent=2) + '\n')
print(json.dumps({'typedUnavailable': 71, 'mappedUnavailable': 70, 'selectedPending': 26, 'sourceEnabled': False}))
