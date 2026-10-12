from pathlib import Path
import sys,subprocess,json,hashlib
r=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
ref=subprocess.check_output(['git','rev-parse',sys.argv[1]],cwd=r,text=True).strip();manifestPath='docs/qualification/candidates/read-continuation-20261012/program-elements-author/manifest.json'
def data(path):return subprocess.check_output(['git','show',ref+':'+path],cwd=r)
raw=data(manifestPath);manifest=json.loads(raw);checks=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
 if not value:raise AssertionError(name)
check('source pin',manifest['sourceHead']=='1f7ad5726541f0ab5a103b9e0b2152c260350dbd')
check('unique manifest paths',len({m['path'] for m in manifest['members']})==len(manifest['members']))
receipts=[]
for m in manifest['members']:
 body=data(m['path']);check('member '+m['path'],len(body)==m['bytes'] and hashlib.sha256(body).hexdigest()==m['sha256'])
 if m['path'].endswith('.json'):
  try:j=json.loads(body)
  except Exception:continue
  if isinstance(j,dict) and 'ownedPidAndPgid' in j:receipts.append((m['path'],j))
for path,j in receipts:
 check('owned cleanup '+path,j['ownedProcessGroupAbsent'] and not j['timedOut'] and not j['ownedGroupKillRequired'])
 for stream in j['streams']:
  body=data(stream['path']);check('capture stream '+stream['path'],len(body)==stream['bytes'] and hashlib.sha256(body).hexdigest()==stream['sha256'])
for path in ['packages/contracts/retrieval-0.2/program-elements.schema.json','packages/contracts/retrieval-0.2/program-elements-validation.mjs','packages/contracts/test/retrieval-program-elements.test.mjs']:
 a=subprocess.check_output(['git','rev-parse',ref+':'+path],cwd=r);b=subprocess.check_output(['git','rev-parse',manifest['sourceHead']+':'+path],cwd=r);check('source unchanged '+path,a==b)
result={'authorPacket':ref,'source':manifest['sourceHead'],'manifestSha256':hashlib.sha256(raw).hexdigest(),'members':len(manifest['members']),'capturedGroups':len(receipts),'checks':checks,'passed':len(checks),'scope':'Offline immutable packet hash/provenance checks; no source/provider/native execution'}
(e/'author-packet-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['authorPacket','source','manifestSha256','members','capturedGroups','passed']}))
