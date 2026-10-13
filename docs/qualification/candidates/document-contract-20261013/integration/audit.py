"""Read-only integrated source and evidence identity audit."""
import hashlib,json,os,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[5];E=pathlib.Path(__file__).parent
BASE='4699fdea910ba25c809725630443198c8ae189e4';PUBLIC='e91143dafe2da71546fdfb3b0152807032f4e9b8';APP='374e2285fd5a544b609161fa4c92e54b82d71627'
def git(*a):return subprocess.check_output(['git',*a],cwd=R)
def tree(ref):return {p.decode():m.decode().split()[2] for x in git('ls-tree','-rz',ref).split(b'\0') if x for m,p in [x.split(b'\t',1)]}
def sha(x):return hashlib.sha256(x).hexdigest()
base=tree(BASE);now=tree('HEAD');pub=tree(PUBLIC);app=tree(APP)
allowed={'apps/control/document-application/OUTLINE.md','apps/control/document-application/README.md','apps/control/document-application/current.mjs','apps/control/document-application/index.mjs','apps/control/document-application/local/fixture.mjs','packages/contracts/README.md','packages/contracts/package-lock.json','packages/contracts/package.json'}
changed={p for p,h in base.items() if now.get(p)!=h};assert changed==allowed,(changed,allowed)
checks=[];sources=[]
for prefix,owner in [('apps/control/document-application/',app),('packages/contracts/',pub)]:
 for p,h in owner.items():
  if p.startswith(prefix) and base.get(p)!=h:
   assert now.get(p)==h,p;raw=(R/p).read_bytes();sources.append({'path':p,'blob':h,'bytes':len(raw),'sha256':sha(raw)})
for p,h in base.items():
 if p not in allowed:assert now.get(p)==h,p
manifest_members=0
for p in ['document-contract-20261013/author/manifest.json','document-contract-20261013/review/manifest.json','workbook-drafting-20261013/author/filename-repair-manifest.json','workbook-drafting-20261013/review/manifest.json']:
 path=R/'docs/qualification/candidates'/p;d=json.loads(path.read_text())
 for row in d['members']:
  raw=(R/row['path']).read_bytes();assert len(raw)==row['bytes'] and sha(raw)==row['sha256'],row['path'];manifest_members+=1
checks=[{'label':label,'exit':code,'count':count} for label,code,count in [('public-package',1,None),('public-package-local-deps',0,71),('independent-receiver',1,None),('independent-receiver-vm',0,58),('document-application',1,None),('document-application-root-bound',0,102),('public-pack',0,None)]]
for check in checks:
 d=json.loads((E/(check['label']+'.json')).read_text());assert d['exitCode']==check['exit'] and d['sourceDiffBytes']==0 and d['ownedProcessGroupAbsent'] and not d['timedOut']
 for row in d['streams']:
  raw=(R/row['path']).read_bytes();assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
 if check['count'] is not None:
  out=(E/(check['label']+'.stdout.bin')).read_text();assert 'tests '+str(check['count']) in out and 'fail 0' in out,(check['label'],out[-600:])
 try:os.killpg(d['ownedPidAndPgid'],0)
 except ProcessLookupError:pass
 else:raise AssertionError('owned group remains')
catalog=json.loads((R/'packages/contracts/retrieval-0.2/catalog.json').read_text());originals=catalog['originals'];operations=catalog['operations']
assert len(originals)==139 and sum(x['disposition']=='selected' for x in originals)==96 and sum(x['disposition']=='deferred' for x in originals)==43
assert len(operations)==97
for row in operations:assert row['availability']=='unimplemented' and row['handler'] is None and row['qualification']=='pending' and row['retry']['maxRetries']==0
ledger={'original':139,'selected':96,'deferred':43,'mapped':sum(x['state']=='mapped' for x in originals),'typedOperations':97,'sourceEnabled':False,'runtimeAccepted':False}
(E/'capability-ledger.json').write_text(json.dumps(ledger,indent=2)+'\n')
(E/'source-blobs.json').write_text(json.dumps({'publicSource':PUBLIC,'applicationSource':'16a4f883962bd72f9421949df95709f65b286555','members':sources},indent=2)+'\n')
result={'verdict':'ACCEPT_SOURCE','runtime':'HOLD','head':git('rev-parse','HEAD').decode().strip(),'baseline':BASE,'baselineEntries':len(base),'unchangedBaselineEntries':len(base)-len(changed),'changedOriginalPaths':sorted(changed),'sourceMembers':len(sources),'roleManifestMembers':manifest_members,'checks':checks,'ownedGroupsAbsent':len(checks),'capabilities':ledger}
(E/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
