"""Read immutable author packet, exact patch correspondence and local receipts."""
import hashlib,json,os,re,subprocess
from pathlib import Path
R=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='1375349a62f4abc036ee091d0d2ebe3a6ec62910';SOURCE='2955ec6cfd1b38908cc62d9a1f5a8800bf7f5bdc';PACKET='a8ea67254e7f229413e4a31b05f7e3bc334cfd74';AUTHOR='docs/qualification/candidates/vertical-source-20261012/test-continuation-author/'
def git(*args):return subprocess.check_output(['git',*args],cwd=R)
def blob(ref,path):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
checks=0;failed=[]
def check(v,label):
 global checks
 checks+=1
 if not v:failed.append(label)
def absent(pid):
 try:os.killpg(pid,0);return False
 except ProcessLookupError:return True
manifest=json.loads(blob(PACKET,AUTHOR+'manifest.json'));check(len(manifest['members'])==38,'38 author members')
for m in manifest['members']:
 b=blob(PACKET,m['path']);check(len(b)==m['bytes'] and sha(b)==m['sha256'],'author member:'+m['path'])
check(git('diff',SOURCE,PACKET,'--','apps','packages')==b'','metadata-only final author commit')
for direction in ['forward','inverse']:
 check(blob(PACKET,AUTHOR+direction+'.patch')==(E/('independent-'+direction+'.patch')).read_bytes(),'independent exact '+direction+' patch')
rows=json.loads(blob(PACKET,AUTHOR+'test-expectation-changes.json'))['changes'];local={r['path']:r for r in json.loads((E/'audit-result.json').read_text())['files']}
check(set(local)=={r['path'] for r in rows},'exact15 metadata files')
for row in rows:
 path=row['path'];before=blob(BASE,path);after=blob(SOURCE,path)
 for key in ['beforeSha256','afterSha256','beforeTests','afterTests']:check(row[key]==local[path][key],'source identity/count:'+path+':'+key)
 pattern=rb'\btest\s*\(\s*([\'"`])([^\n]*?)\1'
 check(re.findall(pattern,before)==re.findall(pattern,after),'test declaration strings unchanged:'+path)
 check(len(re.findall(rb'\bassert(?:\.[A-Za-z]+)?\s*\(',before))==row['beforeAssertions'],'author assertion pattern before:'+path)
 check(len(re.findall(rb'\bassert(?:\.[A-Za-z]+)?\s*\(',after))==row['afterAssertions'],'author assertion pattern after:'+path)
rec=json.loads(blob(PACKET,AUTHOR+'frozen-focused.json'))
check(rec['sourceHead']==SOURCE and rec['sourceDiffBytes']==0 and rec['exitCode']==0,'455 focused exact source')
out=blob(PACKET,AUTHOR+'frozen-focused.stdout.bin').decode()
for line in ['ℹ tests 455','ℹ pass 455','ℹ fail 0','ℹ cancelled 0','ℹ skipped 0']:check(line in out,'author result:'+line)
receipts=[]
for folder,ref in [(E,None),(R/AUTHOR,PACKET)]:
 for p in sorted(folder.glob('*.json')):
  d=json.loads(p.read_text())
  if 'ownedPidAndPgid' not in d:continue
  pid=d['ownedPidAndPgid'];check(d['ownedProcessGroupAbsent'] and not d['timedOut'] and not d['ownedGroupKillRequired'],'reported cleanup:'+str(pid));check(absent(pid),'fresh cleanup:'+str(pid))
  for stream in d['streams']:
   b=blob(ref,stream['path']) if ref else (R/stream['path']).read_bytes();check(sha(b)==stream['sha256'] and len(b)==stream['bytes'],'stream:'+stream['path'])
  receipts.append({'path':p.relative_to(R).as_posix(),'pgid':pid,'freshAbsent':absent(pid)})
result={'verdict':'PASS' if not failed else 'FAIL','checks':checks,'failed':failed,'source':SOURCE,'authorPacket':PACKET,'manifestMembers':38,'manifestSha256':sha(blob(PACKET,AUTHOR+'manifest.json')),'authorFocusedTests':455,'declarationsRetained':sum(r['beforeTests'] for r in rows),'assertionCallsites':{'authorPatternBefore':sum(r['beforeAssertions'] for r in rows),'authorPatternAfter':sum(r['afterAssertions'] for r in rows),'reviewerDotPatternBefore':sum(r['beforeAssertions'] for r in local.values()),'reviewerDotPatternAfter':sum(r['afterAssertions'] for r in local.values()),'difference':'Author pattern includes two bare assert(...) calls; both methods find seven added assertion callsites.'},'receipts':receipts}
(E/'packet-audit-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));raise SystemExit(bool(failed))
