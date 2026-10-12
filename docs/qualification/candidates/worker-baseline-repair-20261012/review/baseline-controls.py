"""Independent actual Git baseline checks; only the test's Git path is substituted."""
from pathlib import Path
from unittest.mock import patch
import hashlib,json,os,subprocess,sys,tempfile

root=Path(sys.argv[1]).resolve();candidate=sys.argv[2];output=Path(sys.argv[3])
sys.path.insert(0,str(root/'scripts/qualification'))
import worker_image_build as b
accepted='5ee46446b5f60034916f00b2a665b3e2bef9cf60'
historical='f118ff55dfb96ba4b44099953e6c9724064b723d'
facts=[]
def check(name,condition,detail=None):
 facts.append({'check':name,'passed':bool(condition),'detail':detail})
 if not condition:raise AssertionError(name)
def reject(name,fn,reason):
 try:fn()
 except (ValueError,OSError) as error:
  check(name,reason in str(error),str(error));return
 raise AssertionError('unexpected acceptance:'+name)
def git(repo,*args):
 env={k:v for k,v in os.environ.items() if not k.upper().startswith('GIT_')}
 env.update(GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null',GIT_TERMINAL_PROMPT='0')
 r=subprocess.run(['/usr/bin/git','-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-c','user.name=Independent source reviewer','-c','user.email=source-review@example.invalid','-C',str(repo),*args],env=env,capture_output=True,timeout=15)
 if r.returncode:raise AssertionError('local git failed:'+r.stderr.decode())
 return r.stdout
stable=tuple(p for p in b.ORIGINAL if p not in b.PACKAGING_CHANGES)
check('accepted-reference-only',b.REFERENCE==accepted)
check('44-stable-members',len(stable)==44)
with patch.object(b.source,'GIT','/usr/bin/git'):
 current=b.baseline(candidate)
 check('actual-candidate-baseline-passes',len(current)==56)
 old=b.git_files(accepted,stable)
 check('all44-exact-accepted-bytes',all(old[p]==current[p] for p in stable))
 check('unchanged-current-context',b.context_manifest_sha(current)==b.collector.CONTEXT_SHA=='0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903')
 with patch.object(b,'REFERENCE',historical):
  reject('historical-incomplete-baseline-refused',lambda:b.baseline(candidate),'exact Git membership')
 with tempfile.TemporaryDirectory(prefix='meri-baseline-review-') as temp:
  temp_root=Path(temp);git(temp_root,'init','--quiet')
  common=Path(git(root,'rev-parse','--git-common-dir').decode().strip())
  if not common.is_absolute():common=(root/common).resolve()
  (temp_root/'.git/objects/info/alternates').write_text(str(common/'objects')+'\n')
  for name,raw in current.items():
   p=temp_root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
  def commit():
   git(temp_root,'add','--all');git(temp_root,'commit','--quiet','--no-verify','-m','synthetic baseline fixture')
   return git(temp_root,'rev-parse','HEAD').decode().strip()
  seed=commit();member=stable[0]
  with patch.object(b,'ROOT',temp_root):
   check('actual-temporary-Git-baseline-passes',b.baseline(seed)==current)
   p=temp_root/member;raw=p.read_bytes();p.write_bytes(raw+b'\n')
   reject('current-worktree-drift-refused',lambda:b.baseline(seed),'candidate Git/current drift')
   changed=commit()
   reject('committed-stable-drift-refused',lambda:b.baseline(changed),'stable fixture source drift')
   git(temp_root,'reset','--hard',seed);p.unlink();missing=commit()
   reject('missing-stable-Git-member-refused',lambda:b.baseline(missing),'exact Git membership')
   git(temp_root,'reset','--hard',seed)
   p=temp_root/b.collector.ASSEMBLER;p.write_bytes(p.read_bytes()+b'\n');changed=commit()
   reject('committed-assembler-drift-refused',lambda:b.baseline(changed),'assembler reference pin')
   git(temp_root,'reset','--hard',seed)
   for label,name,reason in [('collector',b.collector.COLLECTOR,'collector Git/current drift'),('manifest-owner',b.manifest_owner.MANIFEST_OWNER,'manifest owner Git/current drift')]:
    p=temp_root/name;raw=p.read_bytes();p.write_bytes(raw+b'\n')
    reject(label+'-current-drift-refused',lambda:b.baseline(seed),reason);p.write_bytes(raw)
  owned=temp
check('owned-temporary-Git-fixture-removed',not Path(owned).exists())
output.write_text(json.dumps({'candidate':candidate,'reference':accepted,'facts':facts,'passed':len(facts),'adapter':'Only source.GIT is patched to /usr/bin/git in test scope; actual git_files/baseline and source.git_read are unmodified.','native_owner_execution':'UNRUN: fixed Windows Git/Python unavailable','cloud_calls':0,'image_builds':0},indent=2)+'\n')
print(json.dumps({'passed':len(facts),'total':len(facts)}))
