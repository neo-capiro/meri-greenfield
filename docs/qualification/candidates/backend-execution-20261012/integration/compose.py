"""One-time reviewed private-contract composition; no source or runtime execution."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
contracts = root / 'packages/contracts/retrieval-0.2'
# Group, factory, nested API, context keys, (canonical ID, raw request, result).
families = [
    ('client-knowledge-search', 'ClientKnowledgeSearch', True, None, [
        ('search_client_knowledge', 'ClientKnowledgeSearchRequest', 'ClientKnowledgeSearchOutput', ['asOf']),
        ('query_knowledge_graph', 'KnowledgeGraphRequest', 'KnowledgeGraphOutput', [])]),
    ('client-knowledge-monday', 'ClientKnowledgeMonday', True, [], [
        ('read_monday_client_boards', 'ClientKnowledgeMondayRequest', 'ClientKnowledgeMondayOutput')]),
    ('client-knowledge-attachments', 'ClientKnowledgeAttachment', True, ['asOf', 'scope'], [
        ('read_chat_attachments', 'ClientKnowledgeAttachmentRequest', 'ClientKnowledgeAttachmentOutput')]),
    ('client-knowledge-memory', 'ClientKnowledgeMemory', True, ['tenantId', 'userId'], [
        ('search_memory', 'ClientKnowledgeMemoryRequest', 'ClientKnowledgeMemoryOutput')]),
    ('client-knowledge-profile', 'ClientKnowledgeProfile', True, ['asOf', 'clientResolution'], [
        ('get_client_context', 'ClientKnowledgeProfileRequest', 'ClientKnowledgeProfileOutput')]),
    ('research-legal-candidates', 'ResearchLegalCandidates', False, ['clientResolution'], [
        ('search_research_sources', 'ResearchLegalCandidatesRequest', 'ResearchLegalCandidatesOutput')]),
    ('public-domain-query', 'PublicDomainQuery', False, ['defaultAsOf'], [
        ('query_global_data', 'PublicDomainQueryRequest', 'PublicDomainQueryOutput')]),
    ('research-legal-legislation', 'ResearchLegalLegislation', False, ['clientResolution', 'citationResolution'], [
        ('search_legislative_research', 'ResearchLegalLegislationSearchRequest', 'ResearchLegalLegislationSearchOutput'),
        ('get_legal_reference', 'ResearchLegalLegislationReferenceRequest', 'ResearchLegalLegislationReferenceOutput')]),
    ('action-items-complete', 'ActionItemsComplete', False, ['binding', 'clientResolution'], [
        ('actions.query', 'ActionItemsCompleteInput', 'ActionItemsCompleteResult')]),
]
raw_repairs = json.loads((packet / 'raw-request-admission-before.json').read_text())['rows']
assert len(raw_repairs) == 31 and all(row['normalizationSucceeded'] for row in raw_repairs)
# Later accepted families must be explicit records, never inferred from a file.
extra = packet / 'additional-accepted-families.json'
if extra.exists():
    families.extend(json.loads(extra.read_text()))
freeze = json.loads((packet / 'candidate-freezes.json').read_text())
accepted = {item['group']: item for item in freeze['families']}
assert all(group in accepted and accepted[group]['verdict'] == 'ACCEPT_SOURCE' for group, *_ in families)
for group, *_ in families:
    path = contracts / (group + '.schema.json')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == accepted[group]['schemaSha256'], group
    for dependency in accepted[group].get('dependencySchemas', []):
        path = contracts / (dependency['group'] + '.schema.json')
        assert hashlib.sha256(path.read_bytes()).hexdigest() == dependency['sha256'], dependency['group']

loader = contracts / 'validate.mjs'
text = loader.read_text()
assert "'action-items-complete'" not in text
imports = ''.join(f"import {{ create{factory}Validators }} from './{group}-validation.mjs';\n" for group, factory, *_ in families)
imports += "import { createPublicDomainDatasetRegistry } from './public-domain-registry.mjs';\n"
imports += "import { validateShape as validatePublicShape } from '../validate.mjs';\n"
text = imports + text
needle = "'outreach-query', 'program-elements'];"
assert text.count(needle) == 1
text = text.replace(needle, "'outreach-query', 'program-elements', " + ', '.join(repr(row[0]) for row in families) + '];')
if any(row[0] == 'public-domain-hearings' for row in families):
    text = text.replace("'public-domain-hearings'];", "'public-domain-hearings', 'public-domain-hearing-records'];")
declarations = ['export const publicDomainDatasetRegistry = createPublicDomainDatasetRegistry({canonicalSha256, validateMetadata: validateShape});']
names = []
for group, factory, nested, *_ in families:
    name = factory[0].lower() + factory[1:] + 'Validators'
    names.append(name if nested else '...' + name)
    args = f"validateShape, schema: schemas[groups.indexOf('{group}')]"
    if group == 'public-domain-query':
        args += ', canonicalSha256, datasetRegistry: publicDomainDatasetRegistry'
    if group == 'action-items-complete':
        args = 'validateShape, validatePublicShape, canonicalSha256, assertActionItemReadInput, assertActionItemClientScopedPage'
    declarations.append(f'const {name} = create{factory}Validators({{{args}}});')
needle = 'export function assertSkillManifest('
assert text.count(needle) == 1
text = text.replace(needle, '\n'.join(declarations) + '\n\n' + needle)
needle = '...outreachQueryValidators, ...programElementValidators})});'
assert text.count(needle) == 1
loader_text = text.replace(needle, '...outreachQueryValidators, ...programElementValidators,\n    ' + ', '.join(names) + '})});')

registry = contracts / 'catalog-validation.mjs'
text = registry.read_text()
rows = []
operations = []
for group, factory, nested, contexts, bindings in families:
    name = factory[0].lower() + factory[1:] + 'Validators'
    for spec in bindings:
        op, request, result = spec[:3]
        context = contexts if contexts is not None else spec[3]
        native = 'query_action_items' if op == 'actions.query' else op
        args = 'binding.id, request, clock(context, binding.contextKeys)'
        output_args = 'binding.id, page, request, clock(context, binding.contextKeys)'
        normalized = f'v.{name}.normalizeInput({args})' if nested else f'v.normalize{factory}Input({args})'
        checked = f'v.{name}.assertResult({output_args})' if nested else f'v.assert{factory}Output({output_args})'
        if op == 'actions.query':
            normalized = '{input: v.normalizeActionItemsCompleteInput(request, clock(context, binding.contextKeys))}'
            checked = 'v.assertActionItemsCompleteResult(page, request, clock(context, binding.contextKeys))'
        rows.append(f"  Object.freeze({{id: '{op}', nativeId: '{native}', group: '{group}', input: '{request}', output: '{result}', version: '0.2.0',\n"
                    f'    contextKeys: Object.freeze({json.dumps(context)}),\n'
                    f'    normalize: (v, request, context, binding) => ({normalized}),\n'
                    f'    outputAssert: (v, page, request, context, binding) => {checked}}}),\n')
        operations.append((group, op, native, request, result))
needle = 'export const CATALOG_OPERATION_BINDINGS = Object.freeze([\n'
assert text.count(needle) == 1
text = text.replace(needle, needle + ''.join(rows))
for repair in raw_repairs:
    prefix = f"id: '{repair['id']}', nativeId: '{repair['id']}', group: '{repair['group']}', input: "
    old_input = prefix + repr(repair['before'])
    assert text.count(old_input) == 1, repair['id']
    text = text.replace(old_input, prefix + repr(repair['after']))
text = text.replace("nativeCoverage: 'partial', group: 'operational-reads'", "nativeCoverage: 'partial', supersededBy: 'actions.query', group: 'operational-reads'", 1)
old = """        if (original.state !== 'pending' || original.replacement !== null || operation.aliases.length !== 0)
          fail('Partial native coverage cannot claim a replacement or compatibility alias');"""
new = """        if (operation.aliases.length !== 0) fail('Partial native coverage cannot claim a compatibility alias');
        if (binding.supersededBy) {
          const successor = bindings.get(binding.supersededBy);
          const expected = successor && {id: successor.id, version: successor.version};
          if (!successor || successor.nativeCoverage === 'partial' || successor.nativeId !== binding.nativeId ||
              original.state !== 'mapped' || key(original.replacement ?? {}) !== key(expected) ||
              key(operation.replacement ?? {}) !== key(expected)) fail('Partial native successor mapping mismatch');
        } else if (original.state !== 'pending' || original.replacement !== null || operation.replacement !== null) {
          fail('Partial native coverage cannot claim a replacement');
        }"""
assert text.count(old) == 1
registry_text = text.replace(old, new)

catalog_file = contracts / 'catalog.json'
catalog = json.loads(catalog_file.read_text())
assert catalog['catalogVersion'] == '0.2.10' and len(catalog['operations']) == 71
catalog['catalogVersion'] = '0.2.11'
for repair in raw_repairs:
    descriptor = next(row for row in catalog['operations'] if row['operation']['id'] == repair['id'])
    before = descriptor['inputSchema']['id']
    assert before.endswith('#/$defs/' + repair['before'])
    descriptor['inputSchema']['id'] = before[:-len(repair['before'])] + repair['after']
partial = next(row for row in catalog['operations'] if row['operation']['id'] == 'query_action_items')
partial['replacement'] = {'id': 'actions.query', 'version': '0.2.0'}
partial['limitations'][:2] = [
    'Historical scoped-only contract; actions.query is the reviewed full native transport successor. This original partial validator remains unchanged.',
    'This scoped-only operation still refuses client-less listing; the successor declares tenant-only unscoped transport without establishing current access.',
]
for group, op, native, request, result in operations:
    source = contracts / (group + '.schema.json')
    schema = json.loads(source.read_text())
    assert request in schema['$defs'] and result in schema['$defs']
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    original = next(row for row in catalog['originals'] if row['id'] == native)
    assert original['state'] == 'pending' and original['replacement'] is None
    original.update(state='mapped', replacement={'id': op, 'version': '0.2.0'})
    descriptor = json.loads(json.dumps(catalog['operations'][-1]))
    descriptor.update(operation=original['replacement'], displayName=native.replace('_', ' ').capitalize(),
        whenToUse='Inspect the declared source projection through a qualified source owner under current authorization.',
        limitations=[
            'Pending private contract only; null handler, no enabled source or executable skill.',
            'Trusted context is an adapter assertion for projection correlation, never a current grant, source attestation or authorization decision.',
            'Local validation does not qualify identity, source access, completeness, cursor authentication, result release or runtime.',
            *accepted[group]['limitations']],
        sourceRequirements=[{'sourceId': group.replace('-', '_'), 'authority': 'derived', 'purpose': 'evidence'}],
        inputSchema={'id': schema['$id'] + '#/$defs/' + request, 'sha256': digest},
        outputSchema={'id': schema['$id'] + '#/$defs/' + result, 'sha256': digest},
        replacement=None, aliases=[], fixtureIds=['catalog.binding.' + op])
    catalog['operations'].append(descriptor)
assert len(catalog['operations']) == 71 + len(operations)
assert sum(row['state'] == 'mapped' for row in catalog['originals']) == 70 + len(operations)
loader.write_text(loader_text)
registry.write_text(registry_text)
catalog_file.write_text(json.dumps(catalog, indent=2) + '\n')
print(json.dumps({'typedUnavailable': len(catalog['operations']), 'mappedUnavailable': 70 + len(operations),
                  'selectedPending': 26 - len(operations), 'sourceEnabled': False}))
