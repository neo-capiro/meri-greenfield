"""Immutable source metadata and original-file preservation; no source execution."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';REPO='/workspace/capirov2'
def git(*args,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),*args])
checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
refs=json.loads((E/'reference-identities.json').read_text())
for ref in refs:
 a=git('show',ref['pin']+':'+ref['path'],repo=REPO);b=git('show',ref['observedCommit']+':'+ref['path'],repo=REPO)
 check('pinned metadata identity '+ref['path'],hashlib.sha256(a).hexdigest()==ref['sha256'] and len(a)==ref['bytes'])
 check('observed unchanged '+ref['path'],a==b)
base={x.split(b'\t',1)[1]:x.split(b'\t',1)[0] for x in git('ls-tree','-r',BASE).splitlines()}
now={x.split(b'\t',1)[1]:x.split(b'\t',1)[0] for x in git('ls-tree','-r','HEAD').splitlines()}
check('all original Git entries unchanged',all(now.get(k)==v for k,v in base.items()))
check('no uncommitted original source change',git('diff','--name-only',BASE,'--',*[k.decode() for k in base]).strip()==b'')
schema=json.loads((ROOT/'packages/contracts/retrieval-0.2/action-items-complete.schema.json').read_text());defs=schema['$defs']
meta=json.loads((E/'projection-metadata.json').read_text());fields=[row['field'] for row in meta['fields']]
check('all26 projected fields present',len(fields)==26 and set(fields)==set(defs['ActionItemsUnscopedCard']['properties']))
check('only clientName optional',set(defs['ActionItemsUnscopedCard']['required'])==set(fields)-{'clientName'})
check('four-field raw unscoped envelope',set(defs['ActionItemsUnscopedPage']['properties'])==set(meta['unscopedEnvelope']))
check('input canonical dependency',defs['ActionItemsCompleteInput']['$ref'].endswith('operational-reads:0.2.0#/$defs/ActionItemReadInput'))
check('output canonical scoped dependency',defs['ActionItemsCompleteResult']['oneOf'][0]['$ref'].endswith('operational-reads:0.2.0#/$defs/ActionItemClientScopedPage'))
module=(ROOT/'packages/contracts/retrieval-0.2/action-items-complete-validation.mjs').read_text()
check('sole import canonical inert snapshot',module.count('import ')==1 and "from './operation-contracts.mjs'" in module)
check('real scoped validation delegated','assertActionItemClientScopedPage(page,request,{actorId:context.binding.actorId})' in module)
check('full binding correlation','canonicalSha256(page.binding)!==canonicalSha256(context.binding)' in module)
check('no ambient source/clock','Date.now' not in module and 'fetch(' not in module)
check('both accepted results detached',module.count('return page;')==2 and 'page=snapshotOperationData(value)' in module)
check('signed priority storage bound',defs['ActionItemsUnscopedCard']['properties']['priority']=={'type':'integer','minimum':-2147483648,'maximum':2147483647})
check('no native proof in unscopedcard','linkedSourceProofs' not in defs['ActionItemsUnscopedCard']['properties'])
(E/'source-audit.json').write_text(json.dumps({'sourceHead':git('rev-parse','HEAD').decode().strip(),'base':BASE,'originalEntriesPreserved':len(base),'checks':checks,'passed':len(checks),'privateBodiesPublished':False,'sourceRuntimeQualified':False},indent=2)+'\n')
print(json.dumps({'checks':len(checks),'passed':len(checks),'pairedReferences':len(refs),'originalEntriesPreserved':len(base)}))
