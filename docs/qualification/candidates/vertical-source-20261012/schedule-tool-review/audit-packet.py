"""Independent read-only verification of the exact author evidence packet."""
from pathlib import Path
import hashlib,json,os,subprocess
R=Path(__file__).resolve().parents[5];O=Path(__file__).resolve().parent
A=Path('/workspace/meri-schedule-tool-interface-20261012')
PACKET='e45bca0f83851362923a74ad0dc7e164cda0f4ea';SOURCE='d9296aa2db1290091a355c47fb1db3d87ac98665';BASE='d7bd22361f232211a6c1ec6b8d67115cfe36ebbd'
P='docs/qualification/candidates/vertical-source-20261012/schedule-tool-author/'
checks=[]
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
def git(*a):return subprocess.check_output(['git','-C',str(A),*a])
def blob(ref,p):return git('show',ref+':'+p)
def sha(b):return hashlib.sha256(b).hexdigest()
def data(p):return json.loads(blob(PACKET,p))
manifestBytes=blob(PACKET,P+'manifest.json');manifest=json.loads(manifestBytes)
check('exact author packet tree',git('rev-parse',PACKET+'^{tree}').decode().strip()=='cc6c3b0e86ed583e804ab45809f74685ecf51c0e')
check('author packet manifest identity',sha(manifestBytes)=='e87d7e5eaad534f7744fe3a688783a3fd9a361b7d5d5e5f2a56435ef5ed05f23')
check('48 unique manifest entries',len(manifest['members'])==48 and len({m['path'] for m in manifest['members']})==48)
check('manifest binds exact reviewed source and predecessor',manifest['sourceFreeze']==SOURCE and manifest['base']==BASE)
for m in manifest['members']:
 b=blob(PACKET,m['path']);check('immutable member '+m['path'],len(b)==m['bytes'] and sha(b)==m['sha256'])
 check('current author bytes '+m['path'],(A/m['path']).read_bytes()==b)
sourcePaths=git('diff','--name-only',BASE,SOURCE,'--','apps','packages').decode().splitlines()
for p in sourcePaths:check('packet and reviewer retain exact source '+p,blob(PACKET,p)==blob(SOURCE,p)==(R/p).read_bytes())
check('no source changes after source freeze',not git('diff','--name-only',SOURCE,PACKET,'--','apps','packages').strip())
# Author raw captures are source bound; every owned group is independently checked absent.
receipts=[]
for m in manifest['members']:
 if not m['path'].endswith('.json'):continue
 d=data(m['path'])
 if not isinstance(d,dict) or 'ownedPidAndPgid' not in d:continue
 receipts.append(m['path']);check('capture clean source '+m['path'],d['sourceDiffBytes']==0 and d['sourceDiffSha256']==sha(b''))
 for s in d['streams']:
  b=blob(PACKET,s['path']);check('capture raw stream '+s['path'],len(b)==s['bytes'] and sha(b)==s['sha256'])
 check('capture did not time out or kill '+m['path'],d['timedOut'] is False and d['ownedGroupKillRequired'] is False and d['ownedProcessGroupAbsent'] is True)
 absent=False
 try:os.killpg(d['ownedPidAndPgid'],0)
 except ProcessLookupError:absent=True
 except PermissionError:pass
 check('fresh author group absent '+str(d['ownedPidAndPgid']),absent)
check('nine author capture receipts',len(receipts)==9)
for label,passed,failed in [('disposition-negative',0,2),('inspection-negative',1,3),('instruction-negative',0,2),('instruction-repaired',90,0)]:
 d=data(P+label+'.json');out=blob(PACKET,P+label+'.stdout.bin').decode()
 check('retained author counts '+label,f'pass {passed}' in out and f'fail {failed}' in out)
 check('retained author exit '+label,d['exitCode']==(1 if failed else 0))
check('raw whitespace refusal preserved',data(P+'whitespace-first.json')['exitCode']==2)
check('authored whitespace passes',data(P+'whitespace-authored.json')['exitCode']==0)
cleanup=data(P+'dependency-cleanup.json')
check('author cleanup only owned symlinks',len(cleanup['links'])==7 and all(x['removedLinkOnly'] and x['donorUntouchedCheck'] for x in cleanup['links']) and cleanup['donorTreesRemoved'] is False)
report=blob(PACKET,'docs/coordination/reports/CODEX-SCHEDULE-TOOL-INTERFACE-20261012.md').decode()
for text in ['Canonical model bindings must use Request definitions','No catalog, public contract, existing inspector, shared lifetime, SQL migration, PostgreSQL owner or SDK adapter changed','this hash is not evidence of that execution','multiple-invalid-input diagnostic priority can differ','No database migration/query, Temporal service','UNKNOWN','ACKNOWLEDGED_NOT_RELEASED']:
 check('report scope '+text,text in report)
api=data(P+'integration-api.json')
check('integration API is metadata object',isinstance(api,dict))
result={'authorPacket':PACKET,'authorTree':git('rev-parse',PACKET+'^{tree}').decode().strip(),'sourceFreeze':SOURCE,'manifestSha256':sha(manifestBytes),'manifestMembers':len(manifest['members']),'sourcePaths':sourcePaths,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'runtimeAccepted':False}
(O/'author-packet-audit-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['authorPacket','sourceFreeze','manifestMembers','passed','failed','runtimeAccepted']}))
if result['failed']:print(json.dumps([x for x in checks if not x['passed']]))
raise SystemExit(bool(result['failed']))
