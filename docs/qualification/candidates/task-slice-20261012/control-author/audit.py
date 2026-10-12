"""Offline immutable Git/capture audit; no external services or dependencies."""
import hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='77cedb126d57a0223d2df42ad2f3fe988eb51759';SOURCE='6f14d780a40e878fa62bc928c4d520286313f56c'
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def tree(ref):return {r.split(b'\t',1)[1].decode():r.split(b'\t',1)[0].decode() for r in git('ls-tree','-rz',ref).split(b'\0') if r}
checks=[]
def check(n,v):
 checks.append({'name':n,'pass':bool(v)})
 if not v:raise AssertionError(n)
base=tree(BASE);source=tree(SOURCE)
check('every original Git entry unchanged',all(source.get(k)==v for k,v in base.items()))
new=[p for p in source if p not in base]
check('all new paths allocated',all(p.startswith(('apps/control/task-lookup/','docs/qualification/candidates/task-slice-20261012/control-author/')) or p=='docs/coordination/tasks/CODEX-TASK-LOOKUP-CONTROL-20261012.md' for p in new))
identities=[]
for p in sorted(p for p in new if p.startswith('apps/')):
 b=git('show',SOURCE+':'+p);check('exact candidate '+p,(ROOT/p).read_bytes()==b);identities.append({'path':p,'blob':git('rev-parse',SOURCE+':'+p).decode().strip(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
for p,ref in [('apps/control/task-lookup/delivery.test.mjs','4ea00e93db3c7f8e21aa596b4d98b238df84aaba'),('apps/control/task-lookup/postgres-results.test.mjs','a6f3fbf944dea4c9bd081a966724edbe269c4b1c')]:check('original test prefix '+p,git('show',SOURCE+':'+p).startswith(git('show',ref+':'+p)))
old=git('show','4ea00e93db3c7f8e21aa596b4d98b238df84aaba:apps/control/task-lookup/fixtures.mjs');check('fixture correction only exact covered empty-page flag',old.replace(b'totalIsExactForScope:true,absenceSupported:false',b'totalIsExactForScope:true,absenceSupported:true')==git('show',SOURCE+':apps/control/task-lookup/fixtures.mjs'))
catalog=json.loads(git('show',SOURCE+':packages/contracts/retrieval-0.2/catalog.json'))
check('97 unavailable null-handler operations preserved',len(catalog['operations'])==97 and all(r['handler'] is None and r['availability']=='unimplemented' for r in catalog['operations']))
expected={'initial-control':1,'corrected-control':0,'store-initial':1,'store-repaired':0,'reference-case-negative':1,'reference-case-repaired':0,'connected-store':0,'scope-negative':0,'coherent-scope-negative':1,'scope-repaired':0}
for label,status in expected.items():
 r=json.loads((E/(label+'.json')).read_text());check(label+' expected exit',r['exitCode']==status);check(label+' exact source',r['sourceDiffBytes']==0);check(label+' reaped',r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for s in r['streams']:
  b=(ROOT/s['path']).read_bytes();check(label+' stream '+s['path'].split('.')[-2],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
 try:os.killpg(r['ownedPidAndPgid'],0)
 except ProcessLookupError:absent=True
 else:absent=False
 check(label+' group still absent',absent)
(E/'audit.json').write_text(json.dumps({'base':BASE,'source':SOURCE,'originalEntriesPreserved':len(base),'passed':len(checks),'checks':checks,'sourceIdentities':identities,'scope':'OFFLINE_SOURCE_ONLY'},indent=2)+'\n')
print(json.dumps({'passed':len(checks),'originalEntriesPreserved':len(base),'sourceFiles':len(identities)}))
