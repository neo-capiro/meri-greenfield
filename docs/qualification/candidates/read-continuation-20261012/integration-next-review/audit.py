"""Read-only identity and receipt audit of the exact combined source."""
from pathlib import Path
import subprocess,json,hashlib,re
root=Path.cwd();e=Path(__file__).resolve().parent
base='2aa0a33bdaf36af1224cfdb840bc493e53cea9f3';source='4566cef6417428d46274a14f7937ca11df66ae9d'
results=[]
def check(name,ok):results.append({'name':name,'passed':bool(ok)})
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):return {x.split('\t',1)[1]:x.split()[2] for x in git('ls-tree','-r',ref).decode().splitlines()}
before,after=tree(base),tree(source)
changes={p for p in before if before[p]!=after.get(p)}
allowed={
'apps/gateway/test/'+n+'.test.mjs' for n in ['action-item-context-independent','capability-next-independent','mail-context-independent','memory-context-independent']}
allowed|={'packages/contracts/retrieval-0.2/'+n for n in ['catalog-validation.mjs','catalog.json','validate.mjs']}
allowed|={'packages/contracts/test/'+n+'.test.mjs' for n in ['retrieval-action-item-binding','retrieval-action-item-independent','retrieval-catalog-bindings','retrieval-mail','retrieval-memory-binding','retrieval-next-bindings','retrieval-next-integration-independent','retrieval-read-continuation-bindings','retrieval-read-continuation-independent']}
check('exact16 original changed files',changes==allowed)
check('no original deletion',set(before)<=set(after))
check('all other original blobs identical',all(before[p]==after[p] for p in before if p not in allowed))
check('public package source preserved',all(before[p]==after[p] for p in before if p.startswith('packages/contracts/') and '/retrieval-0.2/' not in p and '/test/' not in p))
check('gateway production untouched',all(before[p]==after[p] for p in before if p.startswith('apps/gateway/') and '/test/' not in p))
check('canonical inert JSON owner untouched',before['packages/contracts/retrieval-0.2/operation-contracts.mjs']==after['packages/contracts/retrieval-0.2/operation-contracts.mjs'])
references={'88c9257e':['disclosures.schema.json','disclosures-validation.mjs'],'fbe72ed6':['acquisition-personnel.schema.json','acquisition-personnel-validation.mjs'],'b6d446a4':['federal-legislation.schema.json','federal-legislation-validation.mjs'],'6213468':['congressional-identity.mjs'],'079c9fd8':['bill-text.schema.json','bill-text-validation.mjs','bill-text-cursor.mjs']}
familyPins=[]
for commit,names in references.items():
 full=git('rev-parse',commit).decode().strip()
 for name in names:
  path='packages/contracts/retrieval-0.2/'+name;b=git('show',full+':'+path);check('accepted domain bytes '+name,b==git('show',source+':'+path)==(root/path).read_bytes());familyPins.append({'path':path,'acceptedCommit':full,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
for path in ['packages/contracts/test/retrieval-bill-text-independent.test.mjs','packages/contracts/test/retrieval-disclosures-independent.test.mjs','packages/contracts/test/retrieval-acquisition-personnel-independent.test.mjs','packages/contracts/test/retrieval-federal-legislation-independent.test.mjs']:
 check('domain independent source preserved '+path,(root/path).read_bytes()==git('show',source+':'+path))
reviewCount=0
for lane in ['disclosures-review','acquisition-review','federal-legislation-review','bill-text-review']:
 manifest=root/'docs/qualification/candidates/read-continuation-20261012'/lane/('review-manifest.json' if lane=='federal-legislation-review' else 'manifest.json');j=json.loads(manifest.read_text());members=j.get('members',j.get('files',[]));check(lane+' manifest nonempty',bool(members))
 for row in members:
  p=root/row['path'];b=p.read_bytes();check(lane+': '+p.name,len(b)==row.get('bytes',row.get('size')) and hashlib.sha256(b).hexdigest()==row['sha256']);reviewCount+=1
rootLane=Path('/workspace/meri-selected-reads-next-20261012');rootEvidence=rootLane/'docs/qualification/candidates/read-continuation-20261012/integration-next';receiptPins=[]
for name,expected in [('combined-final',1666),('public-distribution',7),('source-audit',None)]:
 p=rootEvidence/(name+'.json');j=json.loads(p.read_text());check(name+' exact clean source',j['sourceHead']==source and j['sourceDiffBytes']==0 and j['sourceDiffSha256']==hashlib.sha256(b'').hexdigest());check(name+' bounded physical cleanup',j['exitCode']==0 and j['ownedProcessGroupAbsent'] and not j['timedOut']);out=None
 for stream in j['streams']:
  b=(rootLane/stream['path']).read_bytes();check(name+' raw '+stream['path'].split('.')[-2],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256']);
  if stream['path'].endswith('.stdout.bin'):out=b.decode()
 if expected is not None:check(name+' exact test count',bool(re.search(r'(?:#|ℹ) pass '+str(expected)+r'\b',out)) and bool(re.search(r'(?:#|ℹ) fail 0\b',out)))
 receiptPins.append({'path':p.relative_to(rootLane).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source':j['sourceHead'],'streams':j['streams'],'ownedPidAndPgid':j['ownedPidAndPgid']})
for p in sorted(e.glob('*.json')):
 j=json.loads(p.read_text())
 if not isinstance(j,dict) or 'streams' not in j:continue
 check(p.name+' bounded owned cleanup',j['ownedProcessGroupAbsent'] and not j['timedOut'])
 for stream in j['streams']:
  b=(root/stream['path']).read_bytes();check(p.name+' preserved '+stream['path'].split('.')[-2],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
result={'source':source,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'base':base,'originalBlobCount':len(before),'originalChangedFiles':sorted(changes),'reviewManifestMembers':reviewCount,'acceptedFamilyPins':familyPins,'rootReceiptPins':receiptPins,'passed':sum(x['passed'] for x in results),'failed':sum(not x['passed'] for x in results),'results':results}
print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
