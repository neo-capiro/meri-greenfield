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
assert 'actions.query' in new_ids
same_ids = [name for name in new_ids if name != 'actions.query']
typed = len(catalog['operations'])
mapped = sum(row['state'] == 'mapped' for row in catalog['originals'])
pending = 96 - mapped
raw = json.loads((packet / 'raw-request-admission-before.json').read_text())['rows']
prior = json.loads(subprocess.check_output(['git', 'show', base + ':docs/qualification/candidates/read-continuation-20261012/backend-next-integration/test-expectation-updates.json'], cwd=root))
paths = [row['path'] for row in prior['changes']] + ['packages/contracts/test/retrieval-backend-next-independent.test.mjs']
helper = root / 'packages/contracts/test/backend-execution-expectations.mjs'
helper.write_text('''// Exact declared expected deltas to immutable historical snapshots.
// No field is ignored; old callbacks, hashes, outputs and behavior still compare.
export const addedOperations = Object.freeze(''' + json.dumps(new_ids) + ''');
export const fullActionReference = Object.freeze({id:'actions.query',version:'0.2.0'});
const rawRequests = Object.freeze(''' + json.dumps({row['id']: row['after'] for row in raw}) + ''');
export function expectedExistingDescriptor(row) {
  let result=row;
  if(rawRequests[row.operation.id]) result={...result,inputSchema:{...result.inputSchema,id:result.inputSchema.id.replace(/#\\/\\$defs\\/[^/]+$/,'#/$defs/'+rawRequests[row.operation.id])}};
  if(row.operation.id==='query_action_items') result={...result,replacement:fullActionReference,limitations:[
    'Historical scoped-only contract; actions.query is the reviewed full native transport successor. This original partial validator remains unchanged.',
    'This scoped-only operation still refuses client-less listing; the successor declares tenant-only unscoped transport without establishing current access.',
    ...result.limitations.slice(2)]};
  return result;
}
export function expectedExistingBinding(row) {
  let result=row;
  if(rawRequests[row.id])result={...result,input:rawRequests[row.id]};
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
            text = text.replace(old, new)
            edits.append({'old': old, 'new': new, 'count': count})
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
    for end in [')),(k,v)', ')), (k,v)']:
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
    edit("['query_action_items','get_research_evidence']", "['get_research_evidence']")
    edit("['query_global_data','save_memory'", "['save_memory'")
    edit("['query_global_data','create_task'", "['create_task'")
    edit("'FloridaBudgetInput'", "'FloridaBudgetRequest'")
    edit('Florida normalized Input pin retains raw defaults', 'Florida raw Request pin admits defaults')
    edit("['list_emails','search_emails','memory.list_own_proposals']", "['list_global_datasets','list_emails','search_emails','memory.list_own_proposals']")
    used = [fn for fn in ['addedOperations', 'fullActionReference', 'expectedExistingDescriptor', 'expectedExistingBinding', 'expectedExistingOriginal'] if fn in text]
    if used:
        relative = './backend-execution-expectations.mjs' if name.startswith('packages/contracts/') else '../../../packages/contracts/test/backend-execution-expectations.mjs'
        new_import = 'import {' + ','.join(used) + '} from ' + repr(relative) + ';\n'
        old_text = text
        text = new_import + text
        edits.append({'old': old_text, 'new': text, 'count': 1, 'wholeFileStep': True})
    assert edits, name
    inverse = text
    for item in reversed(edits):
        assert inverse.count(item['new']) == item['count'], (name, item['new'][:90])
        inverse = inverse.replace(item['new'], item['old'])
    assert inverse.encode() == before, name
    path.write_text(text)
    changes.append({'path': name, 'beforeSha256': hashlib.sha256(before).hexdigest(),
                    'afterSha256': hashlib.sha256(text.encode()).hexdigest(), 'inverseExact': True,
                    'replacements': edits})
(packet / 'test-expectation-updates.json').write_text(json.dumps({'base': base,
    'explicitNewOperations': new_ids, 'rawRequestRepairs': [row['id'] for row in raw],
    'changes': changes, 'note': 'Original behavior assertions remain; exact field/count/compatibility expectations change explicitly.'}, indent=2) + '\n')
print(json.dumps({'files': len(changes), 'inverseExact': True, 'typed': typed, 'mapped': mapped, 'pending': pending}))
