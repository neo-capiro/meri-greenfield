"""One-time source composition record; no provider, adapter or runtime execution."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[5]
contracts = root / 'packages/contracts/retrieval-0.2'
families = [
    ('public-web', 'PublicWeb', [], False, True, [
        ('search_public_web', 'PublicWebSearchInput', 'PublicWebSearchOutput'),
        ('scrape_web_page', 'PublicWebPageInput', 'PublicWebPageOutput')]),
    ('sam-opportunities', 'SamOpportunities', ['asOf', 'evidenceAccuracyMode', 'sourceStatusAsOf', 'sourceHealthAsOf'], False, True, [
        ('search_sam_opportunities', 'SamOpportunitiesInput', 'SamOpportunitiesOutput')]),
    ('florida-budget', 'FloridaBudget', ['asOf', 'effectiveScope', 'clientResolution'], False, True, [
        ('get_florida_budget_project', 'FloridaBudgetInput', 'FloridaBudgetOutput')]),
]
limits = {
    'public-web': [
        'Public search discoveries preserve provider-specific fields and raw DuckDuckGo URL text; neither discovery nor absence of rows establishes source truth or absence. Page content remains external_untrusted.',
        'URL scheme and credential syntax checks do not qualify DNS, redirects, SSRF, private-address blocking, egress or fetch authorization. No fetch, provider, parser, browser or renderer implementation is included.',
        'HTML/PDF prefix coverage, raw-byte hash text and reported totals are correlated assertions only. Redirected final URLs may differ; truncated PDF prefixes need not end in an ellipsis. Actual bytes, parsing, hash provenance and completeness remain unqualified.',
    ],
    'sam-opportunities': [
        'Stored SAM opportunities retain fourteen projected fields, independent observed counts and hidden-query matches. This is not live SAM discovery, exhaustive coverage or an absence proof.',
        'Nine source-health states use declared status precedence and a forty-eight-hour threshold. Raw health timestamp text preserves producer interpretation, including invalid and future values; it does not establish a canonical or current clock.',
        'Three trusted observation clocks are independent and need not increase. Enforce-only structured deadline facts correlate with stored timestamps; actual clock capture, source enablement, current authority and producer qualification remain unverified.',
    ],
    'florida-budget': [
        'Trusted effective scope and client resolution are projection assertions only; names and case-insensitive UUID references retain declared resolution semantics. Current tenant, client, folder, membership, wall, feature and internal-guard enforcement remain execution prerequisites.',
        'Projects, recent amounts, documents, amount observations and events preserve their distinct caps and nullable projections. Raw JSON is inert opaque stored data; it is not guaranteed to conform to a BudgetAmount DTO.',
        'Requests, chamber alternatives, offers, allocations and vetoes do not establish awarded amounts. Exact monetary meanings and fiscal stages remain distinct; no aggregation, currentness or completeness claim is implemented.',
    ],
}

loader = contracts / 'validate.mjs'
text = loader.read_text()
imports = ''.join(f"import {{ create{factory}Validators }} from './{group}-validation.mjs';\n"
                  for group, factory, *_ in families)
text = imports + text
needle = "'tracked-bills', 'intelligence-summary'];"
assert text.count(needle) == 1
text = text.replace(needle, "'tracked-bills', 'intelligence-summary', " + ', '.join(repr(x[0]) for x in families) + '];')
declarations = []
names = []
for group, factory, *_ in families:
    name = factory[0].lower() + factory[1:] + 'Validators'
    names.append(name)
    args = ('validateShape, assertSubject, canonicalSha256' if group == 'tracked-bills' else 'validateShape' if group == 'tenant-contacts' else f"validateShape, schema: schemas[groups.indexOf('{group}')]")
    declarations.append(f'const {name} = create{factory}Validators({{{args}}});')
needle = 'export function assertSkillManifest('
assert text.count(needle) == 1
text = text.replace(needle, '\n'.join(declarations) + '\n\n' + needle)
needle = '...intelligenceSummaryValidators})});'
assert text.count(needle) == 1
text = text.replace(needle, '...intelligenceSummaryValidators,\n    ' + ', '.join(x if x == 'floridaBudgetValidators' else '...' + x for x in names) + '})});')
loader.write_text(text)

registry = contracts / 'catalog-validation.mjs'
text = registry.read_text()
rows = []
for group, factory, context, direct, with_id, operations in families:
    for op, input_def, output_def in operations:
        options = 'clock(context, binding.contextKeys)'
        args = ('binding.id, ' if with_id else '') + f'request, {options}'
        normalized = f'v.floridaBudgetValidators.normalizeInput({args})' if group == 'florida-budget' else f'v.normalize{factory}Input({args})'
        if direct:
            normalized = '{input: ' + normalized + '}'
        output = 'Result' if group in ['tenant-contacts', 'tracked-bills'] else 'Output'
        output_args = ('binding.id, ' if with_id else '') + f'page, request, {options}'
        output_call = f'v.floridaBudgetValidators.assertResult({output_args})' if group == 'florida-budget' else f'v.assert{factory}{output}({output_args})'
        rows.append(f"  Object.freeze({{id: '{op}', nativeId: '{op}', group: '{group}', input: '{input_def}', output: '{output_def}', version: '0.2.0',\n"
                    f'    contextKeys: Object.freeze({json.dumps(context)}),\n'
                    f'    normalize: (v, request, context, binding) => ({normalized}),\n'
                    f'    outputAssert: (v, page, request, context, binding) => {output_call}}}),\n')
needle = 'export const CATALOG_OPERATION_BINDINGS = Object.freeze([\n'
assert text.count(needle) == 1
registry.write_text(text.replace(needle, needle + ''.join(rows)))

catalog_file = contracts / 'catalog.json'
catalog = json.loads(catalog_file.read_text())
assert catalog['catalogVersion'] == '0.2.8' and len(catalog['operations']) == 63
catalog['catalogVersion'] = '0.2.9'
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
assert len(catalog['operations']) == 67
assert sum(x['state'] == 'mapped' for x in catalog['originals']) == 66
catalog_file.write_text(json.dumps(catalog, indent=2) + '\n')
print(json.dumps({'typedUnavailable': 67, 'mappedUnavailable': 66, 'selectedPending': 30, 'sourceEnabled': False}))
