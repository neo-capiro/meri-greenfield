"""One-time source composition record; no provider, adapter or runtime execution."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[5]
contracts = root / 'packages/contracts/retrieval-0.2'
families = [
    ('state-status-votes', 'StateStatusVotes', [], False, True, [
        ('get_state_bill_status', 'StateBillStatusInput', 'StateBillStatusOutput'),
        ('search_state_floor_votes', 'StateFloorVotesInput', 'StateFloorVotesOutput')]),
    ('regulatory-dockets', 'RegulatoryDockets', [], False, True, [
        ('query_regulatory_dockets', 'RegulatoryDocketsQueryInput', 'RegulatoryDocketsQueryOutput')]),
    ('tenant-contacts', 'TenantContacts', [], True, False, [
        ('find_contacts', 'TenantContactsInput', 'TenantContactsResult')]),
    ('entity-candidates', 'EntityCandidates', ['defaultCongress'], False, True, [
        ('resolve_entity', 'EntityCandidatesInput', 'EntityCandidatesOutput')]),
    ('tracked-bills', 'TrackedBills', ['binding', 'subject', 'clientReference'], True, False, [
        ('search_tracked_bills', 'TrackedBillsInput', 'TrackedBillsResult')]),
    ('intelligence-summary', 'IntelligenceSummary', [], False, True, [
        ('query_intelligence', 'IntelligenceSummaryInput', 'IntelligenceSummaryOutput')]),
]
limits = {
    'state-status-votes': [
        'Unresolved, resolved-but-absent and found bill projections remain distinct; unresolved bill selectors cannot broaden floor votes to a state-wide result. Stored identity/status and capped histories do not prove current status or the latest session.',
        'The pure state selector helper is reused. Canonical-key and designation correlations do not establish a stored lookup or current authority; signed tallies, nullable dates and source notes retain their declared semantics.',
        'The legacy designation-miss path may reserve provider quota, call LegiScan and upsert data. None of those effects is implemented or authorized by this source-only boundary; eventual adapter policy, budgets and execution qualification remain open.',
    ],
    'regulatory-dockets': [
        'Ordinary total is a separate observed count; upcoming total describes the service window capped at fifty before the requested slice. Neither establishes exhaustive current deadline coverage.',
        'Upcoming window selectors that the producer ignores remain normalized but do not become filters. GeneratedAt is not the service clock; local relative date checks do not prove the actual current eligibility window.',
        'Strict bounded integer inputs are an explicit private admission restriction relative to legacy coercion and clamping. No source querying, transaction or external action is implemented.',
    ],
    'tenant-contacts': [
        'Contact selection combines linked client, email domain and query as OR predicates within the tenant. This is not a client-only contact inventory or proof of current client visibility.',
        'Projected synced-mail/calendar observations, nullable identities and profile flags do not prove unreturned history, profile/domain facts or completeness. Legacy note text does not authorize profile mutation or messaging.',
        'Validated result objects are detached snapshots. Canonical date admission is narrower than arbitrary database dates; no email format, ID or uniqueness guarantee is invented.',
    ],
    'entity-candidates': [
        'Five stored candidate variants preserve direct, crosswalk and name-search precedence. Trusted defaultCongress is explicit; no model-supplied or ambient default creates authority.',
        'Name-search primary-key identities cannot repeat within a family; legitimate crosswalk duplicates remain allowed. Stored false currentness and dynamic crosswalk metadata are projected data, not authorization or freshness.',
        'Canonical congressional and state identity helpers are reused without provider fallback. Stored IDs do not imply unexpressed database state/session/congress constraints; latest-session and current roster truth remain unproved.',
    ],
    'tracked-bills': [
        'Trusted binding, one-client subject and exact normalized clientReference describe a claimed resolver assertion. UUID selectors must correlate with the subject; name resolution does not establish current visibility, wall enforcement or a connected resolver.',
        'All returned tracking rows and nullable global bill enrichment retain source projection semantics. Total is the returned count, not a corpus-completeness proof; no invented fifty-row or pagination cap is applied.',
        'Validated output is detached from caller mutation. Stored uniqueness/order/identifier correlations do not replace tenant authorization, live source qualification or result-release checks.',
    ],
    'intelligence-summary': [
        'Data is opaque stored-source prose. Per-source errors and count failures are omitted; a fallback string does not establish corpus absence, complete coverage, verified counts or successful retrieval.',
        'Optional clientName is a query selector, not client identity or authority. The observed service paths use stored reads and transaction-local system context; no model synthesis, provider call, SQL execution or source adapter is implemented here.',
    ],
}

loader = contracts / 'validate.mjs'
text = loader.read_text()
imports = ''.join(f"import {{ create{factory}Validators }} from './{group}-validation.mjs';\n"
                  for group, factory, *_ in families)
text = imports + text
needle = "'dataset-metadata', 'facility-representation'];"
assert text.count(needle) == 1
text = text.replace(needle, "'dataset-metadata', 'facility-representation', " + ', '.join(repr(x[0]) for x in families) + '];')
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
needle = '...facilityRepresentationValidators})});'
assert text.count(needle) == 1
text = text.replace(needle, '...facilityRepresentationValidators,\n    ' + ', '.join('...' + x for x in names) + '})});')
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
        output = 'Result' if group in ['tenant-contacts', 'tracked-bills'] else 'Output'
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
assert catalog['catalogVersion'] == '0.2.7' and len(catalog['operations']) == 56
catalog['catalogVersion'] = '0.2.8'
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
assert len(catalog['operations']) == 63
assert sum(x['state'] == 'mapped' for x in catalog['originals']) == 62
catalog_file.write_text(json.dumps(catalog, indent=2) + '\n')
print(json.dumps({'typedUnavailable': 63, 'mappedUnavailable': 62, 'selectedPending': 34, 'sourceEnabled': False}))
