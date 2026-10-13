"""Offline data and Git integrity; imports no execution/control/runtime module."""
from pathlib import Path
import subprocess,json,hashlib
p=Path(__file__).resolve().parent;r=p.parents[4];checks=0
def git(*args):return subprocess.check_output(['git','-C',str(r),*args])
def sha(data):return hashlib.sha256(data).hexdigest()
def check(value):
 global checks
 assert value
 checks+=1
def tree(ref):return {row.split(b'\t',1)[1]:row.split(b'\t',1)[0] for row in git('ls-tree','-r','-z',ref).split(b'\0') if row}
m=json.loads((p/'manifest.json').read_text());s=json.loads((p/'source-preservation.json').read_text())
for row in m['members']:
 data=(r/row['path']).read_bytes();check(len(data)==row['bytes'] and sha(data)==row['sha256'])
b=tree(s['base']);c=tree(s['source']);check(len(b)==s['originalEntries'] and all(c.get(k)==v for k,v in b.items()))
for row in s['referenceIdentities']+s['sourceFiles']:
 data=git('show',row['ref']+':'+row['path']);check(sha(data)==row['sha256'])
for row in s['sourceFiles']:check((r/row['path']).read_bytes()==git('show',s['source']+':'+row['path']))
for tag,count in [('focused',24),('final',24),('proxy-repaired',25)]:
 q=json.loads((p/(tag+'.json')).read_text());out=(p/(tag+'.stdout.txt')).read_bytes();err=(p/(tag+'.stderr.txt')).read_bytes()
 check(sha(out)==q['stdoutSha256'] and sha(err)==q['stderrSha256']);check(q['exitCode']==0 and f'pass {count}\n' in out.decode() and 'fail 0\n' in out.decode());check(q['groupAbsent'] and not q['timeout'] and q['durationSeconds']<240 and q['sourceDiff']=='')
check(git('show',s['source']+':evals/task-lookup/execution/test/execution.test.mjs').startswith(git('show',s['initialSource']+':evals/task-lookup/execution/test/execution.test.mjs')))
check(subprocess.run(['git','-C',str(r),'diff','--check',s['base'],s['source'],'--','evals/task-lookup/execution'],capture_output=True).returncode==0)
print(json.dumps({'pass':checks,'fail':0,'manifestMembers':len(m['members']),'source':s['source'],'originalEntries':len(b),'qualification':'source evidence only'},indent=2))
