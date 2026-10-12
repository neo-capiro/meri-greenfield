"""Offline exact-source and capture audit; no service calls or dependencies."""
import hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
BASE='d7bd22361f232211a6c1ec6b8d67115cfe36ebbd'
SOURCE='d9296aa2db1290091a355c47fb1db3d87ac98665'
checks=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
 if not value:raise AssertionError(name)
def tree(ref):
 return {s.split(b'\t',1)[1].decode():s.split(b'\t',1)[0].decode() for s in git('ls-tree','-rz',ref).split(b'\0') if s}
base=tree(BASE);current=tree(SOURCE)
allocated={'packages/contracts/schedules-0.2/lifecycle-validation.mjs','packages/contracts/schedules-0.2/lifecycle.schema.json'}
changed=[p for p,v in base.items() if current.get(p)!=v]
check('only two explicitly allocated existing files changed',set(changed)==allocated)
check('all other original Git entries byte/mode preserved',all(current.get(p)==v for p,v in base.items() if p not in allocated))
source_paths=['apps/control/schedules/tool-interface.mjs','packages/contracts/schedules-0.2/tool-interface.schema.json','packages/contracts/schedules-0.2/tool-interface-validation.mjs',*sorted(allocated),'packages/contracts/test/schedule-tool-interface.test.mjs','packages/contracts/test/schedule-tool-interface-fixtures.mjs','apps/control/test/schedule-tool-interface.test.mjs']
identities=[]
for p in source_paths:
 b=git('show',SOURCE+':'+p)
 check('worktree exact frozen '+p,(ROOT/p).read_bytes()==b)
 identities.append({'path':p,'blob':git('rev-parse',SOURCE+':'+p).decode().strip(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
oldschema=json.loads(git('show',BASE+':packages/contracts/schedules-0.2/lifecycle.schema.json'))
newschema=json.loads(git('show',SOURCE+':packages/contracts/schedules-0.2/lifecycle.schema.json'))
prop=newschema['$defs']['Intent']['properties'].pop('taskInstructionSha256')
check('only optional instruction digest schema addition',newschema==oldschema and prop=={'type':'string','pattern':'^[a-f0-9]{64}$'})
old=git('show',BASE+':packages/contracts/schedules-0.2/lifecycle-validation.mjs').decode()
new=git('show',SOURCE+':packages/contracts/schedules-0.2/lifecycle-validation.mjs').decode()
# Every original substantive intent predicate survives the extraction verbatim.
start=old.index('    projection(p,tenant);',old.index('export function snapshotScheduleCall'))
end=old.index('\n  }\n  return frozenScheduleData',start)
lines=old[start:end].splitlines()
for line in lines:
 text=line.strip()
 if not text or text in ('}', '} else {') or "denySchedule('SCHEDULE_APPROVAL')" in text:continue
 if text.startswith('if(i.configuration!==null'):text=text.replace('if(i.configuration!==null',"if(Object.hasOwn(i,'taskInstructionSha256')||i.configuration!==null")
 check('preserved extracted predicate '+hashlib.sha256(text.encode()).hexdigest()[:12],text in new)
check('original approval predicate preserved',next(s.strip() for s in old.splitlines() if "denySchedule('SCHEDULE_APPROVAL')" in s) in new)
for p in ['packages/contracts/test/schedule-lifecycle.test.mjs','apps/control/test/schedule-lifecycle.test.mjs','apps/control/test/schedule-lifecycle-postgres.test.mjs']:
 check('original lifecycle tests unchanged '+p,git('show',BASE+':'+p)==git('show',SOURCE+':'+p))
for p in ['packages/contracts/test/schedule-tool-interface.test.mjs','apps/control/test/schedule-tool-interface.test.mjs']:
 check('original new-tool test prefix preserved '+p,git('show',SOURCE+':'+p).startswith(git('show','7523e1abe370a079eb92f55a61518303d5c885c1:'+p)))
expected={'extracted-lifecycle':0,'initial-tool-author':0,'disposition-negative':1,'repaired-tool-author':0,'connected-tool-author':0,'inspection-negative':1,'inspection-repaired':0,'instruction-negative':1,'instruction-repaired':0}
receipts=[]
for label,code in expected.items():
 r=json.loads((E/(label+'.json')).read_text())
 check(label+' exact recorded exit',r['exitCode']==code)
 check(label+' clean captured source',r['sourceDiffBytes']==0)
 check(label+' bounded owned cleanup',r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'] and not r['timedOut'])
 for s in r['streams']:
  b=(ROOT/s['path']).read_bytes();check(label+' '+s['path'].split('.')[-2]+' hash',len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
 try:os.killpg(r['ownedPidAndPgid'],0)
 except ProcessLookupError:absent=True
 else:absent=False
 check(label+' owned group still absent',absent)
 receipts.append({'label':label,'sourceHead':r['sourceHead'],'exitCode':r['exitCode'],'ownedPidAndPgid':r['ownedPidAndPgid']})
result={'base':BASE,'source':SOURCE,'originalEntries':len(base),'unchangedOriginalEntries':len(base)-len(changed),'changedOriginals':changed,'checks':checks,'passed':len(checks),'sourceIdentities':identities,'captures':receipts,'scope':'OFFLINE_SOURCE_ONLY_NO_RUNTIME_ACCEPTANCE'}
(E/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':len(checks),'originalsPreserved':len(base)-len(changed),'source':SOURCE}))
