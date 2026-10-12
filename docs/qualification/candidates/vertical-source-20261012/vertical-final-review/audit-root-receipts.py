"""Verify immutable captured root receipts; never launch a tested service or repeat suites."""
from pathlib import Path
import hashlib,json,os,re,subprocess,sys
R=Path(__file__).resolve().parents[5];O=Path(__file__).resolve().parent
packet=sys.argv[1];candidate=sys.argv[2];finalPath=sys.argv[3]
checks=[];records=[]
def git(*args):return subprocess.check_output(['git','-C',str(R),*args])
def blob(ref,p):return git('show',ref+':'+p)
def ck(n,v):checks.append({'name':n,'passed':bool(v)})
def tree(ref):
 return {p:a.split()[2] for a,p in (r.split(b'\t') for r in git('ls-tree','-r','-z',ref).split(b'\0') if r)}
def absent(pg):
 try:os.killpg(pg,0);return False
 except ProcessLookupError:return True
 except PermissionError:return False
prefix='docs/qualification/candidates/vertical-source-20261012/integration/'
for label,path,expectExit in [('initial',prefix+'combined-source-check.json',1),('public',prefix+'public-distribution-check.json',0),('final',finalPath,0)]:
 raw=blob(packet,path);m=json.loads(raw);ck(label+' exit',m['exitCode']==expectExit)
 ck(label+' exact source capture',m['sourceDiffBytes']==0 and m['sourceDiffSha256']==hashlib.sha256(b'').hexdigest())
 ck(label+' bounded normal completion',not m['timedOut'] and not m['ownedGroupKillRequired'] and m['ownedProcessGroupAbsent'])
 ck(label+' group freshly absent',absent(m['ownedPidAndPgid']))
 streams=[]
 for s in m['streams']:
  b=blob(packet,s['path']);ck(label+' stream bytes '+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256']);streams.append(b)
 stdout=streams[0].decode('utf-8',errors='strict')
 counts={k:int(re.findall(r'^(?:#|ℹ) '+k+r' (\d+)$',stdout,re.M)[-1]) for k in ['tests','pass','fail','cancelled','skipped']}
 if label=='initial':ck('preserved initial4881/4904 failure',counts=={'tests':4904,'pass':4881,'fail':23,'cancelled':0,'skipped':0})
 elif label=='public':
  ck('public7 tests plus generation and types',counts=={'tests':7,'pass':7,'fail':0,'cancelled':0,'skipped':0} and 'check:generated' in stdout and 'typecheck' in stdout)
  pfx=b'packages/contracts/';before=tree(m['sourceHead']);after=tree(candidate)
  protected=[p for p in before if p.startswith(pfx+b'dist/') or p in [pfx+b'meri.schema.json',pfx+b'validate.mjs',pfx+b'package.json',pfx+b'package-lock.json']]
  ck('public receipt remains byte-applicable',all(after.get(p)==before[p] for p in protected))
 else:
  ck('final no failures skips cancellations',counts['tests']==counts['pass'] and counts['fail']==counts['cancelled']==counts['skipped']==0 and counts['tests']>=4944)
  joined=' '.join(m['command'])
  for glob in ['packages/contracts/test/*.test.mjs','evals/qualification/hermes-session.test.mjs','apps/gateway/test/*.test.mjs','apps/control/test/*.test.mjs','apps/control/schedules/test/*.test.mjs','apps/artifacts/test/*.test.mjs']:
   ck('final retained complete command group '+glob,glob in joined)
  source=tree(m['sourceHead']);current=tree(candidate)
  covered=lambda p:p.startswith((b'apps/',b'packages/')) or p==b'evals/qualification/hermes-session.test.mjs'
  ck('final receipt behavior bytes exact candidate',{p:v for p,v in source.items() if covered(p)}=={p:v for p,v in current.items() if covered(p)})
 records.append({'label':label,'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'sourceHead':m['sourceHead'],'counts':counts,'ownedGroup':m['ownedPidAndPgid'],'groupAbsent':True})
result={'packet':packet,'candidate':candidate,'receipts':records,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'runtimeAccepted':False}
(O/'root-receipt-audit-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['passed','failed','receipts']}));print(json.dumps([c for c in checks if not c['passed']]))
raise SystemExit(bool(result['failed']))
