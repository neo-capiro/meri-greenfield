"""Offline public source/packet checks only. No app, service or native imports."""
import hashlib
import json
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[5]
evidence = Path(__file__).resolve().parent
checks = []
def check(name, value):
    checks.append({'name': name, 'passed': bool(value)})
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def tree(ref):
    return {line.split(b'\t', 1)[1].decode(): line.split(b'\t', 1)[0].decode()
            for line in git('ls-tree', '-r', ref).splitlines()}
manifest = json.loads((evidence/'manifest.json').read_text())
for item in manifest['members']:
    raw = (root/item['path']).read_bytes()
    check('member:'+item['path'], len(raw) == item['bytes'] and hashlib.sha256(raw).hexdigest() == item['sha256'])
base = 'bc8b65cc7186e449cf20b4956e4cd88684b35325'
old, current = tree(base), tree('HEAD')
exceptions = {'packages/contracts/package.json','packages/contracts/package-lock.json','packages/contracts/README.md',
              'apps/control/document-application/README.md','apps/control/document-application/current.mjs','apps/control/document-application/index.mjs'}
retained = [p for p in old if p not in exceptions]
check('all-original-nonallocated-blobs-and-modes', all(old[p] == current.get(p) for p in retained))
package = json.loads((root/'packages/contracts/package.json').read_text())
prior = json.loads(git('show', base+':packages/contracts/package.json'))
check('old-export-mappings', all(package['exports'][k] == v for k,v in prior['exports'].items()))
check('package-version', package['version'] == '0.1.2')
lock = json.loads((root/'packages/contracts/package-lock.json').read_text())
prior_lock = json.loads(git('show', base+':packages/contracts/package-lock.json'))
lock['version'] = lock['packages']['']['version'] = prior_lock['version']
check('lock-dependencies-exact', lock == prior_lock)
metadata = json.loads((root/'packages/contracts/dist/document-application.metadata.json').read_text())
for item in metadata['sources']:
    raw = (root/'packages/contracts'/item['path']).read_bytes()
    check('canonical-source:'+item['path'], len(raw)==item['bytes'] and hashlib.sha256(raw).hexdigest()==item['sha256'])
receipt = json.loads((evidence/'public-final.json').read_text())
check('exact-final-replay', receipt['sourceHead']=='e91143dafe2da71546fdfb3b0152807032f4e9b8' and receipt['sourceDiffBytes']==0 and receipt['exitCode']==0)
for path in evidence.glob('*.json'):
    value=json.loads(path.read_text())
    if not isinstance(value,dict) or 'ownedProcessGroupAbsent' not in value: continue
    check('capture-cleanup:'+path.name, value['ownedProcessGroupAbsent'] and not value['timedOut'])
    for row in value['streams']:
        raw=(root/row['path']).read_bytes()
        check('raw-stream:'+row['path'],len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
result={'verdict':'PASS' if all(c['passed'] for c in checks) else 'FAIL','checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks),'originalsRetained':len(retained),'runtimeQualified':False}
(evidence/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='checks'}))
raise SystemExit(0 if result['verdict']=='PASS' else 1)
