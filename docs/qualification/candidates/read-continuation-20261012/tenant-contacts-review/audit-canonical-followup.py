"""Offline byte/receipt audit. Does not import any target module."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
OLD='0aba55ef096a68a3cfd92f770783dec3fddfea22';PRIOR='5e5d6abe11091fda90dd07b2701b8b2e85e1b718';REPAIR='1e31f94bb8e399eede1f28609cb241b87e356b62';TEST='e890cff6d1110a1d29bd5dec0b7f340db0e41f06';BASE='a3e946c1fa264ae7b33205f5b87804ee1ef75773'
SCHEMA='packages/contracts/retrieval-0.2/tenant-contacts.schema.json';MODULE='packages/contracts/retrieval-0.2/tenant-contacts-validation.mjs';AUTHOR='packages/contracts/test/retrieval-tenant-contacts.test.mjs';INDEP='packages/contracts/test/retrieval-tenant-contacts-independent.test.mjs'
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def blob(c,p):return git('show',c+':'+p)
def sha(b):return hashlib.sha256(b).hexdigest()
def tree(c):return {r.split('\t',1)[1]:r.split()[2] for r in git('ls-tree','-r',c).decode().splitlines()}
checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
for p,c in [(SCHEMA,REPAIR),(MODULE,REPAIR),(AUTHOR,TEST)]:check('exact root bytes:'+p,(ROOT/p).read_bytes()==blob(c,p))
old=blob(OLD,MODULE);check('exactly two detached return substitutions',old.count(b'return result;')==2 and (ROOT/MODULE).read_bytes()==old.replace(b'return result;',b'return page;'))
s=json.loads(blob(OLD,SCHEMA));s['$id']='urn:meri:retrieval:tenant-contacts:0.2.0';check('schema only namespace change',json.loads((ROOT/SCHEMA).read_bytes())==s)
check('original independent test preimage preserved',(HERE/'pre-detachment-independent.test.mjs.txt').read_bytes()==blob(PRIOR,INDEP))
prior=json.loads(blob(PRIOR,str((HERE/'manifest.json').relative_to(ROOT))))
for row in prior['files']:
 b=blob(PRIOR,row['path']);check('historical manifest:'+row['path'],len(b)==row['bytes'] and sha(b)==row['sha256'])
check('historical nineteen members',len(prior['files'])==19)
a=tree(BASE);b=tree('HEAD');check('6110 original blobs preserved',len(a)==6110 and all(b.get(p)==v for p,v in a.items()))
for label,passed,failed,source,test in [('canonical-before',34,3,OLD,OLD),('canonical-repaired-old-expectations',61,2,REPAIR,OLD),('canonical-final',63,0,REPAIR,TEST)]:
 r=json.loads((HERE/(label+'.json')).read_bytes());check('owned group settled:'+label,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'] and r['exitCode']==int(failed>0))
 check('exact tested source:'+label,all(blob(r['sourceHead'],p)==blob(source,p) for p in [SCHEMA,MODULE]) and blob(r['sourceHead'],AUTHOR)==blob(test,AUTHOR) and r['sourceDiffBytes']==0)
 for row in r['streams']:
  value=(ROOT/row['path']).read_bytes();check('raw stream:'+row['path'],len(value)==row['bytes'] and sha(value)==row['sha256'])
 out=(ROOT/r['streams'][0]['path']).read_text();check('actual pass/fail counts:'+label,f'ℹ pass {passed}\n' in out and f'ℹ fail {failed}\n' in out and f'ℹ tests {passed+failed}\n' in out)
result={'repair':REPAIR,'authorTestCorrection':TEST,'historicalReview':PRIOR,'scope':'SOURCE_ONLY_RUNTIME_HOLD','checks':len(checks),'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'results':checks}
print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
