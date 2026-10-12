#!/usr/bin/env python3
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
P=Path(__file__).resolve().parent
m=json.loads((P/'manifest.json').read_text()); checks=[]
def ck(n,v):checks.append({'name':n,'pass':bool(v)})
ck('unique members',len(m['members'])==len({x['path'] for x in m['members']}))
for x in m['members']:
 p=ROOT/x['path'];b=p.read_bytes();ck(x['path'],p.is_file() and not p.is_symlink() and len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'])
actual={str(x.relative_to(ROOT)) for x in P.iterdir() if x.is_file()}|set(m['externalMembers'])
ck('complete allocated packet membership',actual=={x['path'] for x in m['members']}|{str((P/x).relative_to(ROOT)) for x in m['exclusions']})
f=json.loads((P/'facts.json').read_text());a=json.loads((P/'repaired-author-audit.json').read_text())
ck('independent facts passed',f['status']=='PASS')
ck('exact author accepted metadata only',a['author']==m['author'] and a['verdict']=='ACCEPT_METADATA' and a['status']=='PASS' and a['passed']==a['total']==138 and not any(a[k] for k in ['implementationAccepted','completeMappingAccepted','runtimeAccepted']))
ck('no dependency or runtime claim',m['runtimeAccepted'] is False and m['completeMappingAccepted'] is False)
r={'status':'PASS' if all(x['pass'] for x in checks) else 'FAIL','passed':sum(x['pass'] for x in checks),'total':len(checks),'manifestSha256':hashlib.sha256((P/'manifest.json').read_bytes()).hexdigest(),'manifestMembers':len(m['members']),'checks':checks}
print(json.dumps(r,indent=2));raise SystemExit(0 if r['status']=='PASS' else 1)
