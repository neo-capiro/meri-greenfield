"""Read immutable source metadata only; no producer imports or execution."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
PRIVATE, MANIFEST = Path(sys.argv[1]), Path(sys.argv[2])
BASE = 'e94865529c5a1e97c79893527895f0b4b73be35f'
AUTHOR = '6e37343f7289ed8374b722d638f5d6e467f9808a'
checks = []


def check(label, condition):
    assert condition, label
    checks.append(label)


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def blob(root, ref, path):
    return git(root, 'show', ref + ':' + path)


manifest = json.loads(MANIFEST.read_text())
pin, current = manifest['pin'], manifest['observedCurrent']
check('exact reference pins', pin == 'fd8765ec01d292013758606204f2c9d886cd31c1'
      and current == '4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace')
refs, sources = [], {}
for row in manifest['references']:
    data = blob(PRIVATE, pin, row['path'])
    identity = git(PRIVATE, 'rev-parse', pin + ':' + row['path']).strip().decode()
    observed = git(PRIVATE, 'rev-parse', current + ':' + row['path']).strip().decode()
    digest = hashlib.sha256(data).hexdigest()
    check('pinned bytes/hash/blob: ' + row['path'], identity == row['blob']
          and digest == row['sha256'] and len(data) == row['bytes'])
    check('no observed drift: ' + row['path'], identity == observed == row['observedCurrentBlob'])
    refs.append({'path': row['path'], 'blob': identity, 'sha256': digest, 'bytes': len(data), 'observedCurrentBlob': observed})
    sources[row['path']] = data.decode()

schema = json.loads((ROOT / 'packages/contracts/retrieval-0.2/client-documents.schema.json').read_text())['$defs']


def interface(path, name):
    match = re.search(r'(?:export )?interface ' + name + r'[^\{]*\{(.*?)\n\}', sources[path], re.S)
    check('reference type exists: ' + name, match is not None)
    return {m[1]: {'required': not bool(m[2]), 'type': m[3]}
            for m in re.finditer(r'^\s{2}(\w+)(\??):\s*([^;]+);', match[1], re.M)}


cursor = interface('apps/api/src/meri/meri-document-read.helpers.ts', 'DocumentCursor')
readability = interface('apps/api/src/engagement/attachment-pdf-vision.ts', 'DocumentReadability')
for name, fields in [('ClientDocumentCursor', cursor), ('ClientDocumentReadability', readability)]:
    check('exact type fields: ' + name, set(fields) == set(schema[name]['properties']))
    check('exact required/optional fields: ' + name, {n for n, x in fields.items() if x['required']} == set(schema[name]['required']))
for field in ['status', 'method']:
    check('readability enum: ' + field, set(re.findall(r"'([^']+)'", readability[field]['type']))
          == set(schema['ClientDocumentReadability']['properties'][field]['enum']))
readiness = interface('apps/api/src/engagement/attachment-content.service.ts', 'ReadinessVerdict')
check('complete readiness machine-code vocabulary', set(re.findall(r"'([^']+)'", readiness['code']['type']))
      == set(schema['ClientDocumentListItem']['properties']['blockedReason']['anyOf'][0]['enum']))
section = interface('apps/api/src/engagement/attachment-section-extract.ts', 'AttachmentTextSection')
check('section-kind vocabulary exact', set(re.findall(r"'([^']+)'", section['sectionKind']['type']))
      == set(schema['ClientDocumentPayload']['properties']['sectionKind']['enum']))
check('section source vocabulary plus explicit transcript source', set(re.findall(r"'([^']+)'", section['source']['type'])) | {'transcription'}
      == set(schema['ClientDocumentPayload']['properties']['source']['enum']))

helper = sources['apps/api/src/meri/meri-document-read.helpers.ts']
service = sources['apps/api/src/meri/meri-tools.service.ts']
engagement = sources['apps/api/src/engagement/engagement.service.ts']
check('source uses UTF16 text slices and serialized slice cap', 'extracted.text.slice(start, end)' in helper
      and bool(re.search(r'JSON\.stringify\(extracted\.text\.slice\(start, end\)\)\.length\s*>\s*6500', helper)))
check('legacy case-folded search may change index length', 'extracted.text.toLowerCase().indexOf(input.query.toLowerCase()' in helper)
check('document helper emits evidence only from nonblank slice', bool(re.search(r'records:\s*payload\.text\.trim\(\)\s*\?', helper)))
check('tool visibility and denied-client owners remain separate', 'this.ensureClientVisible' in service and 'fetchDeniedClientIds' in service)
check('extractor has separate outcome and provider owners', 'recordExtractionOutcome' in engagement
      and ('transcribeAttachmentWithOpenAi' in engagement))


def tree(ref):
    return {r.split(b'\t', 1)[1].decode(): r.split(b'\t', 1)[0]
            for r in git(ROOT, 'ls-tree', '-rz', ref).split(b'\0') if r}


old, new = tree(BASE), tree(AUTHOR)
changed = [p for p in old if new.get(p) != old[p]]
check('all original files unchanged', changed == [])
check('only allocated source/test/outline added', set(new) - set(old) == {
    'packages/contracts/retrieval-0.2/client-documents.schema.json',
    'packages/contracts/retrieval-0.2/client-documents-validation.mjs',
    'packages/contracts/test/retrieval-client-documents.test.mjs',
    'docs/qualification/candidates/read-continuation-20261012/documents-author/outline.md'})
check('exact accepted tree', git(ROOT, 'rev-parse', AUTHOR + '^{tree}').strip().decode() == '12d8f588011843693a18fa9d4f5a2e9a51f55b32')
records = []
for path in ['packages/contracts/retrieval-0.2/client-documents.schema.json', 'packages/contracts/retrieval-0.2/client-documents-validation.mjs', 'packages/contracts/test/retrieval-client-documents.test.mjs']:
    data = blob(ROOT, AUTHOR, path)
    check('review source equals accepted author: ' + path, (ROOT / path).read_bytes() == data)
    records.append({'path': path, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
ev = ROOT / 'docs/qualification/candidates/read-continuation-20261012/documents-review'
frozen = json.loads((ev / 'repaired-draft-tested-source.json').read_text())
record = frozen['records'][-1]
check('29 independent assertions unchanged at exact replay', hashlib.sha256((ROOT / record['path']).read_bytes()).hexdigest() == record['sha256'])
for label in ['first-independent', 'query-controls', 'repaired-draft', 'exact-freeze']:
    receipt = json.loads((ev / (label + '.json')).read_text())
    for row in receipt['streams']:
        data = (ROOT / row['path']).read_bytes()
        check(label + ' raw stream hash: ' + row['path'].rsplit('.', 2)[-2], len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'])
    check(label + ' owned process group absent', receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'])
print(json.dumps({'source': AUTHOR, 'base': BASE, 'checksPassed': len(checks), 'checks': checks,
                  'unchangedOriginalFiles': len(old), 'references': refs, 'sourceFiles': records,
                  'privateBodiesEmitted': False, 'privateSourceExecuted': False, 'nativeOrNetworkActions': False}, indent=2))
