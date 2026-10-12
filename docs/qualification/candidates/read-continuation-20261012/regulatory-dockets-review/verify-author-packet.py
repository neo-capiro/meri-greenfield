"""Metadata-only author packet verification using exact Git objects."""
from pathlib import Path
import hashlib,json,subprocess,sys
root=Path(__file__).resolve().parents[5];ref=sys.argv[1];source='57e09ebfda15d6057bdf4bfb7fc84b4061eac03f';prefix='docs/qualification/candidates/read-continuation-20261012/regulatory-dockets-author/'
checks=[]
def check(label,value):checks.append({'check':label,'pass':bool(value)})
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd,timeout=10)
def raw(path):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
def obj(path):return json.loads(raw(path))
manifestBytes=raw(prefix+'manifest.json');manifest=json.loads(manifestBytes)
check('twelve distinct manifest members',len(manifest['files'])==len({m['path'] for m in manifest['files']})==12)
check('exact source binding',manifest['sourceFreeze']==source)
for member in manifest['files']:
 data=raw(member['path']);check('member '+member['path'],len(data)==member['bytes'] and sha(data)==member['sha256'])
check('no source changes after source freeze',not git('diff','--name-only',source,ref,'--','packages','apps','scripts','package.json','package-lock.json'))
r=obj(prefix+'focused-initial.json');patch=raw(prefix+'focused-initial-source.patch')
check('preserved initial dirty patch',len(patch)==r['sourceDiffBytes'] and sha(patch)==r['sourceDiffSha256'] and patch==git('diff',r['sourceHead'],source,'--','apps','packages','scripts','package.json','package-lock.json'))
check('exact focused command and successful cleanup',r['command']==['node','--test','packages/contracts/test/retrieval-regulatory-dockets.test.mjs'] and r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'])
for stream in r['streams']:
 data=raw(stream['path']);check('stream '+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
check('23 passing raw tests',all(text in raw(prefix+'focused-initial.stdout.bin').decode() for text in ['tests 23','pass 23','fail 0','skipped 0']))
check('exact capture producer',sha(raw(prefix+'capture-reaped.py'))==r['captureSha256'])
refs=obj(prefix+'reference-identities.json');check('seven paired refs',len(refs['references'])==7)
for row in refs['references']:
 for kind,pin in [('frozen',refs['sourcePin']),('observed',refs['observedPin'])]:
  data=git('show',pin+':'+row['path'],cwd=Path('/workspace/capirov2'));blob=git('rev-parse',pin+':'+row['path'],cwd=Path('/workspace/capirov2')).decode().strip();entry=row[kind]
  check('ref '+kind+' '+row['path'],len(data)==entry['bytes'] and sha(data)==entry['sha256'] and blob==entry['blob'])
 check('paired equality '+row['path'],row['frozen']==row['observed'] and row['unchanged'])
v=obj(prefix+'verification.json');check('preserved author verifier36 passes',v['checks']==v['passed']==36 and v['failed']==0)
print(json.dumps({'scope':'METADATA_ONLY_NO_SOURCE_TEST_REPLAY','authorFreeze':ref,'source':source,'manifestSha256':sha(manifestBytes),'members':12,'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks)},indent=2))
raise SystemExit(int(any(not c['pass'] for c in checks)))
