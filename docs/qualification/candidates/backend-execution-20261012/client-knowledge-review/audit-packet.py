"""Verify immutable author packet and reviewed source bytes without running producers."""
import pathlib,subprocess,json,hashlib,os,sys
root=pathlib.Path(__file__).resolve().parents[5];out=pathlib.Path(__file__).resolve().parent
packet=sys.argv[1];checks=[]
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def sha(b):return hashlib.sha256(b).hexdigest()
def check(label,ok):checks.append({'check':label,'pass':bool(ok)})
prefix='docs/qualification/candidates/backend-execution-20261012/client-knowledge/'
manifest_bytes=git('show',packet+':'+prefix+'manifest.json');manifest=json.loads(manifest_bytes);source='dcb375c544de2dfcd4cdecc2692cc8ec9a83cb03';check('packet source freeze',manifest['sourceFreeze']==source)
checksums=[];groups=[]
for m in manifest['members']:
 b=git('show',packet+':'+m['path']);check('packet member '+m['path'],len(b)==m['bytes']and sha(b)==m['sha256'])
 if m['path'].endswith('.json'):
  d=json.loads(b)
  if isinstance(d,dict)and'ownedPidAndPgid'in d:
   check('capture cleaned '+m['path'],d['ownedProcessGroupAbsent']and not d['timedOut']);groups.append(d['ownedPidAndPgid'])
   for stream in d['streams']:
    stream_bytes=git('show',packet+':'+stream['path']);check('raw stream '+stream['path'],len(stream_bytes)==stream['bytes']and sha(stream_bytes)==stream['sha256'])
for group in sorted(set(groups)):
 try:os.killpg(group,0);absent=False
 except ProcessLookupError:absent=True
 except PermissionError:absent=False
 check('author group physically absent '+str(group),absent)
for family in ['search','monday','attachments','memory','profile']:
 for suffix in ['.schema.json','-validation.mjs']:
  path='packages/contracts/retrieval-0.2/client-knowledge-'+family+suffix;b=git('show',source+':'+path);check('reviewed exact source '+path,(root/path).read_bytes()==b==git('show',packet+':'+path));checksums.append({'path':path,'bytes':len(b),'sha256':sha(b)})
 path='packages/contracts/test/retrieval-client-knowledge-'+family+'.test.mjs';b=git('show',source+':'+path);check('original author controls '+path,(root/path).read_bytes()==b==git('show',packet+':'+path));checksums.append({'path':path,'bytes':len(b),'sha256':sha(b)})
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
def tree(rev):return {l.split('\t',1)[1]:l.split('\t',1)[0]for l in git('ls-tree','-r',rev).decode().splitlines()}
a,b=tree(base),tree(packet);check('all original '+str(len(a))+' files unchanged in author packet',all(b.get(p)==o for p,o in a.items()))
new=set(b)-set(a);allowed=lambda p:p.startswith(('packages/contracts/retrieval-0.2/client-knowledge-','packages/contracts/test/retrieval-client-knowledge-',prefix))or p in ['docs/coordination/tasks/CODEX-CLIENT-KNOWLEDGE-20261012.md','docs/coordination/reports/CODEX-CLIENT-KNOWLEDGE-20261012.md'];check('author new paths exclusively allocated',all(map(allowed,new)));check('no reviewer test edited by author',not any('-independent' in p for p in new))
result={'verdict':'ACCEPT_SOURCE_PACKET'if all(c['pass']for c in checks)else'HOLD','packet':packet,'source':source,'manifestSha256':sha(manifest_bytes),'manifestMembers':len(manifest['members']),'authorGroups':sorted(set(groups)),'passed':sum(c['pass']for c in checks),'total':len(checks),'sourceFiles':checksums,'checks':checks,'scope':'SOURCE_ONLY_NOT_RUNTIME'}
target=out/'author-final-packet-audit.json';assert not target.exists();target.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k]for k in ['verdict','packet','source','manifestMembers','passed','total']}));sys.exit(0 if all(c['pass']for c in checks)else 1)
