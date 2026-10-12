"""Exact Git/metadata inspection only; never imports private or candidate modules."""
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='c1c9bfde7dd466a0474589a224a99b44277adbc9';SOURCE='c7d2bb344d56552d271c3f8d508b99cb8e2bb970';PACKET='8edcfe8673072bcc925bc332e5a584b800ca5042';INITIAL='306734d65e90c079bf150a9a93f9be74fcc0e285';P='docs/qualification/candidates/read-continuation-20261012/public-web-author/'
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args])
def blob(ref,path):return git('show',ref+':'+path)
def tree(ref):return {r.split('\t',1)[1]:r.split('\t',1)[0] for r in git('ls-tree','-r',ref).decode().splitlines()}
checks=[]
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
base=tree(BASE);now=tree('HEAD');changed=[p for p,h in base.items() if now.get(p)!=h]
check('All original blobs and modes unchanged',not changed)
files=['packages/contracts/retrieval-0.2/public-web.schema.json','packages/contracts/retrieval-0.2/public-web-validation.mjs','packages/contracts/test/retrieval-public-web.test.mjs'];identities=[]
for path in files:
 b=blob(SOURCE,path);working=(ROOT/path).read_bytes();check('Exact source and packet '+path,b==working==blob(PACKET,path));identities.append({'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
check('Schema unchanged by narrow author repair',blob(INITIAL,files[0])==blob(SOURCE,files[0]))
new=blob(SOURCE,files[1]).decode();old=blob(INITIAL,files[1]).decode();repair="      if (page.truncated && (page.text.length !== input.maxChars ||\n          page.kind !== 'pdf' && !page.text.endsWith('...'))) fail('Public-web truncated prefix window mismatch');\n"
check('Only exact truncated-window source guard added',new.count(repair)==1 and new.replace(repair,'')==old)
newtest=blob(SOURCE,files[2]).decode();oldtest=blob(INITIAL,files[2]).decode();prefix=newtest[:newtest.index("\ntest('truncated HTML/PDF cannot return")]
recovered=prefix.replace("html('x'.repeat(3997)+'...',true)","html('partial',true)").replace("pdf('x'.repeat(3997)+'...',4001)","pdf('partial',4001)")
check('Original test exactly recovers after two declared fixture corrections',recovered.rstrip('\n')==oldtest.rstrip('\n'))
negative=blob('4c3d84e4e524ccb9cc9404df26d97a6d72de78b1',files[2]).decode();marker="test('truncated HTML/PDF cannot return"
check('Original committed negative assertions unchanged',negative[negative.index(marker):]==newtest[newtest.index(marker):])
check('Canonical inert JSON dependency only',"import {snapshotOperationData} from './operation-contracts.mjs';" in new and sum(l.startswith('import ') for l in new.splitlines())==1)
for row in json.loads((E/'reference-identities.json').read_text())['references']:
 for v in row['versions']:
  b=subprocess.check_output(['git','-C','/workspace/capirov2','show',v['commit']+':'+row['path']]);h=subprocess.check_output(['git','-C','/workspace/capirov2','rev-parse',v['commit']+':'+row['path']],text=True).strip();check('Exact reference '+v['commit'][:7]+':'+row['path'],h==v['blob'] and len(b)==v['bytes'] and hashlib.sha256(b).hexdigest()==v['sha256'])
 check('No observed drift '+row['path'],row['versions'][0]['blob']==row['versions'][1]['blob'])
m=json.loads(blob(PACKET,P+'manifest.json'));paths=[r['path'] for r in m['members']]
check('Exact20 safe unique author manifest members',len(paths)==len(set(paths))==20 and all(not p.startswith('/') and '..' not in Path(p).parts for p in paths))
for r in m['members']:
 b=blob(PACKET,r['path']);check('Author member '+r['path'],len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'])
verify=json.loads(blob(PACKET,P+'verification.json'));check('Author78-pass source evidence retained',verify['passed']==78 and verify['failed']==0 and verify['originalFilesPreserved']==6528)
for label,code,count in [('focused-initial',0,26),('truncation-before',1,27),('focused-truncation-repaired',0,27)]:
 r=json.loads(blob(PACKET,P+label+'.json'));check('Original source check retained '+label,r['exitCode']==code and r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  b=blob(PACKET,stream['path']);check('Exact source raw stream '+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
 text=blob(PACKET,P+label+'.stdout.bin').decode();check('Original test count '+label,('tests '+str(count)) in text)
for p,h in base.items():
 if p.endswith(('package.json','package-lock.json')):assert now.get(p)==h
check('Full inventory/public/dependencies/app source unchanged',all(now.get(p)==h for p,h in base.items()))
result={'base':BASE,'source':SOURCE,'packet':PACKET,'head':git('rev-parse','HEAD').decode().strip(),'originalCount':len(base),'originalChanged':changed,'sourceIdentities':identities,'authorManifestSha256':hashlib.sha256(blob(PACKET,P+'manifest.json')).hexdigest(),'checks':checks,'passed':sum(r['passed'] for r in checks),'failed':sum(not r['passed'] for r in checks),'runtimeAccepted':False}
print(json.dumps(result,indent=2));sys.exit(bool(result['failed']))
