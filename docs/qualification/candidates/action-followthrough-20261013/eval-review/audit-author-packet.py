"""Independent Git-only audit of the immutable final author packet."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5];evidence=Path(__file__).resolve().parent
packet='747bb13191b3ba4c272f03cb3c6bd818a47a2a60';source='33a0d21b005d32d9c27de5f3a7939b77588921db';prefix='docs/qualification/candidates/action-followthrough-20261013/eval-author/'
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def blob(ref,path):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
checks=[]
def check(name,value):
 checks.append({'check':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
raw=blob(packet,prefix+'manifest.json');manifest=json.loads(raw)
check('exact independently received manifest identity',sha(raw)=='9ed422ad6c7cd546d88e11d5966c4b67fafe029afcdf233fb6503946ee3559a1')
check('manifest binds accepted source',manifest['source']==source)
check('exact unique23 members',len(manifest['members'])==23 and len({r['path'] for r in manifest['members']})==23)
for r in manifest['members']:
 b=blob(packet,r['path']);check('member '+r['path'],len(b)==r['bytes'] and sha(b)==r['sha256'])
for p in ['admission.mjs','execute.mjs','test/execution.test.mjs','test/fixtures.mjs']:
 name='evals/task-lookup/execution/'+p;check('reviewed source/test unchanged '+p,blob(source,name)==blob(packet,name))
changes=[x.split('\t') for x in git('diff','--name-status',source,packet).decode().splitlines()]
check('packet changes only own documentation/evidence',all(p.startswith(prefix) or p in ['evals/task-lookup/execution/README.md','docs/coordination/tasks/CODEX-ACTION-FOLLOWTHROUGH-EVAL-20261013.md','docs/coordination/reports/CODEX-ACTION-FOLLOWTHROUGH-EVAL-20261013.md'] for _,p in changes))
check('source qualification false',manifest['runtimeQualified'] is False)
report=blob(packet,'docs/coordination/reports/CODEX-ACTION-FOLLOWTHROUGH-EVAL-20261013.md').decode()
check('report retains real0 and original failure',all(x in report for x in ['real corpus remains0','40/1','Proxy','68/68','not a hard process-memory bound']))
check('initial tool-output-only limit disclosed','tool-returned text rather than separate raw streams/process ID' in report)
result={'verdict':'ACCEPT_METADATA','packet':packet,'tree':git('rev-parse',packet+'^{tree}').decode().strip(),'source':source,'manifestSha256':sha(raw),'members':23,'checks':checks,'passed':len(checks),'failed':0,'noBehaviorReplay':True}
(evidence/'author-packet-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['verdict','passed','failed','packet']}))
