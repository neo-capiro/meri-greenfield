"""Read-only exact Git source/preservation checks; no source import or native calls."""
from pathlib import Path
import subprocess,json,hashlib,sys
root=Path(__file__).resolve().parents[5]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def content(ref,path):return git('show',ref+':'+path)
def tree(ref):
 out={}
 for item in git('ls-tree','-r','-z',ref).split(b'\0'):
  if item:
   info,path=item.split(b'\t');out[path.decode()]=info.decode()
 return out
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';candidate=sys.argv[1]
checks=[]
def check(name,value):
 checks.append({'check':name,'pass':bool(value)})
 if not value:raise AssertionError(name)
a=tree(base);b=tree(candidate)
allowed={'apps/gateway/dispatch/operation-context.mjs','apps/gateway/dispatch/read-result-envelope.mjs','packages/contracts/retrieval-0.2/catalog-validation.mjs'}
changed={p for p in a if a[p]!=b.get(p)}
check('only3 allocated prior source paths changed',changed==allowed)
check('all other base entries preserved',all(b.get(p)==v for p,v in a.items() if p not in allowed))
path='packages/contracts/retrieval-0.2/catalog-validation.mjs';s=content(candidate,path).decode();old=content(base,path).decode()
check('canonical binding only one dataset dispatchProfile insertion',s.replace("    dispatchProfile: 'dataset-metadata/1',\n",'')==old and s.count("dispatchProfile: 'dataset-metadata/1'")==1)
path='apps/gateway/dispatch/read-result-envelope.mjs';s=content(candidate,path).decode();old=content(base,path).decode()
check('envelope existing behavior retained except explicit dataset profile',s.replace("['memory-proposals/1', 'dataset-metadata/1'].includes(entry.contract.binding?.dispatchProfile)","entry.contract.binding?.dispatchProfile === 'memory-proposals/1'")==old)
path='apps/gateway/dispatch/operation-context.mjs';s=content(candidate,path).decode();old=content(base,path).decode()
s=s.replace("['memory-proposals/1', 'mail-candidates/1', 'dataset-metadata/1']","['memory-proposals/1', 'mail-candidates/1']")
s=s.replace("  if (profile === 'dataset-metadata/1') return Object.freeze({ authority: null,\n    options: () => ({}), observeAuthority() {}, async retain() {},\n  });\n",'')
check('context prior memory mail and no-profile code exact after allocated addition inverse',s==old)
for p in ['packages/contracts/retrieval-0.2/public-domain-registry.mjs','packages/contracts/retrieval-0.2/public-domain-datasets.json']:
 check('provider exact accepted dependency '+p,content(candidate,p)==content('0463c80a521c0d0db83f3769b1511e54a4d8b3f5',p))
cat=json.loads(content(candidate,'packages/contracts/retrieval-0.2/catalog.json'))
check('all71 descriptors remain same as base',content(candidate,'packages/contracts/retrieval-0.2/catalog.json')==content(base,'packages/contracts/retrieval-0.2/catalog.json') and len(cat['operations'])==71)
check('all handlers null and unavailable',all(x['handler'] is None and x['availability']=='unimplemented' and x['qualification']=='pending' and x['retry']['maxRetries']==0 for x in cat['operations']))
paths=sorted(allowed|{'apps/gateway/sources/dataset-metadata/handler.mjs','apps/gateway/test/dataset-metadata-handler.test.mjs','packages/contracts/retrieval-0.2/public-domain-registry.mjs','packages/contracts/retrieval-0.2/public-domain-datasets.json'})
result={'base':base,'candidate':candidate,'candidateTree':git('rev-parse',candidate+'^{tree}').decode().strip(),'checks':checks,'passed':len(checks),'baseEntries':len(a),'preservedEntries':len(a)-len(changed),'allowedChanges':sorted(changed),'sourceIdentities':[{'path':p,'bytes':len(content(candidate,p)),'sha256':hashlib.sha256(content(candidate,p)).hexdigest()} for p in paths],'scope':'OFFLINE_SOURCE_PRESERVATION_NOT_RUNTIME'}
Path(__file__).with_name('source-audit-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
