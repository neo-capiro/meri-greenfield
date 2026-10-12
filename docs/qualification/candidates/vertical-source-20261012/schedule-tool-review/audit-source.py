"""Independent read-only exact-source/contract preservation audit."""
from pathlib import Path
import hashlib,json,re,subprocess
R=Path(__file__).resolve().parents[5];O=Path(__file__).resolve().parent
BASE='d7bd22361f232211a6c1ec6b8d67115cfe36ebbd';SOURCE='d9296aa2db1290091a355c47fb1db3d87ac98665'
checks=[]
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
def git(*a):return subprocess.check_output(['git','-C',str(R),*a])
def blob(ref,p):return git('show',ref+':'+p)
def tree(ref):
 rows={}
 for s in git('ls-tree','-r','-z',ref).split(b'\0'):
  if s:
   m,p=s.split(b'\t',1);rows[p.decode()]=m.split()[2].decode()
 return rows
old=tree(BASE);now=tree('HEAD');allowed={'packages/contracts/schedules-0.2/lifecycle.schema.json','packages/contracts/schedules-0.2/lifecycle-validation.mjs'}
changed=[p for p,h in old.items() if now.get(p)!=h]
check('only two root allocated existing files changed',set(changed)==allowed)
check('all other baseline Git entries identical',all(now.get(p)==h for p,h in old.items() if p not in allowed))
paths=git('diff','--name-only',BASE,SOURCE,'--','apps','packages').decode().splitlines()
identities=[]
for p in paths:
 b=(R/p).read_bytes();check('exact source '+p,b==blob(SOURCE,p));identities.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
for p,h in old.items():
 if (p.startswith('apps/control/schedules/') or p.startswith('packages/contracts/dist/') or p.startswith('packages/runtime/') or '/test/' in p or p in ['packages/contracts/meri.schema.json','packages/contracts/validate.mjs','package.json','package-lock.json','packages/contracts/package-lock.json','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/catalog-validation.mjs','packages/contracts/retrieval-0.2/validate.mjs']):check('protected original '+p,now.get(p)==h)
oldSchema=json.loads(blob(BASE,'packages/contracts/schedules-0.2/lifecycle.schema.json'));currentSchema=json.loads((R/'packages/contracts/schedules-0.2/lifecycle.schema.json').read_bytes());newField=currentSchema['$defs']['Intent']['properties'].pop('taskInstructionSha256')
check('only optional private intent field added to existing schema',oldSchema==currentSchema)
check('instruction digest typed exact lowerhex',newField=={'type':'string','pattern':'^[a-f0-9]{64}$'})
oldV=blob(BASE,'packages/contracts/schedules-0.2/lifecycle-validation.mjs').decode();newV=(R/'packages/contracts/schedules-0.2/lifecycle-validation.mjs').read_text()
check('all prior helper prefix bytes exact',oldV[:oldV.index('export function snapshotScheduleCall')]==newV[:newV.index('export function assertScheduleIntent')])
check('all authority helpers after extraction exact',oldV[oldV.index('export function assertScheduleAuthority'):]==newV[newV.index('export function assertScheduleAuthority'):])
normalize=lambda s:re.sub(r'\s+','',s)
# Compare the two original contiguous predicate blocks with the extracted body,
# excluding only old approval line/outer scope and the authorized cancel guard.
a=oldV[oldV.index('    projection(p,tenant);'):oldV.index("    if(a.decision")]
b=oldV[oldV.index("    if(i.operation==='cancel_scheduled_task')"):oldV.index('\n  }\n  return frozenScheduleData')]
c=newV[newV.index('  projection(p,tenant);'):newV.index('\n  return i;')].replace("Object.hasOwn(i,'taskInstructionSha256')||",'')
check('all original intent predicates preserved in extraction',normalize(a+b)==normalize(c))
approval=lambda s:next(l.strip() for l in s.splitlines() if "if(a.decision" in l)
check('public approval predicate byte-identical',approval(oldV)==approval(newV))
check('original Execute delegates canonical extracted validation',"const i=assertScheduleIntent(call.intent,tenant),a=call.approval;" in newV)
schema=json.loads((R/'packages/contracts/schedules-0.2/tool-interface.schema.json').read_bytes());defs=schema['$defs']
check('new private schema URN correct',schema['$id']=='urn:meri:schedules:tool-interface:0.2.0')
expected={'ScheduleTaskRequest':['taskInstruction','policy','destinationReference','requestedLimits'],'UpdateScheduledTaskRequest':['scheduleId','taskInstruction','policy','destinationReference','requestedLimits'],'CancelScheduledTaskRequest':['scheduleId','mode','note','running','runs'],'ListScheduledTasksRequest':['afterScheduleId','limit','historyLimit']}
for name,keys in expected.items():
 check('closed caller '+name,set(defs[name]['properties'])==set(keys) and defs[name]['additionalProperties'] is False)
 if name!='ListScheduledTasksRequest':check('complete explicit caller choices '+name,set(defs[name]['required'])==set(keys))
check('complete explicit policy',set(defs['Policy']['required'])==set(defs['Policy']['properties']))
for name in ['ScheduleMutationContext','ScheduleListContext']:
 check('closed trusted '+name,defs[name]['additionalProperties'] is False and set(defs[name]['required'])==set(defs[name]['properties']))
check('inspection schema reused not copied',defs['ListRow']['properties']['inspection']['anyOf'][0]['$ref']=='urn:meri:schedules:inspection:0.2.0#/$defs/ScheduleInspectionOutput')
check('approval canonical public schema reused',defs['ScheduleMutationContext']['properties']['approval']['anyOf'][0]['$ref']=='urn:meri:contracts:0.1.0#/$defs/ApprovalDecision')
source=(R/'packages/contracts/schedules-0.2/tool-interface-validation.mjs').read_text();app=(R/'apps/control/schedules/tool-interface.mjs').read_text()
check('instruction hash computed from normalized model text',"taskInstructionSha256:canonicalSha256(input.taskInstruction)" in source)
check('current private intent remains canonical owner',"const intent=assertScheduleIntent(" in source and "snapshotScheduleCall('Execute'" in source)
check('one shared operation lifetime reused',"import {createOperationLifetime}" in app and 'setTimeout' not in app)
check('app invokes borrowed execute and list',"sdkMethod(lifecycle,'execute')" in app and "sdkMethod(lifecycle,'list')" in app)
check('pending branch calls no mutation',"else if(c.approval===null)output=prepared.proposal;" in app)
check('root-owned registration unchanged',all(now.get(p)==old.get(p) for p in ['packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/catalog-validation.mjs','packages/contracts/retrieval-0.2/validate.mjs']))
# Author's original tool test prefixes remain unchanged; later controls append.
for p in ['apps/control/test/schedule-tool-interface.test.mjs','packages/contracts/test/schedule-tool-interface.test.mjs']:
 check('initial tool prefix exact '+p,(R/p).read_bytes().startswith(blob('7523e1abe370a079eb92f55a61518303d5c885c1',p)))
result={'base':BASE,'source':SOURCE,'sourceIdentities':identities,'originalEntries':len(old),'unchangedOriginalEntries':len(old)-len(changed),'changedOriginalPaths':changed,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'runtimeAccepted':False}
(O/'source-audit-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['source','originalEntries','unchangedOriginalEntries','passed','failed']}))
for x in checks:
 if not x['passed']:print('FAILED: '+x['name'])
raise SystemExit(bool(result['failed']))
