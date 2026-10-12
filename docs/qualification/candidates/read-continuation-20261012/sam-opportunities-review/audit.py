"""Independent immutable source/reference audit; no private producer imports."""
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
BASE='c1c9bfde7dd466a0474589a224a99b44277adbc9';SOURCE=sys.argv[1]
FILES=['packages/contracts/retrieval-0.2/sam-opportunities.schema.json','packages/contracts/retrieval-0.2/sam-opportunities-validation.mjs','packages/contracts/test/retrieval-sam-opportunities.test.mjs'];checks=[]
def check(name,value):checks.append({'check':name,'pass':bool(value)})
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd,timeout=15)
def raw(path,ref=SOURCE):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
def tree(ref):return {p:i for row in git('ls-tree','-r','-z',ref).split(b'\0') if row for i,p in [row.split(b'\t',1)]}
old=tree(BASE);new=tree(SOURCE)
check('all original complete blobs and modes preserved',all(new.get(p)==v for p,v in old.items()))
check('only three allocated source additions',sorted(git('diff','--name-status',BASE,SOURCE,'--','packages','apps','scripts','package.json','package-lock.json').decode().splitlines())==sorted('A\t'+p for p in FILES))
check('source is review ancestor',subprocess.run(['git','merge-base','--is-ancestor',SOURCE,'HEAD'],cwd=ROOT).returncode==0)
identities=[]
for p in FILES:
 data=raw(p);check('working exact '+p,(ROOT/p).read_bytes()==data);identities.append({'path':p,'bytes':len(data),'sha256':sha(data),'blob':git('rev-parse',SOURCE+':'+p).decode().strip()})
for p in ['packages/contracts/retrieval-0.2/operation-contracts.mjs','packages/contracts/retrieval-0.2/funding-envelope-validation.mjs','packages/contracts/retrieval-0.2/funding-opportunities.schema.json','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/validate.mjs','packages/contracts/meri.schema.json','packages/contracts/THIRD-PARTY-NOTICES.md']:
 check('canonical original unchanged '+p,raw(p)==raw(p,BASE))
refs=json.loads((HERE/'reference-identities.json').read_text());check('nine independently pinned pairs',len(refs['references'])==9)
for row in refs['references']:
 for v in row['versions']:
  loc=v['commit']+':'+row['path'];data=git('show',loc,cwd='/workspace/capirov2');check('reference '+loc,len(data)==v['bytes'] and sha(data)==v['sha256'] and git('rev-parse',loc,cwd='/workspace/capirov2').decode().strip()==v['blob'])
 check('reference no drift '+row['path'],row['unchanged'] and row['versions'][0]['blob']==row['versions'][1]['blob'])
check('private metadata only',not refs['privateBodiesRetained'] and not refs['executed'])
schema=json.loads(raw(FILES[0]));check('exact private schema ID',schema['$id']=='urn:meri:retrieval:sam-opportunities:0.2.0')
ctx=schema['$defs']['SamOpportunitiesContext'];expected={'asOf','evidenceAccuracyMode','sourceStatusAsOf','sourceHealthAsOf'}
check('closed required four context members',ctx.get('additionalProperties') is False and set(ctx['properties'])==set(ctx['required'])==expected)
text=raw(FILES[1]).decode();check('reuse canonical inert snapshot',"from './operation-contracts.mjs'" in text);check('reuse funding relation helper',"from './funding-envelope-validation.mjs'" in text)
check('no ambient clock or source IO',all(x not in text for x in ['Date.now','new Date()','fetch(','Prisma','process.env','setTimeout','node:child_process']))
check('source whitespace',subprocess.run(['git','diff','--check',BASE,SOURCE],cwd=ROOT,capture_output=True).returncode==0)
print(json.dumps({'scope':'INDEPENDENT_SOURCE_ONLY','sourceCommit':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'base':BASE,'originalFilesPreserved':len(old),'sourceIdentities':identities,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks},indent=2))
raise SystemExit(int(any(not c['pass'] for c in checks)))
