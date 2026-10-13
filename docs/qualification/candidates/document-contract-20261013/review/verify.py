"""Offline review packet replay. No service, provider or native execution."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[5];H=pathlib.Path(__file__).parent
m=json.loads((H/'manifest.json').read_text());checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
for x in m['members']:
 b=(R/x['path']).read_bytes();check(x['path'],len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'])
a=json.loads((H/'source-audit.json').read_text());p=json.loads((H/'packet-audit.json').read_text());c=json.loads((H/'cleanup.json').read_text())
check('source audit accepted',a['failed']==0 and a['passed']==57 and a['verdict']=='ACCEPT_SOURCE')
check('author audit accepted',p['failed']==0 and p['passed']==80 and p['verdict']=='ACCEPT_METADATA')
check('all captured owned groups absent',all(x['absentNow'] for x in c['ownedGroups']) and len(c['ownedGroups'])==12)
check('owned dependencies and consumer directories removed',c['directoryAbsent'] and c['temporaryConsumerDirectoriesAbsent'] and c['donorPreserved'])
for path in a['productPaths']:
 frozen=subprocess.check_output(['git','show',a['source']+':'+path],cwd=R);check('tested source '+path,(R/path).read_bytes()==frozen)
result={'passed':sum(x['pass'] for x in checks),'total':len(checks),'failed':sum(not x['pass'] for x in checks),'checks':checks}
(H/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='checks'}));raise SystemExit(bool(result['failed']))
