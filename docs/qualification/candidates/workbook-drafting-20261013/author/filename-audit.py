"""Narrow repair and retained historical evidence audit; no service or generator calls."""
import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5];out=Path(__file__).resolve().parent
prior='fe81f220d3415c6934333b584f2b625f891a8378';source='16a4f883962bd72f9421949df95709f65b286555'
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
checks=[]
def check(name,passed):
 checks.append({'name':name,'passed':bool(passed)})
 if not passed:raise AssertionError(name)
changed=git('diff','--name-only',prior,source).decode().splitlines()
check('only narrow index and appended tests change',changed==['apps/control/document-application/index.mjs','apps/control/document-application/test/workbook-application.test.mjs'])
p='apps/control/document-application/test/workbook-application.test.mjs'
check('all original workbook assertions remain byte-identical prefix',git('show',source+':'+p).startswith(git('show',prior+':'+p)))
p='apps/control/document-application/index.mjs'
before=git('show',prior+':'+p);after=git('show',source+':'+p)
expected=before.replace(b' // Canonical format helpers produce an ASCII basename; never interpolate arbitrary headers.\n',b' // artifactFilename caps the ASCII basename at120, then appends .docx/.xlsx (125 total).\n // Canonical owners also bind the exact filename to its retained request before release.\n').replace(b'{1,124}',b'{1,125}')
check('exact one-bound repair and explanatory comment',after==expected)
check('canonical filename helper unchanged',git('rev-parse',prior+':packages/contracts/artifacts-0.2/artifact-formats.mjs')==git('rev-parse',source+':packages/contracts/artifacts-0.2/artifact-formats.mjs'))
for label,head,code in [('filename-before','fc8cb9501c8170bf254d2aa96b82c94c5d9271d3',1),('filename-repaired',source,0)]:
 receipt=json.loads((out/(label+'.json')).read_text())
 check(label+' immutable head',receipt['sourceHead']==head and receipt['sourceDiffBytes']==0)
 check(label+' outcome',receipt['exitCode']==code and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'] and receipt['ownedProcessGroupAbsent'])
 try:os.killpg(receipt['ownedPidAndPgid'],0)
 except ProcessLookupError:absent=True
 else:absent=False
 check(label+' physically absent',absent)
 for stream in receipt['streams']:
  b=(root/stream['path']).read_bytes();check(stream['path']+' exact',len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
for label,count in [('filename-before','ℹ fail 4'),('filename-repaired','ℹ pass 15')]:check(label+' count',count in (out/(label+'.stdout.bin')).read_text())
print(json.dumps({'checks':len(checks),'passed':len(checks)}))
(out/'filename-audit.json').write_text(json.dumps({'priorPacket':prior,'finalSource':source,'checks':checks},indent=2)+'\n')
