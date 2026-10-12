"""Independent exact Git/source/packet/receipt audit; no private target execution."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[4];HERE=Path(__file__).resolve().parent
BASE='cff71e1ba8ca8dea8970ad0c778b580a73f84815';SOURCE='5fca98580c5d93c9f9aa4a3ed518e926e087846c';FAMILY='bdbb14603cfab0d52d483956f7f1a7e373abb3cb';AUTHOR='844b9b00639d3fa712e15ed5e0872702ee1a974d';REVIEW='757e3e691f4578781116d81fb516b5c9f454325a'
PATH='packages/contracts/commands-0.2/';files=[PATH+'task-create.schema.json',PATH+'task-create-validation.mjs',PATH+'artifact-file.schema.json',PATH+'artifact-file-validation.mjs','packages/contracts/test/command-task-create.test.mjs','packages/contracts/test/command-artifact-file.test.mjs'];loader=PATH+'validate.mjs'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(c,p):return git('show',c+':'+p)
def sha(b):return hashlib.sha256(b).hexdigest()
def tree(c):return {r.split('\t',1)[1]:r.split()[2] for r in git('ls-tree','-r',c).decode().splitlines()}
checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
base,source=tree(BASE),tree(SOURCE);check('exact root source tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='f242534f5a55495a0d0f421eb97c2fd746d88748')
check('all6947 originals byte-identical',len(base)==6947 and all(source.get(p)==v for p,v in base.items()))
for p in files:check('exact accepted family:'+p,blob(SOURCE,p)==blob(FAMILY,p)==(ROOT/p).read_bytes())
check('exact reviewed family test',blob(SOURCE,'packages/contracts/test/command-payloads-independent.test.mjs')==blob(REVIEW,'packages/contracts/test/command-payloads-independent.test.mjs'))
check('current connected loader exact root',blob(SOURCE,loader)==(ROOT/loader).read_bytes())
added={p for p in source if p not in base and p.startswith(('packages/','apps/','scripts/'))};check('only six family files reviewed control and connected loader',added==set(files+[loader,'packages/contracts/test/command-payloads-independent.test.mjs']))
packet_identities=[]
for lane,commit in [('command-payloads-author',AUTHOR),('command-payloads-review',REVIEW)]:
 prefix='docs/qualification/candidates/read-continuation-20261012/'+lane+'/';m=blob(commit,prefix+'manifest.json');d=json.loads(m);rows=d['entries'];packet_identities.append({'lane':lane,'commit':commit,'members':len(rows),'bytes':len(m),'sha256':sha(m)})
 check('manifest preserved:'+lane,m==blob(SOURCE,prefix+'manifest.json'))
 check('safe unique manifest paths:'+lane,len(rows)==len({r['path'] for r in rows}) and all(not Path(r['path']).is_absolute() and '..' not in Path(r['path']).parts for r in rows))
 for row in rows:
  b=blob(commit,row['path']);check('packet member:'+lane+':'+row['path'],len(b)==row['bytes'] and sha(b)==row['sha256'] and b==blob(SOURCE,row['path']))
 check('packet exact source binding:'+lane,d['sourceFreeze']==FAMILY)
 if lane.endswith('review'):check('independent accepted exact author packet',d['verdict']=='ACCEPT_SOURCE' and d['authorPacket']==AUTHOR)
# Every original public/schema/catalog/test blob is already included in the complete tree check.
for p in ['packages/contracts/meri.schema.json','packages/contracts/validate.mjs','packages/contracts/package.json','packages/contracts/retrieval-0.2/operation-contracts.mjs','packages/contracts/retrieval-0.2/catalog.json']:
 check('canonical owner unchanged:'+p,blob(BASE,p)==blob(SOURCE,p)==(ROOT/p).read_bytes())
code=blob(SOURCE,loader).decode();imports=[l for l in code.splitlines() if l.startswith('import ')];expected=["import {readFileSync} from 'node:fs';","import Ajv from 'ajv/dist/2020.js';","import addFormats from 'ajv-formats';","import {validateShape as validatePublicShape, canonicalSha256} from '../validate.mjs';","import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';","import {createTaskCreateValidators} from './task-create-validation.mjs';","import {createArtifactFileValidators} from './artifact-file-validation.mjs';"]
check('deliberate canonical imports',imports==expected)
check('strict Ajv and duplicate private names refusal','new Ajv({strict: true, allErrors: true})' in code and 'if (validators.has(name)) throw' in code)
check('fixed schema reads only',"ajv.addSchema(readSchema('../meri.schema.json'))" in code and "['task-create', 'artifact-file']" in code)
check('unknown names refused before any data observation',code.index("typeof name !== 'string'")<code.index('snapshotOperationData(value)'))
check('no execution dispatcher or network owner',not any(x in code for x in ['fetch(', 'child_process', 'process.', 'Date.now', 'setInterval', 'setTimeout', 'import(']))
for label,count in [('connected-first',143)]:
 r=json.loads((HERE/(label+'.json')).read_bytes());head=r['sourceHead'];check('tested exact loader and family:'+label,all(blob(head,p)==blob(SOURCE,p) for p in files+[loader]) and r['sourceDiffBytes']==0)
 check('owned group physically absent:'+label,r['exitCode']==0 and r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for row in r['streams']:
  b=(ROOT/row['path']).read_bytes();check('raw stream:'+row['path'],len(b)==row['bytes'] and sha(b)==row['sha256'])
 out=(ROOT/r['streams'][0]['path']).read_text();check('actual143 pass no skips',f'ℹ pass {count}\n' in out and 'ℹ fail 0\n' in out and 'ℹ skipped 0\n' in out)
result={'source':SOURCE,'sourceTree':'f242534f5a55495a0d0f421eb97c2fd746d88748','familySource':FAMILY,'authorPacket':AUTHOR,'familyReview':REVIEW,'originalBlobsPreserved':6947,'packetIdentities':packet_identities,'sourceIdentities':[{'path':p,'bytes':len(blob(SOURCE,p)),'sha256':sha(blob(SOURCE,p))} for p in files+[loader]],'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'results':checks,'scope':'SOURCE_ONLY_NOT_AUTHORIZATION_STORAGE_OR_RUNTIME'}
print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
