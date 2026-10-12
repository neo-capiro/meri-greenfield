#!/usr/bin/env python3
"""Read-only exact Git/evidence integrity; no tests, imports or services."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
E=Path(__file__).resolve().parent;ROOT=E.parents[4];checks=[]
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def get(ref,p):return git('show',ref+':'+p)
def check(n,x):checks.append({'name':n,'pass':bool(x)})
def identity(b):return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def tree(ref):return dict((r.split(b'\t',1)[1].decode(),r.split(b'\t',1)[0].decode()) for r in git('ls-tree','-rz',ref).split(b'\0') if r)
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';source='77522c80132c8454781d54156fa61669bc5c823f';author=sys.argv[1];head=git('rev-parse','HEAD').decode().strip();old,current=tree(base),tree(head)
check('all7677 original tracked entries remain mode/blob exact',len(old)==7677 and all(current.get(p)==v for p,v in old.items()))
stages=[('3da3f17ec677f5c3f67435501e723d1ab23d1d26',['research-legal-candidates.schema.json','research-legal-candidates-validation.mjs'],'retrieval-research-legal-candidates.test.mjs'),('0463c80a521c0d0db83f3769b1511e54a4d8b3f5',['public-domain-datasets.json','public-domain-registry.mjs','public-domain-query.schema.json','public-domain-query-validation.mjs'],'retrieval-public-domain-query.test.mjs'),('d8eaa037a0e0505c42d1619136f129ff32232c7e',['research-legal-legislation.schema.json','research-legal-legislation-validation.mjs'],'retrieval-research-legal-legislation.test.mjs'),('64853d387fe98e3ff117fd6ad9c3652bf5465276',['research-legal-news.schema.json','research-legal-news-validation.mjs'],'retrieval-research-legal-news.test.mjs'),(source,['public-domain-hearings.schema.json','public-domain-hearing-records.schema.json','public-domain-hearings-validation.mjs'],'retrieval-public-domain-hearings.test.mjs')]
product=[]
for ref,names,test in stages:
 for p in ['packages/contracts/retrieval-0.2/'+n for n in names]+['packages/contracts/test/'+test]:
  b=get(ref,p);check('accepted staged bytes preserved '+p,(ROOT/p).read_bytes()==b and get(source,p)==b and get(author,p)==b);product.append({'path':p,'acceptedSource':ref,**identity(b)})
check('18 new product/test files exactly',len(product)==18)
for name,total in [('research-audit.stdout.json',48),('global-metadata-audit.stdout.json',135),('legal-audit.stdout.json',57),('news-audit.stdout.json',49),('hearing-audit.stdout.json',58)]:
 x=json.loads((E/name).read_text());check('bounded audit result '+name,x['status']=='PASS' and x['passed']==x['total']==total and all(c['pass'] for c in x['checks']))
for p in sorted(E.glob('*.json')):
 try:r=json.loads(p.read_text())
 except ValueError:continue
 if not isinstance(r,dict) or 'ownedPidAndPgid' not in r:continue
 check('preserved source capture '+p.name,r['ownedProcessGroupAbsent'] and not r['timedOut'] and r['sourceDiffBytes']==0)
 for s in r['streams']:
  b=(ROOT/s['path']).read_bytes();check('raw receipt '+s['path'],identity(b)=={'bytes':s['bytes'],'sha256':s['sha256']})
 try:os.killpg(r['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('owned process absent '+p.name,absent)
# Historical partial manifest is checked at its own immutable freeze, not against later expanded tests/report.
historical='35f4bf378c96df4d20fe8ca135ab5c7a8f62895e';hm=json.loads((E/'stage-two-manifest.json').read_text())
for m in hm['members']:check('historical staged member '+m['path'],identity(get(historical,m['path']))=={'bytes':m['bytes'],'sha256':m['sha256']})
AP='docs/qualification/candidates/backend-execution-20261012/public-legal/';mb=get(author,AP+'manifest.json');am=json.loads(mb)
check('author packet source/runtime scope',am['source']==source and am['base']==base and am['runtimeQualified'] is False)
check('author members unique and safe',len(am['members'])==len({m['path'] for m in am['members']}) and all(not m['path'].startswith('/') and '..' not in Path(m['path']).parts for m in am['members']))
for m in am['members']:check('author member '+m['path'],identity(get(author,m['path']))=={'bytes':m['bytes'],'sha256':m['sha256']})
check('author manifest binds all18 product files',set(p['path'] for p in product)<=set(m['path'] for m in am['members']))
authorTree=tree(author)
check('author preserves every baseline mode/blob',all(authorTree.get(p)==v for p,v in old.items()))
vr=json.loads(get(author,AP+'verify-result.json'));check('author verifier successful and exact manifest bound',vr['checks']==vr['passed']==8191 and vr['failed']==0 and vr['failures']==[] and vr['source']==source and vr['manifestSha256']==hashlib.sha256(mb).hexdigest() and vr['runtimeActionsExecuted'] is False)
for m in am['members']:
 if not m['path'].endswith('/receipt.json'):continue
 r=json.loads(get(author,m['path']));folder=str(Path(m['path']).parent)+'/'
 check('author capture bounded '+folder,r.get('ownedGroupAbsent',r.get('groupAbsent')) is True and r['timeout'] is False and r['sourceDiff']=='')
 for stream in ['stdout','stderr']:check('author raw receipt '+folder+stream,hashlib.sha256(get(author,folder+stream+'.txt')).hexdigest()==r[stream+'Sha256'])
 try:os.killpg(r['processGroup'],0);absent=False
 except ProcessLookupError:absent=True
 check('author group independently absent '+folder,absent)
 if folder.endswith('six-operations-author-final/'):
  raw=get(author,folder+'stdout.txt').decode();check('all155 author tests exact final source',r['source']==source and r['exitCode']==0 and 'tests 155' in raw and 'pass 155' in raw and 'fail 0' in raw)
  check('final capture producer archival bytes',hashlib.sha256(get(author,AP+'capture-focused.py')).hexdigest()==r['producerSha256'])
cleanup=json.loads((E/'owned-cleanup.json').read_text());check('local dependency copies removed only7',len(cleanup['removedOwnedDependencies'])==7 and all(not(ROOT/'node_modules'/x['name']).exists() for x in cleanup['removedOwnedDependencies']))
print(json.dumps({'status':'PASS' if all(x['pass'] for x in checks) else 'FAIL','reviewHead':head,'source':source,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'authorPacket':author,'authorManifest':identity(mb),'authorManifestMembers':len(am['members']),'originalEntries':len(old),'passed':sum(x['pass'] for x in checks),'total':len(checks),'acceptedFiles':product,'checks':checks,'scope':'Standalone six-operation source/evidence only; canonical integration and runtime remain separately qualified.'},indent=2))
raise SystemExit(0 if all(x['pass'] for x in checks) else 1)
