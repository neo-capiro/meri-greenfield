"""Offline source/receipt preservation only; never imports producer implementation."""
import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
BASE = 'a3e946c1fa264ae7b33205f5b87804ee1ef75773'
SOURCE = 'a25516ae8d2c44638800e492e439e212098dc750'
FILES = ['packages/contracts/retrieval-0.2/state-bill-identity.mjs',
         'packages/contracts/retrieval-0.2/state-status-votes.schema.json',
         'packages/contracts/retrieval-0.2/state-status-votes-validation.mjs',
         'packages/contracts/test/retrieval-state-status-votes.test.mjs']
checks = []
def check(name, condition): checks.append({'name': name, 'pass': bool(condition)})
def sha(data): return hashlib.sha256(data).hexdigest()
def git(*args, cwd=ROOT):
    return subprocess.run(['git', '-C', str(cwd), *args], check=True, capture_output=True, timeout=20).stdout
source_rows = []
for path in FILES:
    data = (ROOT/path).read_bytes()
    check('exact-source:'+path, data == git('show', SOURCE+':'+path))
    source_rows.append({'path': path, 'bytes': len(data), 'sha256': sha(data)})
changes = git('diff', '--name-status', BASE, SOURCE).decode().splitlines()
check('four-source-additions-only', sorted(changes) == sorted('A\t'+p for p in FILES))
original_count = len(git('ls-tree', '-r', '--name-only', BASE).decode().splitlines())
check('no-original-mutation', not git('diff', BASE, '--', ':(exclude)docs/coordination/reports/CODEX-STATE-STATUS-VOTES-AUTHOR-20261012.md', ':(exclude)docs/qualification/candidates/read-continuation-20261012/state-status-votes-author', *[':(exclude)'+p for p in FILES]))
check('owned-borrowed-links-removed', not (ROOT/'node_modules').exists() and not (ROOT/'packages/contracts/node_modules').exists())
refs = json.loads((HERE/'reference-identities.json').read_text())
for row in refs['references']:
    for name in ['frozen', 'observed']:
        ref = row[name]; loc = ref['commit']+':'+row['path']; data = git('show', loc, cwd='/workspace/capirov2')
        check('reference:'+name+':'+row['path'], len(data) == ref['bytes'] and sha(data) == ref['sha256'] and git('rev-parse',loc,cwd='/workspace/capirov2').decode().strip() == ref['blob'])
    check('no-drift:'+row['path'], row['unchanged'] and row['frozen']['blob'] == row['observed']['blob'])
check('private-bodies-not-retained', refs['privateBodiesRetained'] is False and refs['executed'] is False)
pre = json.loads((HERE/'initial-source.json').read_text())
for item in pre['files']:
    b = (HERE/item['preimage']).read_bytes(); check('initial-preimage:'+item['path'], len(b) == item['bytes'] and sha(b) == item['sha256'])
receipts = []
for label, expected in [('focused-initial',1),('focused-schema-repair',0),('root-source-check',1)]:
    receipt=json.loads((HERE/(label+'.json')).read_text());receipts.append(receipt)
    check('receipt-outcome:'+label, receipt['exitCode']==expected and receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'])
    for stream in receipt['streams']:
        b=(ROOT/stream['path']).read_bytes(); check('stream:'+stream['path'],len(b)==stream['bytes'] and sha(b)==stream['sha256'])
    check('capture-helper:'+label,sha((HERE/'capture-reaped.py').read_bytes())==receipt['captureSha256'])
check('focused-repair-diff-bound', receipts[1]['sourceDiffSha256']==sha(git('diff',BASE,SOURCE,'--','apps','packages','scripts','package.json','package-lock.json')))
check('root-exact-freeze',receipts[2]['sourceHead']==SOURCE and receipts[2]['sourceDiffBytes']==0)
failed=[c['name'] for c in checks if not c['pass']]
print(json.dumps({'scope':'OFFLINE_SOURCE_EVIDENCE_ONLY','sourceCommit':SOURCE,'originalFilesPreserved':original_count,'sourceFiles':source_rows,'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks,'localTestResults':{'focusedInitial':'strict Ajv compile failed before behavioral execution','focusedRepaired':'22/22 PASS','root':'1396/1398 PASS; generated browser drift and borrowed Ajv realpath denied','publicSeparate':'NOT RUN; root combined checks own follow-up'},'ownedProcessGroups':[{'pgid':r['ownedPidAndPgid'],'absent':r['ownedProcessGroupAbsent'],'reapedDescendants':r['reapedDescendants']} for r in receipts]},indent=2))
raise SystemExit(1 if failed else 0)
