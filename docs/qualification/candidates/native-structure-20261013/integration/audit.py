"""Offline exact-source, preservation and evidence audit."""
import hashlib,json,os,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[5];E=pathlib.Path(__file__).parent
BASE='67ccac716bd6cbce4ee04e439a085bab75ae21a5';SOURCE='fa3f06cc8f23a822a8fc74662187e7d3a7a8144b';MAPPED='ac9d7cdb1fb870619148a81adb69ab6b7409636d'
def git(*a):return subprocess.check_output(['git',*a],cwd=R)
def tree(ref):return {p.decode():m.decode().split()[2] for x in git('ls-tree','-rz',ref).split(b'\0') if x for m,p in [x.split(b'\t',1)]}
def sha(x):return hashlib.sha256(x).hexdigest()
base=tree(BASE);now=tree('HEAD');source=tree(SOURCE);mapped=tree(MAPPED)
production=['apps/control/qualified-application/schema-contract.mjs','apps/control/qualified-application/schema-preservation.mjs','packages/contracts/retrieval-0.2/operation-contracts.mjs']
tests=['apps/control/qualified-application/'+x for x in ['schema-size.test.mjs','schema-size-independent.test.mjs','schema-size-inventory.test.mjs']]
allowed=set(production+tests);changed={p for p,h in base.items() if now.get(p)!=h};assert changed==allowed,(changed,allowed)
for p,h in base.items():
 if p not in allowed:assert now.get(p)==h,p
members=[]
for p in production+tests:
 ref=SOURCE if p in production else MAPPED;assert now[p]==tree(ref)[p];raw=(R/p).read_bytes();members.append({'path':p,'blob':now[p],'bytes':len(raw),'sha256':sha(raw),'acceptedAt':ref})
capture=json.loads((E/'schema-complete.json').read_text());assert capture['exitCode']==0 and capture['sourceDiffBytes']==0 and capture['ownedProcessGroupAbsent'] and not capture['timedOut']
for row in capture['streams']:
 raw=(R/row['path']).read_bytes();assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
out=(E/'schema-complete.stdout.bin').read_text();assert 'tests 244' in out and 'fail 0' in out
try:os.killpg(capture['ownedPidAndPgid'],0)
except ProcessLookupError:pass
else:raise AssertionError('owned group remains')
(E/'source-blobs.json').write_text(json.dumps({'productionFreeze':SOURCE,'testMappingFreeze':MAPPED,'members':members},indent=2)+'\n')
record={'sourceVerdict':'ACCEPT_SOURCE','runtime':'HOLD','base':BASE,'testedHead':capture['sourceHead'],'auditHead':git('rev-parse','HEAD').decode().strip(),'baseEntries':len(base),'unchangedBaseEntries':len(base)-len(changed),'changedOriginalPaths':sorted(changed),'sourceMembers':len(members),'rootTests':244,'ownedGroupAbsent':capture['ownedPidAndPgid'],'privateNativeInputRead':False}
(E/'audit.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
