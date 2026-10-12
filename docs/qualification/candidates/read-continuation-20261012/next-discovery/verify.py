"""Read-only identity, scope and metadata audit; never emit private bodies."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent;repo=root.parent/'capirov2'
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd)
checks=[]
def check(name,v):checks.append({'name':name,'passed':bool(v)})
for family in ['disclosures','acquisition','congressional']:
 data=json.loads((e/(family+'-reference-identities.json')).read_bytes())
 for row in data['references']:
  b=git('show',data['sourceCommit']+':'+row['path'],cwd=repo)
  check(family+':'+row['path']+' bytes/hash',len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
  check(family+':'+row['path']+' frozen blob',git('rev-parse',data['sourceCommit']+':'+row['path'],cwd=repo).decode().strip()==row['blob'])
  ob=git('rev-parse',data['observedCommit']+':'+row['path'],cwd=repo).decode().strip()
  check(family+':'+row['path']+' drift metadata',ob==row['observedBlob'] and row['unchanged']==(row['blob']==ob))
for row in json.loads((e/'acquisition-observed-drift.json').read_bytes())['changedReferences']:
 b=git('show','4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace:'+row['path'],cwd=repo)
 check(row['path']+' observed bytes/hash',len(b)==row['observedBytes'] and hashlib.sha256(b).hexdigest()==row['observedSha256'])
cat=json.loads((root/'packages/contracts/retrieval-0.2/catalog.json').read_bytes());originals=cat['originals'];ids={x['id']:x for x in originals}
check('all139 originals',len(originals)==139)
check('96 selected43 deferred',sum(x['disposition']=='selected' for x in originals)==96 and sum(x['disposition']=='deferred' for x in originals)==43)
check('base mapped20',sum(x['state']=='mapped' for x in originals)==20)
ops=[]
for family in ['disclosures','acquisition','congressional']:
 for op in json.loads((e/(family+'-contracts.json')).read_bytes())['operations']:
  ops.append(op['id']);check(op['id']+' selected pending at base',ids[op['id']]['disposition']=='selected' and ids[op['id']]['state']=='pending')
check('nine unique traced operations',len(ops)==len(set(ops))==9)
active={'search_funding_opportunities','get_funding_opportunity_requirements','get_funding_opportunity','get_opportunity_client_context','get_opportunity_government_landscape','read_client_documents','query_economic_data','search_federal_grants','search_federal_awards','get_district_nexus_context','get_district_nexus_changes','search_state_bills','get_state_legislator','search_cbo_cost_estimates','search_gao_reports','search_crs_reports'}
check('16 current candidates excluded',len(active)==16 and not set(ops)&active)
check('source/catalog/runtime bytes unchanged',git('diff','9736528eab9fa8ce94037782728559da6c30830a','--','apps','packages','scripts','package.json','package-lock.json')==b'')
result={'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'sourceExecuted':False,'scope':'READ_ONLY_METADATA_NOT_IMPLEMENTATION_ACCEPTANCE'}
(e/'verification-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'failed':result['failed'],'failures':[c for c in checks if not c['passed']]}))
raise SystemExit(0 if not result['failed'] else 1)
