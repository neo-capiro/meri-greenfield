from pathlib import Path
import subprocess,json,hashlib,re
r=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
base='ede7b56845816d38d0bbffab5a657aaa4f978739';candidate=subprocess.check_output(['git','rev-parse','8dcc6e1'],cwd=r,text=True).strip(); checks=[]
def git(*a):return subprocess.check_output(['git',*a],cwd=r)
def check(name,okay):
 checks.append({'name':name,'pass':bool(okay)})
 if not okay:raise AssertionError(name)
def blobs(ref):
 return {line.split('\t',1)[1]:line.split()[2] for line in git('ls-tree','-r',ref).decode().splitlines()}
b,c=blobs(base),blobs(candidate);prod='packages/contracts/retrieval-0.2/pe-references-validation.mjs';test='packages/contracts/test/retrieval-pe-references.test.mjs'
check('all original paths retained',set(b)<=set(c));changed={p for p in b if b[p]!=c[p]};check('only two allocated originals changed',changed=={prod,test})
old=git('show',f'{base}:{prod}');new=git('show',f'{candidate}:{prod}');check('sole production delta returns validated snapshot',new.replace(b'    return page;',b'    return value;')==old)
oldtest=git('show',f'{base}:{test}');newtest=git('show',f'{candidate}:{test}');a=b'assert.equal(check(op,page,input(),{}),page);';z=b'const result=check(op,page,input(),{});assert.deepEqual(result,before);assert.notEqual(result,page);';check('original test exact inverse recovers every original byte',newtest.replace(z,a)==oldtest)
check('all original test names retained',re.findall(rb"test\('([^']+)'",oldtest)==re.findall(rb"test\('([^']+)'",newtest))
for p in [prod,test,'packages/contracts/retrieval-0.2/pe-references.schema.json','packages/contracts/retrieval-0.2/pe-contractors-validation.mjs','packages/contracts/retrieval-0.2/operation-contracts.mjs','packages/contracts/retrieval-0.2/catalog.json']:
 check('working exact candidate '+p,git('hash-object',p).decode().strip()==c[p])
author='docs/qualification/candidates/read-continuation-20261012/pe-reference-detachment'
check('author original preimage exact',git('show',f'{candidate}:{author}/original-author-test.mjs.txt')==oldtest)
for label in ['original-negative','repaired-original-tests']:
 rec=json.loads(git('show',f'{candidate}:{author}/{label}.json'))
 check(label+' expected failure retained',rec['exitCode']!=0)
 check(label+' owned cleanup',rec['ownedProcessGroupAbsent'] and not rec['timedOut'])
 for stream in rec['streams']:
  data=git('show',f"{candidate}:{stream['path']}");check(label+' stream '+stream['path'],len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
for label,counts in [('baseline-independent',(7,9)),('baseline-corrected',(8,8)),('repaired-independent',(16,0))]:
 rec=json.loads((e/f'{label}.json').read_text());check(label+' cleanup',rec['ownedProcessGroupAbsent'] and not rec['timedOut'] and not rec['ownedGroupKillRequired'])
 out=(e/f'{label}.stdout.bin').read_text();check(label+' test counts',f'pass {counts[0]}' in out and f'fail {counts[1]}' in out)
 for stream in rec['streams']:
  data=(r/stream['path']).read_bytes();check(label+' stream '+stream['path'],len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
result={'base':base,'candidate':candidate,'candidateTree':git('rev-parse',candidate+'^{tree}').decode().strip(),'originalFiles':len(b),'unchangedOriginalFiles':len(b)-len(changed),'checks':checks,'passed':len(checks),'sourceHashes':{p:hashlib.sha256(git('show',f'{candidate}:{p}')).hexdigest() for p in [prod,test]},'limits':'No private source reread, native/provider queries, broad suite or runtime admission.'}
(e/'audit-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['candidate','candidateTree','originalFiles','unchangedOriginalFiles','passed']}))
