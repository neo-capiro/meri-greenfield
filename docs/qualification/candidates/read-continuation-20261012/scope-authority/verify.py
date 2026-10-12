"""Non-mutating offline verification of the exact scope-authority packet."""
import hashlib,json,subprocess,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
BASE='cff71e1ba8ca8dea8970ad0c778b580a73f84815'
PREFIX='docs/qualification/candidates/read-continuation-20261012/scope-authority/'
REPORT='docs/coordination/reports/CODEX-SCOPE-AUTHORITY-20261012.md'
checks=[]
def check(name,value):
 checks.append({'check':name,'pass':bool(value)})
 if not value:raise AssertionError(name)
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args])
def sha(b):return hashlib.sha256(b).hexdigest()
refs=json.loads((HERE/'reference-identities.json').read_text())['references']
for row in refs:
 key=row['commit']+':'+row['path'];b=git('show',key)
 check('reference bytes '+key,len(b)==row['bytes'] and sha(b)==row['sha256'] and git('rev-parse',key).decode().strip()==row['blob'])
ledger=json.loads((HERE/'deferred-ledger.json').read_text());entries=ledger['entries']
check('all43 unique IDs',len(entries)==len({r['id'] for r in entries})==43)
check('18 read25 write',sum(r['registryReadOnly'] for r in entries)==18 and sum(not r['registryReadOnly'] for r in entries)==25)
for row in entries:
 check('honest authority '+row['id'],row['authority']['classification']=='recorded_human_batch_approval' and not row['authority']['independentPrimaryHumanTranscriptLocated'] and not row['dispositionChangedByThisAudit'])
for row in json.loads((HERE/'offline-checks.json').read_text())['checks']:check('reconciliation '+row['check'],row['pass'])
names=git('ls-tree','-r','--name-only',BASE).decode().splitlines()
changed=git('diff','--name-status',BASE).decode().splitlines()
new=git('ls-files','--others','--exclude-standard').decode().splitlines()
allowed=lambda p:p==REPORT or p.startswith(PREFIX)
check('only allocated additions',all(l.startswith('A\t') and allowed(l[2:]) for l in changed) and all(allowed(p) for p in new))
check('all original tracked files unchanged',all(l[2:] not in names for l in changed))
check('no product source edits',all(not l[2:].startswith(('apps/','packages/','scripts/')) for l in changed))
capture=json.loads((HERE/'reconcile-initial.json').read_text())
check('reconcile succeeded and child reaped',capture['exitCode']==0 and capture['childReaped'])
for stream in ['stdout','stderr']:
 b=(HERE/('reconcile-initial.'+stream+'.bin')).read_bytes();check('retained '+stream,sha(b)==capture[stream+'Sha256'])
if '--packet' in sys.argv:
 for row in json.loads((HERE/'manifest.json').read_text())['members']:
  b=(ROOT/row['path']).read_bytes();check('packet '+row['path'],len(b)==row['bytes'] and sha(b)==row['sha256'])
print(json.dumps({'passed':len(checks),'failed':0,'base':BASE,'originalFilesPreserved':len(names),'referenceCount':len(refs),'checks':checks},indent=2))
