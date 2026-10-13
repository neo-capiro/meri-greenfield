"""Read-only integrated workbook artifact, source and evidence audit."""
import hashlib,json,os,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[5];E=pathlib.Path(__file__).parent;BASE='70516e5c9681917ce493bbc50e3023494f2e1209';FLOW='fd993f5105deda49a88973b42906df3e928ac829'
def git(*a):return subprocess.check_output(['git',*a],cwd=R)
def tree(ref):return {p.decode():m.decode().split()[2] for x in git('ls-tree','-rz',ref).split(b'\0') if x for m,p in [x.split(b'\t',1)]}
def sha(x):return hashlib.sha256(x).hexdigest()
base=tree(BASE);current=tree('HEAD');flow=tree(FLOW)
allowed={'apps/artifacts/office-transform.mjs','apps/artifacts/python/office.py','docs/coordination/tasks/CODEX-WORKBOOK-DRAFTING-20261013.md'};changed={p for p,h in base.items() if current.get(p)!=h};assert changed==allowed,(changed,allowed)
for p,h in base.items():
 if p not in allowed:assert current.get(p)==h,p
sources=[]
for p,h in flow.items():
 if p.startswith(('apps/control/document-application/local/workbook/','scripts/local-workbook/')) or p in {'apps/artifacts/office-transform.mjs','apps/artifacts/python/office.py'}:
  assert current[p]==h,p;raw=(R/p).read_bytes();sources.append({'path':p,'blob':h,'bytes':len(raw),'sha256':sha(raw)})
for p,ref in [('apps/artifacts/office-transform.mjs','1c3cfb9c97681415286236edd21a829e51b565eb'),('apps/artifacts/python/office.py','07d9db0b988a8ff3f04ee3acc21951e5967dea81')]:assert current[p]==tree(ref)[p]
manifest_count=0
for name in ['office-author/manifest.json','office-author/columns-manifest.json','office-review/manifest.json','columns-review/manifest.json','flow-review/manifest.json']:
 d=json.loads((E.parent/name).read_text())
 for row in d['members']:
  raw=(R/row['path']).read_bytes();assert len(raw)==row['bytes'] and sha(raw)==row['sha256'],row['path'];manifest_count+=1
run=json.loads((E/'readable-workbook.stdout.bin').read_text());assert run['status']=='PASS' and all(run['result']['invariants'].values()) and run['nativeQualified']==False and run['productionActivated']==False
assert run['cleanup']['http']=={'closed':True,'listening':False,'activeSockets':0};assert not run['cleanup']['failed']
for f in run['cleanup']['fixtures']:assert f['closed'] and all(f['cleanup'].values())
assert run['cleanup']['fixtures'][0]['consumedMicroUsd']=='20' and run['cleanup']['fixtures'][1]['consumedMicroUsd']=='0'
for label,version,copy in zip(['original','revision'],run['result']['versions'],run['result']['copies']):
 raw=(E/'readable-artifacts'/(label+'.xlsx')).read_bytes();assert len(raw)==version['object']['bytes'] and sha(raw)==version['object']['sha256']==copy['sourceSha256']
 visual=copy['visual'];pdf=(E/'readable-artifacts'/(label+'-preview.pdf')).read_bytes();assert sha(pdf)==visual['sha256']
 for page in visual['pages']:
  raw=(E/'readable-artifacts'/(label+'-preview-'+str(page['page'])+'.png')).read_bytes();assert sha(raw)==page['sha256']
groups=set()
def scan(v):
 if isinstance(v,list):
  for x in v:scan(x)
 elif isinstance(v,dict):
  if 'pid' in v and isinstance(v['pid'],int):groups.add(v['pid'])
  if 'ownedPidAndPgid' in v:groups.add(v['ownedPidAndPgid'])
  for x in v.values():scan(x)
scan(run)
for label,code in [('initial-workbook',1),('recalculated-workbook',1),('readable-workbook',0),('workbook-cli',0)]:
 d=json.loads((E/(label+'.json')).read_text());assert d['exitCode']==code and d['sourceDiffBytes']==0 and d['ownedProcessGroupAbsent'] and not d['timedOut'];scan(d)
 for row in d['streams']:
  raw=(R/row['path']).read_bytes();assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
for pg in groups:
 try:os.killpg(pg,0)
 except ProcessLookupError:pass
 else:raise AssertionError('owned group remains '+str(pg))
(E/'source-blobs.json').write_text(json.dumps({'flowSource':FLOW,'members':sources},indent=2)+'\n')
result={'sourceVerdict':'ACCEPT_SOURCE','runtime':'HOLD','base':BASE,'flowSource':FLOW,'head':git('rev-parse','HEAD').decode().strip(),'baseEntries':len(base),'unchangedBaseEntries':len(base)-len(changed),'changedOriginalPaths':sorted(changed),'roleManifestMembers':manifest_count,'ownedGroupsAbsent':sorted(groups),'invariants':run['result']['invariants'],'sourceMembers':len(sources)}
(E/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
