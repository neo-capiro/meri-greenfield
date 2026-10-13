"""Exact source preservation and captured independent result checks, no runtime ports."""
import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
out=Path(__file__).resolve().parent
base='bc8b65cc7186e449cf20b4956e4cd88684b35325'
author='10295f0448a8c4f0a3464b7802b845efb1c00a33'
fixture='00032028b57141631c3bbd6a6cc34d5d2bcad9e8'
checks=[]
def git(*a):return subprocess.check_output(['git','-c','gc.auto=0',*a],cwd=root)
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
def tree(ref):
 return {p:meta.split()[2] for row in git('ls-tree','-rz',ref).decode().split(chr(0)) if row for meta,p in [row.split(chr(9),1)]}
before=tree(base);after=tree('HEAD')
allowed={'apps/control/document-application/index.mjs','apps/control/document-application/current.mjs','apps/control/document-application/README.md','apps/control/document-application/local/fixture.mjs'}
changed=[p for p,b in before.items() if after.get(p)!=b]
check('only four allocated existing paths differ',set(changed)==allowed)
check('no original path deleted',all(p in after for p in before))
for p in ['apps/control/document-application/index.mjs','apps/control/document-application/current.mjs','apps/control/document-application/format-admission.mjs','apps/control/document-application/test/workbook-application.test.mjs','apps/control/document-application/README.md']:
 check('exact author '+p,git('show',author+':'+p)==(root/p).read_bytes())
p='apps/control/document-application/local/fixture.mjs';check('exact root fixture option',git('show',fixture+':'+p)==(root/p).read_bytes())
for prefix in ['apps/artifacts/','packages/contracts/','apps/control/document-application/test/application.test.mjs','apps/control/document-application/independent/application-independent.test.mjs','apps/control/document-application/http.mjs','apps/control/document-application/local/ports.mjs']:
 selected={p:b for p,b in before.items() if p.startswith(prefix)};check('protected '+prefix,len(selected)>0 and all(after.get(p)==b for p,b in selected.items()))
r=json.loads((out/'first.json').read_text());check('clean first source capture',r['sourceDiffBytes']==0 and r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
for s in r['streams']:
 b=(root/s['path']).read_bytes();check('captured '+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
text=(out/'first.stdout.bin').read_text();check('independent30 no skips failures',all(x in text for x in ['tests 30','pass 30','fail 0','skipped 0','cancelled 0']))
line=next(x for x in text.splitlines() if x.startswith('INDEPENDENT_WORKBOOK_PROCESSES '));ps=json.loads(line.split(' ',1)[1]);check('ten actual child receipts',len(ps)==10)
for r in ps:
 absent=False
 try:os.killpg(r['pid'],0)
 except ProcessLookupError:absent=True
 check('owned artifact child '+str(r['pid']),r['leaderClosed'] and r['groupAbsent'] and not r['sandboxQualified'] and absent and r['exitCode']==0)
result={'sourceBase':base,'authorSource':author,'fixtureSource':fixture,'testedHead':json.loads((out/'first.json').read_text())['sourceHead'],'auditedHead':git('rev-parse','HEAD').decode().strip(),'originalPaths':len(before),'unchangedOriginals':len(before)-len(changed),'changedOriginals':changed,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'nativeQualified':False}
(out/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':result['passed'],'failed':result['failed'],'originalPaths':len(before)}));raise SystemExit(bool(result['failed']))
