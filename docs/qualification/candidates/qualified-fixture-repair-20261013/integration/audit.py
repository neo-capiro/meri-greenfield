"""Offline review/source preservation audit and public Git blob delta packet."""
from pathlib import Path
import hashlib,json,os,subprocess,sys

root=Path(__file__).resolve().parents[5]
packet=Path(__file__).resolve().parent
base='b5243ae164f68c7591b039e8365d9897390543d2'
review=sys.argv[1]
def git(*args):return subprocess.check_output(['git','-c','gc.auto=0',*args],cwd=root)
def tree(ref):return {p.decode():m.decode() for x in git('ls-tree','-rz',ref).split(b'\0') if x for m,p in [x.split(b'\t',1)]}
original,current,reviewed=map(tree,[base,'HEAD',review])
checks=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
 if not value:raise AssertionError(name)
allowed={
 'apps/control/qualified-application/README-schema.md',
 'apps/control/qualified-application/application.fixture.mjs',
 'apps/control/qualified-application/independent/schema-independent.test.mjs',
 'apps/control/qualified-application/lifecycle-bridge.mjs',
 'apps/control/qualified-application/lifecycle-bridge.test.mjs',
 'apps/control/qualified-application/schema-contract.mjs',
 'apps/control/qualified-application/schema-independent/fixture.mjs',
 'apps/control/qualified-application/schema.fixture.mjs',
 'apps/control/qualified-application/schema.mjs',
 'apps/proxy/qualification/assembly/lifecycle.py',
 'apps/proxy/qualification/assembly/test_lifecycle.py',
}
changed={p for p,b in original.items() if current.get(p)!=b}
check('all original entries retained',set(original)<=set(current))
check('only allocated existing paths changed',changed==allowed)
check('all unrelated source contracts migrations registry tests failure evidence unchanged',all(current[p]==b for p,b in original.items() if p not in allowed))
source=[p for p,b in current.items() if p.startswith(('apps/','packages/','infra/','scripts/')) and b!=original.get(p) and not p.endswith('.md')]
for p in source:check('exact independently reviewed '+p,current[p]==reviewed.get(p))
removed=git('diff','--unified=0',base,'HEAD','--','*.test.mjs','test_*.py').decode().splitlines()
check('no removed original test assertions',not any(line.startswith('-') and not line.startswith('---') and ('assert' in line or 'test(' in line or 'def test_' in line) for line in removed))
catalog=json.loads((root/'packages/contracts/retrieval-0.2/catalog.json').read_text())
scope={'originals':len(catalog['originals']),'selected':sum(x['disposition']=='selected' for x in catalog['originals']),'deferred':sum(x['disposition']=='deferred' for x in catalog['originals']),'mapped':sum(x['state']=='mapped' for x in catalog['originals']),'operations':len(catalog['operations'])}
check('139 originals 96 selected 43 deferred 97 unavailable operations retained',scope=={'originals':139,'selected':96,'deferred':43,'mapped':96,'operations':97} and all(x['handler'] is None and x['availability']=='unimplemented' and x['qualification']=='pending' and x['retry']['maxRetries']==0 for x in catalog['operations']))
manifests={}
for manifest in sorted(packet.parent.glob('*/manifest.json')):
 if manifest.parent==packet:continue
 members=json.loads(manifest.read_text())['members'];manifests[manifest.parent.name]=len(members)
 for member in members:
  raw=(root/member['path']).read_bytes();check('retained '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
receipts=[]
for label,expected_exit in [('integrated-node',1),('integrated-node-final',0),('integrated-python',0),('independent-node',0),('independent-python',0),('catalog-qualified-node',0)]:
 value=json.loads((packet/(label+'.json')).read_text())
 check('expected outcome and bounded cleanup '+label,value['exitCode']==expected_exit and not value['timedOut'] and value['sourceDiffBytes']==0 and value['ownedProcessGroupAbsent'] and not value['ownedGroupKillRequired'])
 for member in value['streams']:
  raw=(root/member['path']).read_bytes();check('exact output '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
 try:os.killpg(value['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('freshly absent owned group '+label,absent)
 receipts.append({'label':label,'testedHead':value['sourceHead'],'ownedPidAndPgid':value['ownedPidAndPgid']})
head=git('rev-parse','HEAD').decode().strip()
delta=[]
for p in sorted(source):
 raw=git('show',f'HEAD:{p}');delta.append({'path':p,'gitBlob':current[p].split()[-1],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'baseGitBlob':original[p].split()[-1] if p in original else None})
production_paths={
 'apps/control/qualified-application/lifecycle-bridge.mjs',
 'apps/control/qualified-application/schema-contract.mjs',
 'apps/control/qualified-application/schema-preservation.mjs',
 'apps/control/qualified-application/schema.mjs',
 'apps/proxy/qualification/assembly/lifecycle.py',
}
source_packet={'schema':'meri.qualified-fixture-source-delta/1','base':base,'head':head,'tree':git('rev-parse','HEAD^{tree}').decode().strip(),'independentReview':review,'sourceOnly':True,'runtimeQualified':False,'requiredNewModule':'apps/control/qualified-application/schema-preservation.mjs','productionFiles':[entry for entry in delta if entry['path'] in production_paths],'allChangedSourceAndTestFiles':delta}
(packet/'source-blobs.json').write_text(json.dumps(source_packet,indent=2)+'\n')
result={'base':base,'sourceHead':head,'review':review,'originalEntries':len(original),'originalUnchanged':len(original)-len(changed),'allocatedOriginalChanges':sorted(changed),'reviewedSourceFiles':len(source),'capabilityScope':scope,'laneManifestMembers':manifests,'receipts':receipts,'passed':len(checks),'failed':0,'checks':checks}
(packet/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='checks'}))
