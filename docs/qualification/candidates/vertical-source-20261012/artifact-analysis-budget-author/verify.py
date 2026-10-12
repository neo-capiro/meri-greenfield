"""Offline source/evidence checks only: no product import or runtime execution."""
import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[5]
packet=pathlib.Path(__file__).resolve().parent
checks=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def entries(ref):
 return {row.split(b'\t',1)[1].decode():row.split(b'\t',1)[0].decode() for row in git('ls-tree','-rz',ref).split(b'\0') if row}
manifest=json.loads((packet/'manifest.json').read_text())
for member in manifest['members']:
 data=(root/member['path']).read_bytes()
 check('bytes:'+member['path'],len(data)==member['bytes'])
 check('sha256:'+member['path'],hashlib.sha256(data).hexdigest()==member['sha256'])
preservation=json.loads((packet/'source-preservation.json').read_text())
base,current=entries(preservation['base']),entries(preservation['source'])
check('originals unchanged',all(current.get(k)==v for k,v in base.items()))
check('original count',len(base)==preservation['baseEntries']==8797)
for ref in json.loads((packet/'references.json').read_text()):
 data=git('show',ref['ref']+':'+ref['path'])
 check('reference:'+ref['path'],len(data)==ref['bytes'] and hashlib.sha256(data).hexdigest()==ref['sha256'] and data==git('show',preservation['source']+':'+ref['path']))
for tag,passed,failed in [('first',28,1),('cancellation-before',29,4),('repaired',33,0),('authority-before',34,5),('authority-repaired',39,0)]:
 receipt=json.loads((packet/(tag+'.json')).read_text());stdout=(packet/(tag+'.stdout.txt')).read_bytes();stderr=(packet/(tag+'.stderr.txt')).read_bytes()
 check(tag+' raw streams',hashlib.sha256(stdout).hexdigest()==receipt['stdoutSha256'] and hashlib.sha256(stderr).hexdigest()==receipt['stderrSha256'])
 check(tag+' exact counts',f'pass {passed}\n'.encode() in stdout and f'fail {failed}\n'.encode() in stdout and b'skipped 0\n' in stdout)
 check(tag+' source and cleanup',receipt['sourceDiff']=='' and receipt['groupAbsent'] and not receipt['timeout'] and receipt['exitCode']==(1 if failed else 0))
 for path in preservation['newProductPaths']:
  check(tag+' source file:'+path,git('show',receipt['source']+':'+path)!=b'')
source=(root/'apps/artifacts/postgres-analysis.mjs').read_text()
check('public budget import',"from '../gateway/index.mjs'" in source and '/gateway/budget/' not in source)
check('no new timer or pg import',all(x not in source for x in ['setTimeout','setInterval',"from 'pg'",'.connect(','.query(']))
check('default unavailable','sourceEnabled=false' in source)
check('no automatic failed settlement',"outcome:'completed'" in source and "outcome:'failed'" not in source)
prior=git('show','6564816500e54f46a60832ad75f0cc88c8e6f9ba:apps/artifacts/test/artifact-postgres-analysis.test.mjs').decode()
expected=prior.replace('assert.equal(t.state.checks,3);','assert.equal(t.state.checks,4);').replace('if(t.state.checks===2)t.state.receipt','if(t.state.checks===3)t.state.receipt').replace('for(const check of [2,3])','for(const check of [3,4])').replace('(check===3)','(check===4)').replace("check===3?'10':'0'","check===4?'10':'0'")
check('original controls preserved with explicit stage shift',expected==(root/'apps/artifacts/test/artifact-postgres-analysis.test.mjs').read_text())
check('current product matches source freeze',all((root/path).read_bytes()==git('show',preservation['source']+':'+path) for path in preservation['newProductPaths']))
check('fresh dispatch fence' ,'await authorize();active(value.signal);observation.dispatchStarted=true' in source)
check('independent current deadline bound',"ctx.deadlineMs>Math.min(current.deadlineMs,Date.parse(current.claims.expiresAt))" in source)
result={'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks}
print(json.dumps(result,indent=2))
raise SystemExit(1 if result['failed'] else 0)
