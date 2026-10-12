"""Read-only immutable source/DTO metadata audit. Never print private bodies."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
PRIVATE = Path(sys.argv[1])
BASE = 'e0163fb65a639a28d9423e929058b40b48cc556d'
AUTHOR = '088cfa10df8af518795a10590ce3e17c8b4fad8a'
PIN = 'fd8765ec01d292013758606204f2c9d886cd31c1'
CURRENT = '4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace'
EVIDENCE = 'docs/qualification/candidates/capability-next-20261012/'
checks = []


def git(repository, *args):
    return subprocess.check_output(['git', '-C', str(repository), *args])


def blob(repository, ref, path):
    return git(repository, 'show', ref + ':' + path)


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    checks.append(label)


manifest = json.loads((ROOT / EVIDENCE / 'portfolio-author/source-reference-manifest.json').read_text())
sources = {}
records = []
for record in manifest['references']:
    path = record['path']
    data = blob(PRIVATE, PIN, path)
    original_blob = git(PRIVATE, 'rev-parse', PIN + ':' + path).strip().decode()
    current_blob = git(PRIVATE, 'rev-parse', CURRENT + ':' + path).strip().decode()
    digest = hashlib.sha256(data).hexdigest()
    check('pinned reference hash: ' + path, original_blob == record['blob']
          and len(data) == record['bytes'] and digest == record['sha256'])
    check('observed reference unchanged: ' + path, current_blob == original_blob == record['observedCurrentBlob'])
    sources[path] = data.decode()
    records.append({'path': path, 'blob': original_blob, 'sha256': digest, 'bytes': len(data), 'observedCurrentBlob': current_blob})

shared = sources['packages/shared/src/research-portfolios.ts']
schema = json.loads((ROOT / 'packages/contracts/retrieval-0.2/research-portfolio.schema.json').read_text())


def fields(name):
    match = re.search(r'export interface ' + name + r'([^\{]*)\{(.*?)\n\}', shared, re.S)
    check('declared DTO exists: ' + name, match is not None)
    result = {}
    for parent in re.findall(r'extends\s+(\w+)', match[1]):
        result.update(fields(parent))
    result.update({m[1]: not bool(m[2]) for m in re.finditer(r'^\s{2}([\w]+)(\??):\s*([^;]+);', match[2], re.M)})
    return result


for suffix, definition in [('DetailDto', 'DetailData'), ('GrantDto', 'Grant'), ('ClientLinkDto', 'ClientLink'),
                           ('MemberDto', 'Member'), ('EventDto', 'Event'), ('EventRecipientStateDto', 'RecipientState')]:
    actual = fields('ResearchPortfolio' + suffix)
    declared = schema['$defs']['ResearchPortfolio' + definition]
    check('DTO property names exact: ' + suffix, set(actual) == set(declared['properties']))
    check('DTO required versus optional exact: ' + suffix, {key for key, required in actual.items() if required} == set(declared['required']))

for type_name, definition, field in [('Mode', 'DetailData', 'mode'), ('Lifecycle', 'DetailData', 'lifecycle'),
                                    ('GrantRole', 'Grant', 'role'), ('MemberKind', 'Member', 'targetKind'),
                                    ('MemberDisposition', 'Member', 'disposition'), ('MemberOrigin', 'Member', 'origin'),
                                    ('EventKind', 'Event', 'eventKind')]:
    match = re.search(r'export type ResearchPortfolio' + type_name + r'\s*=([^;]+);', shared, re.S)
    check('DTO enum exact: ' + type_name, match is not None
          and set(re.findall(r"'([^']+)'", match[1])) == set(schema['$defs']['ResearchPortfolio' + definition]['properties'][field]['enum']))

detail = sources['apps/api/src/research-portfolios/research-portfolios.service.ts']
changes = sources['apps/api/src/research-portfolios/research-portfolio-changes.service.ts']
tools = sources['apps/api/src/research-portfolios/research-portfolio-meri-tools.service.ts']
access = sources['apps/api/src/research-portfolios/research-portfolio-access.ts']
scope = sources['apps/api/src/research-portfolios/research-portfolio-meri-scope.service.ts']
checks_to_match = {
    'detail member count uses database members count': (detail, r'memberCount:\s*row\._count\.members'),
    'detail client count uses visible-link override': (detail, r'clientLinks:\s*visibleClientLinks\.length'),
    'detail fetches member projection without page filter': (detail, r'members:\s*\{\s*orderBy:'),
    'changes uses visible event prefix': (changes, r'const page\s*=\s*visible\.slice\(0,\s*limit\)'),
    'non-null cursor requires surplus visible events': (changes, r'nextCursor:\s*visible\.length\s*>\s*limit\s*\?'),
    'changes cursor names last projected event': (changes, r'nextCursor:[^\n]*page\.at\(-1\)\?\.id'),
    'changes recipient filter uses current actor': (changes, r'recipientUserId:\s*ctx\.userId'),
    'changes orders descending time then id': (changes, r'orderBy:\s*\[\s*\{\s*occurredAt:\s*\x27desc\x27\s*\},\s*\{\s*id:\s*\x27desc\x27\s*\}'),
    'portfolio access query scopes tenant': (access, r'tenantId:\s*ctx\.tenantId'),
    'portfolio access requires actor grant': (access, r'principalUserId:\s*ctx\.userId'),
    'scope owner keeps captured versus current revision distinct': (scope, r'current\.researchPortfolioRevision\s*!==\s*stored\.researchPortfolioRevision'),
}
for label, (body, pattern) in checks_to_match.items():
    check(label, bool(re.search(pattern, body)))
start = tools.index('tx.clioConversation.findFirst')
lookup = tools[start:start + 600]
check('conversation lookup correlates ID/tenant/actor and excludes archived', all(re.search(pattern, lookup) for pattern in
      [r'id:\s*conversationId', r'tenantId:\s*ctx\.tenantId', r'userId:\s*ctx\.userId', r'archivedAt:\s*null']))
check('detail and changes apply denied-client masking', 'clientMemoryAllowed' in detail
      and 'deniedClientIds.some' in detail and 'this.referencesDeniedClient' in changes)
check('both producers call their portfolio authorization owner', 'this.loadAuthorized' in detail and 'loadAuthorizedResearchPortfolio' in changes)


def tree(ref):
    return {x.split(b'\t', 1)[1].decode(): x.split(b'\t', 1)[0]
            for x in git(ROOT, 'ls-tree', '-rz', ref).split(b'\0') if x}


old, new = tree(BASE), tree(AUTHOR)
changed = [path for path in old if old[path] != new.get(path)]
check('only root canonical admission export changes an original file', changed == ['packages/contracts/retrieval-0.2/operation-contracts.mjs'])
check('5054 of 5055 original files preserved', len(old) == 5055 and len(old) - len(changed) == 5054)
helper = 'packages/contracts/retrieval-0.2/operation-contracts.mjs'
check('helper dependency equals root exact export', blob(ROOT, AUTHOR, helper) == blob(ROOT, '685fe100233da10991485be49b2a1e8e31dd8308', helper))
first = json.loads((ROOT / EVIDENCE / 'portfolio-review/first-independent-source.json').read_text())
test_record = first['records'][0]
check('independent controls unchanged after failure', hashlib.sha256((ROOT / test_record['path']).read_bytes()).hexdigest() == test_record['sha256'])
source_records = []
for path in [helper, 'packages/contracts/retrieval-0.2/research-portfolio-validation.mjs', 'packages/contracts/retrieval-0.2/research-portfolio.schema.json', 'packages/contracts/test/retrieval-research-portfolio.test.mjs']:
    data = blob(ROOT, AUTHOR, path)
    check('review source equals exact author: ' + path, (ROOT / path).read_bytes() == data)
    source_records.append({'path': path, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
print(json.dumps({'base': BASE, 'author': AUTHOR, 'pin': PIN, 'observedCurrent': CURRENT,
                  'checksPassed': len(checks), 'checks': checks, 'references': records,
                  'source': source_records, 'originalFiles': len(old), 'unchangedOriginalFiles': len(old)-len(changed),
                  'privateBodiesEmitted': False, 'privateSourceExecuted': False, 'nativeOrNetworkActions': False}, indent=2))
