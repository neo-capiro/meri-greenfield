"""Reversible, explicit historical catalog expectations; no behavior assertion removal."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
base = '1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
catalog = json.loads((root / 'packages/contracts/retrieval-0.2/catalog.json').read_text())
old_catalog = json.loads(subprocess.check_output(['git', 'show', base + ':packages/contracts/retrieval-0.2/catalog.json'], cwd=root))
old_ids = {row['operation']['id'] for row in old_catalog['operations']}
new_ids = [row['operation']['id'] for row in catalog['operations'] if row['operation']['id'] not in old_ids]
expected_ids = ['read_chat_attachments','read_monday_client_boards','get_client_context','search_client_knowledge','query_knowledge_graph','search_memory','search_research_sources','search_legislative_research','get_legal_reference','query_global_data','search_committee_hearings','search_legiwatch_news','actions.query']
assert set(new_ids) == set(expected_ids) and len(new_ids) == 13
same_ids = [name for name in new_ids if name != 'actions.query']
typed = len(catalog['operations'])
mapped = sum(row['state'] == 'mapped' for row in catalog['originals'])
pending = 96 - mapped
assert (typed, mapped, pending) == (84,83,13)
raw = json.loads((packet / 'raw-request-admission-before.json').read_text())['rows']
assert len(raw) == 31 and sum(not row['previousAdvertisementAdmittedRequest'] for row in raw) == 22
prior = json.loads(subprocess.check_output(['git', 'show', base + ':docs/qualification/candidates/read-continuation-20261012/backend-next-integration/test-expectation-updates.json'], cwd=root))
paths = [row['path'] for row in prior['changes']] + ['packages/contracts/test/retrieval-backend-next-independent.test.mjs']
helper = root / 'packages/contracts/test/backend-execution-expectations.mjs'
helper.write_text('''// Exact declared expected deltas to immutable historical snapshots.
import assert from 'node:assert/strict';
// No field is ignored; old callbacks, hashes, outputs and behavior still compare.
export const addedOperations = Object.freeze(''' + json.dumps(new_ids) + ''');
export const fullActionReference = Object.freeze({id:'actions.query',version:'0.2.0'});
const rawRequests = Object.freeze(''' + json.dumps({row['id']: {'before': row['before'], 'after': row['after']} for row in raw}) + ''');
export function expectedExistingDescriptor(row) {
  let result=row;
  if(rawRequests[row.operation.id]) {
    const change=rawRequests[row.operation.id], suffix='#/$defs/'+change.before;
    if(!result.inputSchema.id.endsWith(suffix)) throw Error('Unexpected historical input schema: '+row.operation.id);
    result={...result,inputSchema:{...result.inputSchema,id:result.inputSchema.id.slice(0,-suffix.length)+'#/$defs/'+change.after}};
  }
  if(row.operation.id==='query_action_items') result={...result,replacement:fullActionReference,limitations:[
    'Historical scoped-only contract; actions.query is the reviewed full native transport successor. This original partial validator remains unchanged.',
    'This scoped-only operation still refuses client-less listing; the successor declares tenant-only unscoped transport without establishing current access.',
    ...result.limitations.slice(2)]};
  return result;
}
// Only the declared changed fields are reversed; all other bytes remain hashed.
export function priorExistingDescriptor(row) {
  let result=row;
  if(rawRequests[row.operation.id]) {
    const change=rawRequests[row.operation.id],suffix='#/$defs/'+change.after;
    assert.ok(result.inputSchema.id.endsWith(suffix));
    result={...result,inputSchema:{...result.inputSchema,id:result.inputSchema.id.slice(0,-suffix.length)+'#/$defs/'+change.before}};
  }
  if(row.operation.id==='query_action_items') {
    const originalLimitations=["Partial native coverage only: the original query_action_items capability remains pending with no replacement mapping.", "Client-less legacy listing has no qualified authorization or result contract and is refused."];
    assert.deepEqual(row.replacement,fullActionReference);
    const expected=expectedExistingDescriptor({...row,replacement:null,limitations:[...originalLimitations,...row.limitations.slice(2)]});
    assert.deepEqual(row.limitations,expected.limitations);
    result={...result,replacement:null,limitations:[...originalLimitations,...result.limitations.slice(2)]};
  }
  return result;
}
export function expectedExistingBinding(row) {
  let result=row;
  if(rawRequests[row.id]) {
    const change=rawRequests[row.id];
    if(row.input!==change.before)throw Error('Unexpected historical binding input: '+row.id);
    result={...result,input:change.after};
  }
  if(row.id==='query_action_items')result={...result,supersededBy:'actions.query'};
  if(row.id==='list_global_datasets')result={...result,dispatchProfile:'dataset-metadata/1'};
  return result;
}
export function expectedExistingOriginal(row) {
  if(row.id==='query_action_items')return {...row,state:'mapped',replacement:fullActionReference};
  if(addedOperations.includes(row.id))return {...row,state:'mapped',replacement:{id:row.id,version:'0.2.0'}};
  return row;
}
''')
changes = []
planned = []
for name in paths:
    before = subprocess.check_output(['git', 'show', base + ':' + name], cwd=root)
    path = root / name
    assert path.read_bytes() == before, name
    text = before.decode()
    edits = []
    def edit(old, new, required=False):
        global text
        count = text.count(old)
        assert count or not required, (name, old)
        if count:
            positions = [match.start() for match in re.finditer(re.escape(old),text)]
            text = text.replace(old, new)
            edits.append({'old': old, 'new': new, 'count': count, 'positionsBefore': positions})
    # Existing explicitly enumerated continuations gain only the newly mapped
    # same-name operations. The differently named action successor is handled
    # explicitly so the old scoped-only descriptor remains compared.
    edit('"get_pe_budget_timeline"', '"get_pe_budget_timeline", ' + ', '.join(json.dumps(x) for x in same_ids))
    for space in ['', ' ']:
        for a, b in [(26, pending), (70, mapped), (71, typed)]:
            edit('.length,' + space + str(a) + ')', '.length,' + space + str(b) + ')')
        edit('.size,' + space + '71)', '.size,' + space + str(typed) + ')')
    edit("'0.2.10'", "'0.2.11'")
    edit('all 71', f'all {typed}')
    edit('all71', f'all{typed}')
    if name.endswith('retrieval-backend-next-independent.test.mjs'):
        edit('!ids.includes(x.operation.id)', '!ids.includes(x.operation.id)&&!addedOperations.includes(x.operation.id)', True)
        edit('!ids.includes(x.id)', '!ids.includes(x.id)&&!addedOperations.includes(x.id)', True)
    # Keep every prior descriptor and callback comparison, with an explicit
    # expected transformation of only accepted field changes.
    for value in ['baseline', 'base', 'oldCatalog']:
        for field in ['operations', 'descriptors']:
            old = value + '.' + field
            if old in text:
                edit(old, old + '.map(expectedExistingDescriptor)')
        pattern = re.compile(r'\b' + value + r'\.originals\b')
        if pattern.search(text):
            old = value + '.originals'
            # Exact match avoids historical originalsSha256 fields.
            old_text = text
            text = pattern.sub(old + '.map(expectedExistingOriginal)', text)
            edits.append({'old': old_text, 'new': text, 'count': 1, 'wholeFileStep': True})
    edit(',oldBindings)', ',oldBindings.map(expectedExistingBinding))')
    # All historical descriptor filters must also omit the new successor, not
    # the original partial descriptor whose unchanged behavior remains tested.
    for token in ['x', 'row', 'd']:
        pattern = re.compile(r'((?:catalog|c)\.operations\.filter\(' + token + r'=>[^\n;]+?)(\),(?:baseline|base|oldCatalog)\.(?:operations|descriptors))')
        matches = list(pattern.finditer(text))
        for match in reversed(matches):
            old = match.group(0)
            new = match.group(1) + f"&&{token}.operation.id!=='actions.query'" + match.group(2)
            edit(old, new)
    # Binding snapshot filters also retain the old partial row.
    for end in ['),(k,v)', '), (k,v)']:
        # All such filters use x in the reviewed predecessors.
        edit('!civicIds.includes(x.id)' + end, "!civicIds.includes(x.id)&&x.id!=='actions.query'" + end)
        edit('!observedIds.includes(x.id)' + end, "!observedIds.includes(x.id)&&x.id!=='actions.query'" + end)
        edit('!backendIds.includes(x.id)' + end, "!backendIds.includes(x.id)&&x.id!=='actions.query'" + end)
    # Actual loop/hash expectations for the original partial capability now
    # point only to the full successor; the partial-refusal mutants stay intact.
    edit("assert.equal(catalog.originals.find(x=>x.id===operation.id).replacement,null)", "assert.deepEqual(catalog.originals.find(x=>x.id===operation.id).replacement,fullActionReference)")
    edit("assert.equal(catalog.originals.find(x=>x.id==='query_action_items').replacement,null)", "assert.deepEqual(catalog.originals.find(x=>x.id==='query_action_items').replacement,fullActionReference)")
    edit("assert.equal(c.originals.find(row => row.id==='query_action_items').state,'pending')", "assert.equal(c.originals.find(row => row.id==='query_action_items').state,'mapped')")
    edit("assert.equal(c.originals.find(row => row.id==='query_action_items').replacement,null)", "assert.deepEqual(c.originals.find(row => row.id==='query_action_items').replacement,fullActionReference)")
    edit("assert.equal(original.state,'pending');assert.equal(original.replacement,null)", "assert.equal(original.state,'mapped');assert.deepEqual(original.replacement,fullActionReference)")
    edit("  assert.equal(sha(priorRows),baseline.originalsSha256);", "  const fullAction=priorRows.find(row=>row.id==='query_action_items');\n  assert.deepEqual(fullAction.replacement,fullActionReference);fullAction.state='pending';fullAction.replacement=null;\n  assert.equal(sha(priorRows),baseline.originalsSha256);")
    edit(" assert.equal(canonicalSha256(priorRows),'74208a71fccd5403609980a19a51505dc566826c4e56449451306d39db2f18e9');", " const fullAction=priorRows.find(row=>row.id==='query_action_items');\n assert.deepEqual(fullAction.replacement,fullActionReference);assert.equal(fullAction.state,'mapped');fullAction.state='pending';fullAction.replacement=null;\n assert.equal(canonicalSha256(priorRows),'74208a71fccd5403609980a19a51505dc566826c4e56449451306d39db2f18e9');")
    edit("assert.equal(catalog.originals.find(x=>x.id==='query_action_items').state,'pending')", "assert.equal(catalog.originals.find(x=>x.id==='query_action_items').state,'mapped')")
    edit("['query_action_items', 'get_research_evidence']", "['get_research_evidence']")
    edit("['query_action_items','get_research_evidence']", "['get_research_evidence']")
    edit("['query_global_data','save_memory'", "['save_memory'")
    edit("['query_global_data','create_task'", "['create_task'")
    edit("'FloridaBudgetInput'", "'FloridaBudgetRequest'")
    edit('Florida normalized Input pin retains raw defaults', 'Florida raw Request pin admits defaults')
    edit("[['mail.list_messages','mail-candidates/1']", "[['list_global_datasets','dataset-metadata/1'],['mail.list_messages','mail-candidates/1']")
    if name.endswith('retrieval-memory-binding.test.mjs'):
        edit("[reference.id,'query_action_items',", "[reference.id,'query_action_items','actions.query',")
    if name.endswith('retrieval-next-bindings.test.mjs'):
        edit("catalog.operations.filter(row => !additions.includes(row.operation.id)&&!continuationIds.includes(row.operation.id))", "catalog.operations.filter(row => !additions.includes(row.operation.id)&&!continuationIds.includes(row.operation.id)&&row.operation.id!=='actions.query').map(priorExistingDescriptor)", True)
    used = [fn for fn in ['addedOperations', 'fullActionReference', 'expectedExistingDescriptor', 'expectedExistingBinding', 'expectedExistingOriginal', 'priorExistingDescriptor'] if fn in text]
    if used:
        relative = './backend-execution-expectations.mjs' if name.startswith('packages/contracts/') else '../../../packages/contracts/test/backend-execution-expectations.mjs'
        new_import = 'import {' + ','.join(used) + '} from ' + repr(relative) + ';\n'
        old_text = text
        text = new_import + text
        edits.append({'old': old_text, 'new': text, 'count': 1, 'wholeFileStep': True})
    assert edits, name
    inverse = text
    for item in reversed(edits):
        if item.get('wholeFileStep'):
            assert inverse == item['new'], name
            inverse = item['old']
        else:
            delta = len(item['new']) - len(item['old'])
            positions = [pos + index * delta for index,pos in enumerate(item['positionsBefore'])]
            for pos in reversed(positions):
                assert inverse[pos:pos+len(item['new'])] == item['new'], (name,pos)
                inverse = inverse[:pos] + item['old'] + inverse[pos+len(item['new']):]
    assert inverse.encode() == before, name
    planned.append((path,text))
    changes.append({'path': name, 'beforeSha256': hashlib.sha256(before).hexdigest(),
                    'afterSha256': hashlib.sha256(text.encode()).hexdigest(), 'inverseExact': True,
                    'replacements': edits})
for path,text in planned:
    path.write_text(text)
(packet / 'test-expectation-updates.json').write_text(json.dumps({'base': base,
    'explicitNewOperations': new_ids, 'rawRequestRepairs': [row['id'] for row in raw],
    'changes': changes, 'note': 'Original behavior assertions remain; exact field/count/compatibility expectations change explicitly.'}, indent=2) + '\n')
print(json.dumps({'files': len(changes), 'inverseExact': True, 'typed': typed, 'mapped': mapped, 'pending': pending}))
