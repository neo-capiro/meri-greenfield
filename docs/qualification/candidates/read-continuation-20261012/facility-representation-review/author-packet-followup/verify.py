"""Read-only exact Git metadata and evidence checks; no source test execution."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[6]
ref='417e9942bd3e8decd1a5ed40760228e263107ed6';source='530416e490763155c5531140f4b70e95a9493b7b';base='4566cef6417428d46274a14f7937ca11df66ae9d'
lane='docs/qualification/candidates/read-continuation-20261012/facility-representation-author/'
checks=[]
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd,timeout=10)
def raw(path,version=ref):return git('show',version+':'+path)
def obj(path):return json.loads(raw(path))
def sha(data):return hashlib.sha256(data).hexdigest()
def check(label,condition):checks.append({'check':label,'pass':bool(condition)})
m=raw(lane+'manifest.json');manifest=json.loads(m)
check('manifest exact supplied hash',sha(m)=='60322fa07832f9cc5696a299721909169a02018075287eb081c6fa158457f67e')
check('ten distinct members',len(manifest['members'])==len({m['path'] for m in manifest['members']})==10)
check('source and acceptance remain bounded',manifest['source']==source and manifest['sourceTree']=='b0b9210fabbb06422a912562dde257b8e54fa01b' and manifest['review']=='f041eed2e46be40d68254187ffd1d9396842bd25' and manifest['runtimeAccepted'] is False and manifest['verdict']=='ACCEPT_SOURCE_PRE_REGISTRY_ONLY')
for member in manifest['members']:
 data=raw(member['path']);check('member '+member['path'],len(data)==member['bytes'] and sha(data)==member['sha256'])
receipt=obj(lane+'focused.json');check('exact source-bound author command and success',receipt['command']==['node','--test','packages/contracts/test/retrieval-facility-representation.test.mjs'] and receipt['sourceHead']==source and receipt['sourceDiffBytes']==0 and receipt['exitCode']==0 and not receipt['timedOut'] and receipt['ownedProcessGroupAbsent'])
for stream in receipt['streams']:
 data=raw(stream['path']);check('raw author stream '+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
check('raw 22 pass zero fail and skip',all(s in raw(lane+'focused.stdout.bin').decode() for s in ['tests 22','pass 22','fail 0','skipped 0']))
check('zero author stderr',raw(lane+'focused.stderr.bin')==b'')
check('capture producer exact',sha(raw(lane+'capture-reaped.py'))==receipt['captureSha256'])
def tree(version):
 records={}
 for line in git('ls-tree','-r','-z',version).split(b'\0'):
  if not line:continue
  identity,path=line.split(b'\t',1);records[path]=identity
 return records
old=tree(base);frozen=tree(source);final=tree(ref);preservation=obj(lane+'source-preservation.json')
check('6001 original complete Git object/mode identities',len(old)==preservation['originalFilesVerified']==6001 and all(frozen.get(p)==v and final.get(p)==v for p,v in old.items()))
check('only documentation changed since accepted source',all(p.startswith('docs/') for p in git('diff','--name-only',source,ref).decode().splitlines()))
for member in preservation['sourceFiles']:
 data=raw(member['path']);check('preserved source '+member['path'],data==raw(member['path'],source) and len(data)==member['bytes'] and sha(data)==member['sha256'])
refs=obj(lane+'reference-identities.json')['references'];check('nine paired references',len(refs)==preservation['referencesVerified']==9)
for reference in refs:
 ids=[]
 for version in reference['versions']:
  data=git('show',version['commit']+':'+reference['path'],cwd=Path('/workspace/capirov2'))
  identity=git('rev-parse',version['commit']+':'+reference['path'],cwd=Path('/workspace/capirov2')).decode().strip();ids.append(identity)
  check('reference '+reference['path']+' '+version['commit'],len(data)==version['bytes'] and sha(data)==version['sha256'] and identity==version['blob'])
 check('paired no drift '+reference['path'],len(ids)==2 and len(set(ids))==1 and reference['unchanged'])
report=raw('docs/coordination/reports/CODEX-FACILITY-REPRESENTATION-AUTHOR-20261012.md').decode()
check('report identifies exact independent verdict', 'f041eed2e46be40d68254187ffd1d9396842bd25' in report and 'federal geography remains an explicit unqualified adapter obligation' in report)
print(json.dumps({'scope':'METADATA_ONLY_NO_TEST_RUNTIME_EXECUTION','authorFreeze':ref,'sourceUnchanged':source,'manifestSha256':sha(m),'originalFiles':6001,'pairedReferences':9,'manifestMembers':10,'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks)},indent=2))
raise SystemExit(int(any(not c['pass'] for c in checks)))
