"""Offline immutable source/receipt audit; no services or package lifecycle execution."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='158fa00828cd46864c20f481a998c9d3e9cc236a'
checks=[]
def check(name,condition):
    checks.append({'name':name,'pass':bool(condition)})
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
    result={}
    for row in git('ls-tree','-rz','--full-tree',ref).split(b'\0'):
        if row:
            meta,path=row.split(b'\t',1);result[path.decode()]=meta.decode()
    return result
head=git('rev-parse','HEAD').decode().strip();before,after=tree(base),tree(head)
changed=[p for p,v in before.items() if after.get(p)!=v]
check('all original tracked paths retain exact mode/type/blob',not changed)
allowed=['apps/control/commands/approval-metadata/','docs/qualification/candidates/action-followthrough-20261013/metadata-author/']
exact={'docs/coordination/tasks/CODEX-ACTION-FOLLOWTHROUGH-METADATA-20261013.md','docs/coordination/reports/CODEX-ACTION-FOLLOWTHROUGH-METADATA-20261013.md'}
added=sorted(set(after)-set(before));check('new paths remain allocated',all(p in exact or any(p.startswith(a) for a in allowed) for p in added))
source=[]
for p in sorted((root/'apps/control/commands/approval-metadata').rglob('*')):
    if p.is_file():
        data=p.read_bytes();source.append({'path':p.relative_to(root).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
for p in sorted(evidence.glob('*.json')):
    if p.name in ('audit.json','manifest.json','cleanup.json'):continue
    r=json.loads(p.read_bytes())
    if 'ownedPidAndPgid' not in r:continue
    check(p.stem+' source was clean',r['sourceDiffBytes']==0)
    check(p.stem+' group absent and bounded',r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
    check(p.stem+' exact source exists',len(git('rev-parse',r['sourceHead']).strip())==40)
    for s in r['streams']:
        data=(root/s['path']).read_bytes();check(p.stem+' '+s['path'].split('.')[-2]+' hash',len(data)==s['bytes'] and hashlib.sha256(data).hexdigest()==s['sha256'])
report={'scope':'OFFLINE_SOURCE_AND_RECEIPT_PRESERVATION_NOT_NATIVE','base':base,'head':head,'originalCount':len(before),'changedOriginals':changed,'addedPaths':added,'sourceFiles':source,'checks':checks,'passed':sum(c['pass'] for c in checks),'total':len(checks)}
(evidence/'audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'total':report['total'],'originalCount':len(before),'changedOriginals':changed}))
raise SystemExit(0 if all(c['pass'] for c in checks) else 1)
