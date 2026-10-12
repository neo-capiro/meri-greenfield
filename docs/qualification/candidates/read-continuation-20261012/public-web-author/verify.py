"""Offline immutable source, metadata and raw-capture integrity only."""
from pathlib import Path
import hashlib,json,subprocess,os
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
BASE='c1c9bfde7dd466a0474589a224a99b44277adbc9';SOURCE='c7d2bb344d56552d271c3f8d508b99cb8e2bb970';INITIAL='306734d65e90c079bf150a9a93f9be74fcc0e285';NEGATIVE='4c3d84e4e524ccb9cc9404df26d97a6d72de78b1'
FILES=['packages/contracts/retrieval-0.2/public-web.schema.json','packages/contracts/retrieval-0.2/public-web-validation.mjs','packages/contracts/test/retrieval-public-web.test.mjs']
checks=[]
def check(name,value):checks.append({'check':name,'pass':bool(value)})
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd,timeout=15)
def raw(path,ref=SOURCE):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
def tree(ref):return {p:i for row in git('ls-tree','-r','-z',ref).split(b'\0') if row for i,p in [row.split(b'\t',1)]}
old=tree(BASE);new=tree(SOURCE)
check('all original complete blobs and modes preserved',all(new.get(p)==v for p,v in old.items()))
check('only three source additions',sorted(git('diff','--name-status',BASE,SOURCE,'--','packages','apps','scripts','package.json','package-lock.json').decode().splitlines())==sorted('A\t'+f for f in FILES))
identities=[]
for p in FILES:
 data=raw(p);check('working exact '+p,(ROOT/p).read_bytes()==data);identities.append({'path':p,'blob':git('rev-parse',SOURCE+':'+p).decode().strip(),'bytes':len(data),'sha256':sha(data)})
for p in ['packages/contracts/retrieval-0.2/operation-contracts.mjs','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/validate.mjs','packages/contracts/meri.schema.json','packages/contracts/THIRD-PARTY-NOTICES.md']:
 check('canonical/public/license preserved '+p,raw(p)==raw(p,BASE))
refs=json.loads((HERE/'reference-identities.json').read_text());check('ten source policy provider pairs',len(refs['references'])==10)
for row in refs['references']:
 for v in row['versions']:
  data=git('show',v['commit']+':'+row['path'],cwd='/workspace/capirov2');check('reference '+v['commit']+' '+row['path'],len(data)==v['bytes'] and sha(data)==v['sha256'] and git('rev-parse',v['commit']+':'+row['path'],cwd='/workspace/capirov2').decode().strip()==v['blob'])
 check('no drift '+row['path'],row['unchanged'] and row['versions'][0]['blob']==row['versions'][1]['blob'])
check('metadata only references',not refs['privateBodiesRetained'] and not refs['executed'])
check('original author test preserved',(HERE/'initial-author-test.mjs').read_bytes()==raw(FILES[2],INITIAL))
check('schema unchanged during repair',raw(FILES[0],INITIAL)==raw(FILES[0]))
original=raw(FILES[1],INITIAL).decode();expected=original.replace("      if (page.text.length > input.maxChars) fail('Public-web text limit mismatch');","      if (page.text.length > input.maxChars) fail('Public-web text limit mismatch');\n      if (page.truncated && (page.text.length !== input.maxChars ||\n          page.kind !== 'pdf' && !page.text.endsWith('...'))) fail('Public-web truncated prefix window mismatch');")
check('exact bounded prefix repair only',raw(FILES[1]).decode()==expected)
oldtest=raw(FILES[2],NEGATIVE).decode();expectedtest=oldtest.replace("check(scrape,html('',false));check(scrape,html('partial',true));","check(scrape,html('',false));check(scrape,html('x'.repeat(3997)+'...',true));").replace("const p=pdf('partial',4001);check(scrape,p);assert.notEqual(p.totalChars,p.text.length);","const p=pdf('x'.repeat(3997)+'...',4001);check(scrape,p);assert.notEqual(p.totalChars,p.text.length);")
check('only two declared fixture corrections; negative assertions unchanged',raw(FILES[2]).decode()==expectedtest)
receipts=[]
for label,source,code,count,passes,failures in [('focused-initial',INITIAL,0,26,26,0),('truncation-before',NEGATIVE,1,27,26,1),('focused-truncation-repaired',SOURCE,0,27,27,0)]:
 r=json.loads((HERE/(label+'.json')).read_text());receipts.append(r)
 check('receipt exact source '+label,r['sourceHead']==source and r['sourceDiffBytes']==0 and r['sourceDiffSha256']==sha(b''))
 check('receipt completion '+label,r['exitCode']==code and r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 check('capture identity '+label,r['captureSha256']==sha((HERE/'capture-reaped.py').read_bytes()))
 for stream in r['streams']:
  data=(ROOT/stream['path']).read_bytes();check('raw '+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
 output=(HERE/(label+'.stdout.bin')).read_text();check('exact focused result '+label,all(x in output for x in [f'tests {count}',f'pass {passes}',f'fail {failures}','skipped 0']))
 try:os.killpg(r['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('owned group currently absent '+label,absent)
deps=json.loads((HERE/'dependencies.json').read_text());check('seven existing dependency directories',len(deps['packages'])==7)
for row in deps['packages']:
 p=ROOT/'node_modules'/row['name']/'package.json';check('dependency identity '+row['name'],not p.parent.is_symlink() and sha(p.read_bytes())==row['packageJsonSha256'])
check('no IO/parser imports',all(token not in raw(FILES[1]).decode() for token in ['fetch(',"from 'node:child_process'",'pdf-parse','Playwright','axios','setInterval','new Date()','Date.now']))
check('canonical snapshot reused',"import {snapshotOperationData} from './operation-contracts.mjs'" in raw(FILES[1]).decode())
check('source whitespace',subprocess.run(['git','diff','--check',BASE,SOURCE],cwd=ROOT,capture_output=True).returncode==0)
print(json.dumps({'scope':'AUTHOR_OFFLINE_SOURCE_EVIDENCE_NOT_ACCEPTANCE','sourceCommit':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'originalFilesPreserved':len(old),'sourceIdentities':identities,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks,'ownedGroups':[{'pgid':r['ownedPidAndPgid'],'absent':True} for r in receipts],'unrun':['independent acceptance','broad/public','source/network/parser/browser/provider/model/SQL/native runtime']},indent=2))
raise SystemExit(int(any(not c['pass'] for c in checks)))
