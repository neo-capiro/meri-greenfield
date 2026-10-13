"""Offline source, scope, independent freeze and owned-check preservation audit."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[5]
packet=Path(__file__).resolve().parent
base='3d34bf42983824327c63f96419abcfea8a587407'
review=sys.argv[1]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):return {p.decode():m.decode() for x in git('ls-tree','-rz',ref).split(b'\0') if x for m,p in [x.split(b'\t',1)]}
original,current,reviewed=map(tree,[base,'HEAD',review])
schema_review='0b086d9a4142722b204a5c8b5c91cc07654ad4e9'
schema_reviewed=tree(schema_review)
checks=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
 if not value:raise AssertionError(name)
allowed={'apps/control/admitted-runs/mount.mjs','apps/control/commands/approval-metadata/postgres-store.mjs','apps/control/commands/approval-metadata/test/fixture.mjs','apps/control/commands/postgres-command-journal.mjs','apps/gateway/budget/admitted-run-binding.mjs','apps/gateway/budget/postgres-tool-budget.mjs','apps/gateway/index.mjs','apps/gateway/local-action/gateway.mjs'}
changed={p for p,b in original.items() if current.get(p)!=b}
check('all original entries retained',set(original)<=set(current))
check('only eight allocated original seams changed',changed==allowed)
check('original tests migrations catalog public contracts and failure evidence unchanged',all(current[p]==b for p,b in original.items() if p not in allowed))
source=[p for p,b in current.items() if p.startswith(('apps/','packages/','infra/')) and b!=original.get(p) and not p.endswith('.md')]
for p in source:
 expected=schema_reviewed if '/schema-independent/' in p else reviewed
 check('exact independently reviewed '+p,current[p]==expected.get(p))
catalog=json.loads((root/'packages/contracts/retrieval-0.2/catalog.json').read_text())
scope={'originals':len(catalog['originals']),'selected':sum(x['disposition']=='selected' for x in catalog['originals']),'deferred':sum(x['disposition']=='deferred' for x in catalog['originals']),'mapped':sum(x['state']=='mapped' for x in catalog['originals']),'operations':len(catalog['operations'])}
check('original139 selected96 deferred43 source mapping retained',scope=={'originals':139,'selected':96,'deferred':43,'mapped':96,'operations':97})
check('all production operations still unavailable',all(x['handler'] is None and x['availability']=='unimplemented' and x['qualification']=='pending' and x['retry']['maxRetries']==0 for x in catalog['operations']))
manifests={}
manifest_paths=list(packet.parent.glob('*/manifest.json'))+list((packet.parent.parent/'qualified-application-20261013').glob('*/manifest.json'))
for manifest in sorted(manifest_paths):
 if manifest.parent==packet:continue
 value=json.loads(manifest.read_text());members=value['members'];manifests[manifest.parent.name]=len(members)
 for member in members:
  raw=(root/member['path']).read_bytes()
  check('retained '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
receipts=[]
for label in ['integrated-node','integrated-python']:
 value=json.loads((packet/(label+'.json')).read_text())
 check('passing bounded check '+label,value['exitCode']==0 and not value['timedOut'] and value['sourceDiffBytes']==0 and value['ownedProcessGroupAbsent'] and not value['ownedGroupKillRequired'])
 for member in value['streams']:
  raw=(root/member['path']).read_bytes();check('exact output '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
 try:os.killpg(value['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('freshly absent group '+label,absent)
 receipts.append({'label':label,'testedHead':value['sourceHead'],'ownedPidAndPgid':value['ownedPidAndPgid']})
result={'base':base,'sourceHead':git('rev-parse','HEAD').decode().strip(),'review':review,'schemaReview':schema_review,'originalEntries':len(original),'originalUnchanged':len(original)-len(changed),'allocatedOriginalChanges':sorted(changed),'reviewedSourceFiles':len(source),'capabilityScope':scope,'laneManifestMembers':manifests,'receipts':receipts,'passed':len(checks),'failed':0,'checks':checks}
(packet/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='checks'}))
