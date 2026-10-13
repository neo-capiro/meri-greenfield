"""Offline packet/Git integrity only; does not import or execute product code."""
from pathlib import Path
import hashlib,json,subprocess
p=Path(__file__).resolve().parent
r=p.parents[4]
def git(*args):return subprocess.check_output(['git','-C',str(r),*args])
def sha(data):return hashlib.sha256(data).hexdigest()
checks=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
 if not value:raise AssertionError(name)
def tree(ref):
 out={}
 for row in git('ls-tree','-r','-z',ref).split(b'\0'):
  if row:
   entry,path=row.split(b'\t',1);out[path.decode()]=entry
 return out
manifest=json.loads((p/'manifest.json').read_text())
for member in manifest['members']:
 data=(r/member['path']).read_bytes();check(member['path'],len(data)==member['bytes'] and sha(data)==member['sha256'])
s=json.loads((p/'source-preservation.json').read_text());base=tree(s['base']);current=tree(s['source'])
check('all original entries preserved',len(base)==s['originalEntries'] and all(current.get(k)==v for k,v in base.items()))
for member in s['sourceFiles']:
 data=git('show',s['source']+':'+member['path']);check('source '+member['path'],sha(data)==member['sha256'] and data==(r/member['path']).read_bytes())
for ref in s['referenceIdentities']:
 data=git('show',ref['ref']+':'+ref['path']);check('reference '+ref['path'],len(data)==ref['bytes'] and sha(data)==ref['sha256'])
for tag,passed,failed in [('first',24,22),('repaired',46,0),('control-before',46,1),('outcome-before',46,3),('consolidated',54,0)]:
 receipt=json.loads((p/(tag+'.json')).read_text());out=(p/(tag+'.stdout.txt')).read_bytes();err=(p/(tag+'.stderr.txt')).read_bytes()
 check(tag+' streams',sha(out)==receipt['stdoutSha256'] and sha(err)==receipt['stderrSha256'])
 check(tag+' result',receipt['exitCode']==(0 if not failed else 1) and f'pass {passed}\n' in out.decode() and f'fail {failed}\n' in out.decode())
 check(tag+' cleanup',receipt['groupAbsent'] and not receipt['timeout'] and receipt['durationSeconds']<240)
a=json.loads((p/'consolidated.json').read_text())
check('exact tested source delta',a['sourceDiff']==git('diff',a['source'],s['source'],'--','evals/task-lookup').decode())
check('all product and original scope whitespace',subprocess.run(['git','-C',str(r),'diff','--check',s['base'],s['source'],'--','evals/task-lookup'],capture_output=True).returncode==0)
print(json.dumps({'pass':len(checks),'fail':0,'source':s['source'],'manifestMembers':len(manifest['members']),'originalEntries':len(base),'execution':'offline data/Git only'},indent=2))
