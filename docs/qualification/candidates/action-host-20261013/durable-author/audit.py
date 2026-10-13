"""Offline Git/source/capture audit; no application/SQL execution."""
from pathlib import Path
import subprocess,json,hashlib
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='f8e3507307640ee6b4904782cfb20f2b05e5e7b0'
checks=[]
def check(name,condition):
    checks.append({'name':name,'passed':bool(condition)})
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
changes=[x.split('\t') for x in git('diff','--name-status',base,'HEAD').decode().splitlines()]
allowed=['apps/control/action-host/durable/','docs/qualification/candidates/action-host-20261013/durable-author/','docs/coordination/tasks/CODEX-ACTION-HOST-DURABLE-20261013.md','docs/coordination/reports/CODEX-ACTION-HOST-DURABLE-20261013.md']
check('every committed path allocated',all(any(p.startswith(a) for a in allowed) for _,p in changes))
check('every original Git entry preserved',all(status=='A' for status,_ in changes))
check('production tokens unchanged from reviewed initial (leading comment precision only)',git('show','218379df:apps/control/action-host/durable/index.mjs').split(b'\n',1)[1]==(root/'apps/control/action-host/durable/index.mjs').read_bytes().split(b'\n',1)[1])
source=(root/'apps/control/action-host/durable/index.mjs').read_text()
check('production graph no fixture imports','fixture' not in source and '/test/' not in source)
check('no new SQL/DDL in production index',not any(x in source for x in ['SELECT ','INSERT ','UPDATE ','CREATE TABLE']))
check('no pool creation/end or native adapter',not any(x in source for x in ['.end(', 'new Pool', 'node:net', 'node:http']))
check('old tests unmodified',not any('/test/' in p and status!='A' for status,p in changes))
for label,expected in [('initial',1),('read-clock-repair',0)]:
    r=json.loads((evidence/(label+'.json')).read_text())
    check(label+' expected exit',r['exitCode']==expected)
    check(label+' physically absent owned group',r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
    check(label+' exact source no dirty delta',r['sourceDiffBytes']==0)
    for s in r['streams']:
        b=(root/s['path']).read_bytes();check(label+' stream '+s['path'].rsplit('.',2)[-2],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
check('focused exact eleven success','ℹ pass 11\nℹ fail 0' in (evidence/'read-clock-repair.stdout.bin').read_text())
check('initial fixture failures retained','ℹ pass 3\nℹ fail 8' in (evidence/'initial.stdout.bin').read_text())
# Distinguish fixture-only clock repair from product edits and preserve original assertions.
check('clock repair only test fixture plus retained receipt',all(p.startswith('docs/qualification/') or p=='apps/control/action-host/durable/test/fixture.mjs' for p in git('diff','--name-only','218379df','8d8ae474').decode().splitlines()))
check('original test assertion bytes unchanged',git('show','218379df:apps/control/action-host/durable/test/durable.test.mjs')==(root/'apps/control/action-host/durable/test/durable.test.mjs').read_bytes())
result={'base':base,'sourceHead':git('rev-parse','HEAD').decode().strip(),'originalEntryCount':len(git('ls-tree','-r','--name-only',base).splitlines()),'passed':sum(x['passed'] for x in checks),'total':len(checks),'checks':checks,'scope':'offline only; no native engine or source calls'}
(evidence/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
raise SystemExit(0 if result['passed']==result['total'] else 1)
