"""Offline comparison of source, reviewed bytes and evidence; no source execution."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5];lane=Path(__file__).resolve().parent
base='2aa0a33bdaf36af1224cfdb840bc493e53cea9f3';checks=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def check(name,passed,**details):checks.append({'name':name,'passed':bool(passed),**details})
def tree(ref):
 result={}
 for line in git('ls-tree','-r',ref).decode().splitlines():
  meta,path=line.split('\t');result[path]=meta
 return result
before=tree(base);after=tree('HEAD')
allowed={'packages/contracts/retrieval-0.2/'+p for p in ['catalog.json','catalog-validation.mjs','validate.mjs']}
allowed|={'packages/contracts/test/'+p for p in ['retrieval-action-item-binding.test.mjs','retrieval-action-item-independent.test.mjs','retrieval-catalog-bindings.test.mjs','retrieval-mail.test.mjs','retrieval-memory-binding.test.mjs','retrieval-next-bindings.test.mjs','retrieval-next-integration-independent.test.mjs','retrieval-read-continuation-bindings.test.mjs','retrieval-read-continuation-independent.test.mjs']}
allowed|={'apps/gateway/test/'+p for p in ['capability-next-independent.test.mjs','action-item-context-independent.test.mjs','memory-context-independent.test.mjs','mail-context-independent.test.mjs']}
changed=[p for p,v in before.items() if after.get(p)!=v]
check('Only16 allocated prior paths change',set(changed)==allowed,paths=changed)
check('Every other original file is exact',all(after.get(p)==v for p,v in before.items() if p not in allowed),originalFiles=len(before))
check('No original file deleted',all(p in after for p in before))
check('Public exports source locks and native runtime untouched',not any(p.startswith(('apps/','infra/','scripts/','evals/')) or p in ['package.json','package-lock.json','packages/contracts/package.json'] for p in changed if p not in allowed))
prior=json.loads(git('show',base+':packages/contracts/retrieval-0.2/catalog.json'));catalog=json.loads((root/'packages/contracts/retrieval-0.2/catalog.json').read_text())
oldids={x['operation']['id'] for x in prior['operations']};new=[x for x in catalog['operations'] if x['operation']['id'] not in oldids];ids={x['operation']['id'] for x in new}
expected={'search_sec_filings','search_fara_registrations','search_lda_filings','search_acquisition_personnel','get_acquisition_person','get_bill_status','search_floor_votes','search_congress_bills','read_bill_text'}
check('Exactly nine accepted additions',ids==expected and len(new)==9)
check('All37 prior descriptors unchanged',[x for x in catalog['operations'] if x['operation']['id'] in oldids]==prior['operations'])
check('139originals96selected43deferred45mapped51pending46typed',len(catalog['originals'])==139 and sum(x['disposition']=='selected' for x in catalog['originals'])==96 and sum(x['disposition']=='deferred' for x in catalog['originals'])==43 and sum(x['state']=='mapped' for x in catalog['originals'])==45 and sum(x['state']=='pending' for x in catalog['originals'])==51 and len(catalog['operations'])==46)
for old in prior['originals']:
 expected={**old,'state':'mapped','replacement':{'id':old['id'],'version':'0.2.0'}} if old['id'] in ids else old
 check('Original boundary: '+old['id'],next(x for x in catalog['originals'] if x['id']==old['id'])==expected)
check('Every operation stays unavailable pending null-handler zero-retry',all(x['handler'] is None and x['availability']=='unimplemented' and x['qualification']=='pending' and x['retry']['maxRetries']==0 and not x['retry']['retryableCodes'] for x in catalog['operations']))
accepted=json.loads((lane/'accepted-sources.json').read_text())
for family in accepted:
 for name in family['files']:
  path='packages/contracts/retrieval-0.2/'+name;raw=(root/path).read_bytes()
  check('Exact reviewed source: '+name,raw==git('show',family['commit']+':'+path),commit=family['commit'],sha256=hashlib.sha256(raw).hexdigest())
 manifest=json.loads((root/family['manifest']).read_text());members=next(manifest[k] for k in ['members','files','entries'] if k in manifest)
 for member in members:
  raw=(root/member['path']).read_bytes();check('Review member: '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
for operation in new:
 for field in ['inputSchema','outputSchema']:
  group=operation[field]['id'].split(':')[3];raw=(root/('packages/contracts/retrieval-0.2/'+group+'.schema.json')).read_bytes();schema=json.loads(raw)
  check('Schema pin '+operation['operation']['id']+' '+field,operation[field]['sha256']==hashlib.sha256(raw).hexdigest() and operation[field]['id'].split('#/$defs/')[1] in schema['$defs'])
check('Source tracked diff clean',not git('diff','HEAD','--','apps','packages','scripts','package.json','package-lock.json'))
result={'base':base,'sourceHead':git('rev-parse','HEAD').decode().strip(),'sourceTree':git('rev-parse','HEAD^{tree}').decode().strip(),'scope':'SOURCE_ONLY_NOT_RUNTIME','checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)}
(lane/'audit-results.json').write_text(json.dumps(result,indent=2)+'\n')
(lane/'capability-ledger.json').write_text(json.dumps({'scope':'DERIVED_REPORT_NOT_A_REGISTRY','catalogVersion':catalog['catalogVersion'],'catalogSha256':hashlib.sha256((root/'packages/contracts/retrieval-0.2/catalog.json').read_bytes()).hexdigest(),'originals':catalog['originals']},indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='checks'}))
for row in checks:
 if not row['passed']:print(json.dumps(row))
raise SystemExit(1 if result['failed'] else 0)
