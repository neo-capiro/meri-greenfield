"""Verify committed author packet bytes and exact source, using read-only Git."""
from pathlib import Path
import subprocess,json,hashlib,sys
root=Path(__file__).resolve().parents[5]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def blob(ref,path):return git('show',ref+':'+path)
source,packet=sys.argv[1:3];prefix='docs/qualification/candidates/backend-execution-20261012/dataset-metadata-handler/'
checks=[]
def check(name,v):
 checks.append({'check':name,'pass':bool(v)})
 if not v:raise AssertionError(name)
manifest=json.loads(blob(packet,prefix+'manifest.json'))
for m in manifest['members']:
 data=blob(packet,m['path']);check('manifest '+m['path'],len(data)==m['bytes'] and hashlib.sha256(data).hexdigest()==m['sha256'])
for path in ['apps/gateway/sources/dataset-metadata/handler.mjs','apps/gateway/dispatch/operation-context.mjs','apps/gateway/dispatch/read-result-envelope.mjs','packages/contracts/retrieval-0.2/catalog-validation.mjs','apps/gateway/test/dataset-metadata-handler.test.mjs']:
 check('exact final source '+path,blob(source,path)==blob(packet,path))
receipts=[]
for path in git('ls-tree','-r','--name-only',packet,prefix).decode().splitlines():
 if not path.endswith('.json'):continue
 try:r=json.loads(blob(packet,path))
 except ValueError:continue
 if 'ownedPidAndPgid' not in r:continue
 check('owned cleanup '+path,r['ownedProcessGroupAbsent'] is True and r['timedOut'] is False and r['ownedGroupKillRequired'] is False)
 for stream in r['streams']:
  data=blob(packet,stream['path']);check('capture stream '+stream['path'],len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
 receipts.append({'path':path,'sourceHead':r['sourceHead'],'sourceDiffBytes':r['sourceDiffBytes'],'exitCode':r['exitCode'],'pgid':r['ownedPidAndPgid']})
result={'source':source,'packet':packet,'packetTree':git('rev-parse',packet+'^{tree}').decode().strip(),'manifestSha256':hashlib.sha256(blob(packet,prefix+'manifest.json')).hexdigest(),'members':len(manifest['members']),'passed':len(checks),'checks':checks,'captures':receipts,'limits':'Author historical local checks and bytes only; no native/current authority/physical runtime claim.'}
Path(__file__).with_name('packet-audit-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
