"""Offline source/preservation audit; Git objects and inert evidence bytes only."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5];lane=Path(__file__).resolve().parent
base='fd78590bff1b8551b145a7eafa0ed5f8e23d7bcc';checks=[]
def git(*args): return subprocess.check_output(['git',*args],cwd=root)
def check(name,okay,**details): checks.append({'name':name,'passed':bool(okay),**details})
def tree(commit):
 rows={}
 for line in git('ls-tree','-r',commit).decode().splitlines():
  meta,path=line.split('\t'); rows[path]=meta
 return rows
before=tree(base);after=tree('HEAD')
allowed={'packages/contracts/retrieval-0.2/'+p for p in ['catalog.json','catalog-validation.mjs','validate.mjs']}
allowed|={'packages/contracts/test/'+p for p in ['retrieval-action-item-binding.test.mjs','retrieval-action-item-independent.test.mjs','retrieval-catalog-bindings.test.mjs','retrieval-mail.test.mjs','retrieval-memory-binding.test.mjs','retrieval-next-bindings.test.mjs','retrieval-next-integration-independent.test.mjs']}
changed=[p for p in before if before[p]!=after.get(p)]
check('Only10 allocated baseline files change',set(changed)==allowed,changed=changed)
check('Every other original file remains exact',all(after.get(p)==v for p,v in before.items() if p not in allowed),originalFiles=len(before),unchangedOriginalFiles=len(before)-len(changed))
check('No original path deleted',all(p in after for p in before))
check('Reserved runtime/frontend/native/infra paths unchanged',not any(p.startswith(('apps/','infra/','scripts/','evals/')) for p in changed))
check('Public package exports, locks, distribution and0.1 source unchanged',all(after.get(p)==v for p,v in before.items() if not p.startswith(('docs/','packages/contracts/retrieval-0.2/','packages/contracts/test/'))))
prior=json.loads(git('show',base+':packages/contracts/retrieval-0.2/catalog.json'));catalog=json.loads((root/'packages/contracts/retrieval-0.2/catalog.json').read_text())
oldids={x['operation']['id'] for x in prior['operations']};new=[x for x in catalog['operations'] if x['operation']['id'] not in oldids];newids={x['operation']['id'] for x in new}
check('Exactly16 new operations',len(newids)==16 and len(new)==16)
check('All21 prior descriptors unchanged',[x for x in catalog['operations'] if x['operation']['id'] in oldids]==prior['operations'])
check('139originals/96selected/43deferred/36mapped/60pending',len(catalog['originals'])==139 and sum(x['disposition']=='selected' for x in catalog['originals'])==96 and sum(x['disposition']=='deferred' for x in catalog['originals'])==43 and sum(x['state']=='mapped' for x in catalog['originals'])==36 and sum(x['state']=='pending' for x in catalog['originals'])==60)
for old in prior['originals']:
 expected={**old,'state':'mapped','replacement':{'id':old['id'],'version':'0.2.0'}} if old['id'] in newids else old
 check('Original exact boundary: '+old['id'],next(x for x in catalog['originals'] if x['id']==old['id'])==expected)
check('Every descriptor remains unavailable/null/pending/zero retries',all(x['handler'] is None and x['availability']=='unimplemented' and x['qualification']=='pending' and x['retry']['maxRetries']==0 and not x['retry']['retryableCodes'] for x in catalog['operations']))
family=[('funding-opportunities','256248fee5be45e5f203bbc74cc5b0c0e2f738f7',['funding-opportunities.schema.json','funding-opportunities-validation.mjs','funding-envelope-validation.mjs','funding-requirements-validation.mjs']),('client-documents','6e37343f7289ed8374b722d638f5d6e467f9808a',['client-documents.schema.json','client-documents-validation.mjs']),('public-data','31093cd5b6aaaf246a870eb4f473a6639cc2a7df',['public-data.schema.json','public-data-validation.mjs','public-data-deadlines.mjs']),('district-nexus','c651a0ab75f416a06c91eff07a463d697adb0fa4',['district-nexus.schema.json','district-nexus-validation.mjs']),('state-legislation','3444e7fd48fe07a9df23fe5ee460cea22f886012',['state-legislation.schema.json','state-legislation-validation.mjs']),('public-reports','d86c0710b534fad7626856075bb873715e54b596',['public-reports.schema.json','public-reports-validation.mjs'])]
for group,commit,files in family:
 for name in files:
  path='packages/contracts/retrieval-0.2/'+name;old=git('show',commit+':'+path);current=(root/path).read_bytes();expected=old
  if name in ['public-data-validation.mjs','state-legislation-validation.mjs']:
   expected=expected.replace(b"if (!Object.hasOwn(families, id))",b"if (typeof id !== 'string' || !Object.hasOwn(families, id))").replace(b"if (!Object.hasOwn(schema.$defs, name))",b"if (typeof name !== 'string' || !Object.hasOwn(schema.$defs, name))")
  check('Accepted family bytes with explicit selector repair: '+name,current==expected,acceptedCommit=commit,sha256=hashlib.sha256(current).hexdigest(),guardDelta=current!=old)
 for descriptor in [x for x in new if x['inputSchema']['id'].startswith('urn:meri:retrieval:'+group+':')]:
  raw=(root/('packages/contracts/retrieval-0.2/'+group+'.schema.json')).read_bytes();sha=hashlib.sha256(raw).hexdigest();schema=json.loads(raw)
  check('Schema pins: '+descriptor['operation']['id'],all(descriptor[field]['sha256']==sha and descriptor[field]['id'].split('#/$defs/')[1] in schema['$defs'] for field in ['inputSchema','outputSchema']))
for family,fn in [('funding','manifest.json'),('documents','review-manifest.json'),('public-data','packet-manifest.json'),('district','manifest.json'),('state','manifest.json'),('public-reports','manifest.json')]:
 path=lane.parent/(family+'-review')/fn;data=json.loads(path.read_text());members=next(data[k] for k in ['entries','files','members'] if k in data)
 for member in members:
  value=(root/member['path']).read_bytes();check('Review member: '+member['path'],len(value)==member['bytes'] and hashlib.sha256(value).hexdigest()==member['sha256'])
# Exact trusted-clock and preserved approved memory policy are descriptive source checks.
policy='packages/contracts/retrieval-0.2/memory-review-policy.mjs';check('Approved memory administrator exception unchanged',after[policy]==before[policy])
check('Root source worktree clean',not git('diff','HEAD','--','apps','packages','scripts','package.json','package-lock.json'))
result={'sourceHead':git('rev-parse','HEAD').decode().strip(),'sourceTree':git('rev-parse','HEAD^{tree}').decode().strip(),'base':base,'scope':'SOURCE_ONLY_NOT_RUNTIME_ACCEPTANCE','checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)}
(lane/'audit-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='checks'}))
for x in checks:
 if not x['passed']: print(json.dumps(x))
raise SystemExit(1 if result['failed'] else 0)
