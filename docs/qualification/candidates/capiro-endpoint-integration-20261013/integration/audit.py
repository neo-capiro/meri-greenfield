"""Bounded metadata-only source/preservation audit; no native service access."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
PACKET = Path(__file__).parent
BASE = 'a0614e7e16d6f92d0ca6eaa192cea7c5def21ec8'
AUTHOR = '9063f707e2ac618b0dcf5bb0c5165d13914748e6'
AUTHOR_PACKET = 'e37a648d464ae2fade173f8eda7fd6f60f7d7649'
REVIEW = os.environ['MERI_ENDPOINT_REVIEW_FREEZE']
FIXTURE = 'apps/control/action-host/application-adapters/cross-repo/'
INDEPENDENT = 'apps/control/action-host/application-adapters/cross-repo-independent/'
EVIDENCE = 'docs/qualification/candidates/capiro-endpoint-integration-20261013/'
checks = []


def check(condition, label):
    assert condition, label
    checks.append(label)


def git(*args, repository=None):
    command = ['git', '-c', 'gc.auto=0']
    if repository:
        command.append('--git-dir=' + repository)
    return subprocess.check_output(command + list(args), cwd=ROOT, timeout=20)


def tree(ref):
    entries = {}
    for row in git('ls-tree', '-rz', ref).split(b'\0'):
        if row:
            meta, path = row.split(b'\t', 1)
            entries[path.decode()] = meta.decode()
    return entries


def digest(data):
    return hashlib.sha256(data).hexdigest()


before, current, reviewed = tree(BASE), tree('HEAD'), tree(REVIEW)
allowed = {'apps/control/action-host/application-adapters/README.md',
           'apps/control/action-host/application-adapters/authority-http.mjs'}
check(set(before) <= set(current), 'all original entries remain')
unchanged = sum(current[path] == value for path, value in before.items())
check(unchanged == len(before) - 2, 'only two allocated existing entries changed')
check(all(current[path] == value for path, value in before.items() if path not in allowed),
      'all original tests/contracts/catalog/migrations/evidence preserved')
transport = 'apps/control/action-host/application-adapters/authority-http.mjs'
check((ROOT / transport).read_bytes() == git('show', BASE + ':' + transport).replace(
    b'for the proposed Capiro authority bridge.', b'for the Capiro authority bridge.'),
    'production HTTP executable bytes unchanged')
source_blobs = []
for path in sorted(current):
    if path.startswith((FIXTURE, INDEPENDENT)) or path in allowed:
        check(current[path] == reviewed.get(path), 'review identity: ' + path)
        data = (ROOT / path).read_bytes()
        check(data == git('show', REVIEW + ':' + path), 'working identity: ' + path)
        source_blobs.append({'path': path, 'gitEntry': current[path], 'bytes': len(data),
                             'sha256': digest(data)})
for ref in (AUTHOR, AUTHOR_PACKET, REVIEW):
    check(subprocess.run(['git', '-c', 'gc.auto=0', 'merge-base', '--is-ancestor', ref, 'HEAD'],
          cwd=ROOT, timeout=10).returncode == 0, 'preserved reachable source/review: ' + ref)
check(not git('diff', '--check'), 'clean whitespace')
check(not git('diff', '--', 'apps', 'packages', 'services', 'scripts'), 'no uncommitted executable changes')
pins = json.loads((ROOT / FIXTURE / 'pins.json').read_text())
source_repository = os.environ['CAPIRO_SOURCE_REPOSITORY']
check(git('rev-parse', pins['commit'] + '^{tree}', repository=source_repository).decode().strip()
      == pins['tree'], 'exact external commit/tree')
check(len(pins['members']) == 19, 'nineteen external members')
check(sum(bool(member.get('sameAcceptedSource')) for member in pins['members']) == 8,
      'eight independently accepted external source files')
for member in pins['members']:
    data = git('show', pins['commit'] + ':' + member['path'], repository=source_repository)
    check(len(data) == member['bytes'] and digest(data) == member['sha256'],
          'external bytes: ' + member['path'])
compiler = Path(os.environ['MERI_TYPESCRIPT_MODULE']).read_bytes()
check(len(compiler) == pins['compiler']['bytes'] and digest(compiler) == pins['compiler']['sha256'],
      'exact caller supplied compiler bytes')
check(pins['compiler']['version'] == '5.9.3', 'compiler declared version')
metadata = json.loads((ROOT / EVIDENCE / 'author/source-identities.json').read_text())
check(metadata['commit'] == pins['commit'] and metadata['tree'] == pins['tree'], 'AST metadata exact pin')
check(len(metadata['selections']) == 22, 'twenty-two exact AST selections recorded')
catalog = json.loads((ROOT / 'packages/contracts/retrieval-0.2/catalog.json').read_text())
originals, operations = catalog['originals'], catalog['operations']
selected = [x for x in originals if x['disposition'] == 'selected']
deferred = [x for x in originals if x['disposition'] == 'deferred']
check((len(originals), len(selected), len(deferred), len(operations)) == (139, 96, 43, 97),
      'complete original capability ledger retained')
check(all(x['state'] == 'mapped' for x in selected), 'all selected capabilities remain mapped')
check(all(x['handler'] is None and x['availability'] == 'unimplemented'
          and x['qualification'] == 'pending' and x['retry']['maxRetries'] == 0 for x in operations),
      'all production operations remain unavailable')
manifests = {}
for role in ('author', 'review'):
    path = ROOT / EVIDENCE / role / 'manifest.json'
    manifest = json.loads(path.read_text())
    for member in manifest['members']:
        data = (ROOT / member['path']).read_bytes()
        check(len(data) == member['bytes'] and digest(data) == member['sha256'],
              role + ' packet member: ' + member['path'])
    manifests[role] = {'members': len(manifest['members']), 'sha256': digest(path.read_bytes())}
captures = []
for path in sorted(PACKET.glob('*.json')):
    receipt = json.loads(path.read_text())
    if 'ownedPidAndPgid' not in receipt:
        continue
    for stream in receipt['streams']:
        data = (ROOT / stream['path']).read_bytes()
        check(len(data) == stream['bytes'] and digest(data) == stream['sha256'],
              'root capture bytes: ' + stream['path'])
    check(receipt['exitCode'] == 0 and not receipt['timedOut']
          and receipt['ownedProcessGroupAbsent'] and not receipt['ownedGroupKillRequired'],
          'successful closed root process: ' + path.name)
    captures.append({'path': str(path.relative_to(ROOT)), 'group': receipt['ownedPidAndPgid']})
report = {'status': 'PASS', 'head': git('rev-parse', 'HEAD').decode().strip(), 'base': BASE,
          'authorSource': AUTHOR, 'authorPacket': AUTHOR_PACKET, 'reviewFreeze': REVIEW,
          'originalEntriesRetained': len(before), 'originalEntriesUnchanged': unchanged,
          'allocatedExistingChanges': sorted(allowed), 'sourceBlobs': source_blobs,
          'externalSource': {'commit': pins['commit'], 'tree': pins['tree'], 'members': 19,
                             'selections': 22, 'compiler': pins['compiler']},
          'ledger': {'originals': 139, 'selectedMapped': 96, 'deferred': 43, 'operations': 97,
                     'allUnavailable': True}, 'manifests': manifests, 'rootCaptures': captures,
          'checks': checks, 'checksPassed': len(checks), 'scope': 'ACCEPT_SOURCE_RUNTIME_HOLD'}
destination = PACKET / 'audit.json'
check(not destination.exists(), 'never overwrite audit evidence')
destination.write_text(json.dumps(report, indent=2) + '\n')
(PACKET / 'source-blobs.json').write_text(json.dumps(source_blobs, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'checksPassed': report['checksPassed'],
                  'originalEntries': len(before), 'unchanged': unchanged,
                  'sourceBlobs': len(source_blobs), 'manifests': manifests}))
