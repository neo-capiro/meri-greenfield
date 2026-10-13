"""Bounded owned-subtree capture. No network, model, DB or donor mutation."""
import ctypes, hashlib, json, os, pathlib, signal, subprocess, sys, time
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[3]
if len(sys.argv)<3: raise SystemExit('usage: capture.py LABEL COMMAND [ARGS...]')
label=sys.argv[1]
if not label.replace('-','').isalnum(): raise SystemExit('invalid label')
targets=[HERE/(label+suffix) for suffix in ['.stdout.txt','.stderr.txt','.json']]
if any(p.exists() for p in targets): raise SystemExit('receipt already exists; choose new label')
libc=ctypes.CDLL(None,use_errno=True)
if libc.prctl(36,1,0,0,0)!=0: raise OSError(ctypes.get_errno(),'PR_SET_CHILD_SUBREAPER')
source=pathlib.Path(os.environ.get('MERI_REVIEW_SOURCE_ROOT',ROOT)).resolve()
pin=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=source,text=True).strip()
start=time.monotonic();p=subprocess.Popen(sys.argv[2:],cwd=source,env={**os.environ,'MERI_REVIEW_SOURCE_ROOT':str(source)},stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
timed_out=False
try: out,err=p.communicate(timeout=180)
except subprocess.TimeoutExpired:
 timed_out=True
 os.killpg(p.pid,signal.SIGKILL)
 out,err=p.communicate(timeout=10)
reaped=[]
for _ in range(100):
 try:
  child,status=os.waitpid(-1,os.WNOHANG)
  if child: reaped.append({'pid':child,'status':status});continue
 except ChildProcessError: break
 time.sleep(.01)
try: os.killpg(p.pid,0);group_absent=False
except ProcessLookupError: group_absent=True
targets[0].write_bytes(out);targets[1].write_bytes(err)
record={'sourceCommit':pin,'sourceTree':tree,'command':sys.argv[2:],'cwd':str(source),'timeoutSeconds':180,'exitCode':p.returncode,'timedOut':timed_out,'durationSeconds':round(time.monotonic()-start,3),'subreaper':True,'adoptedChildrenReaped':reaped,'ownedProcessGroupAbsent':group_absent,'stdoutBytes':len(out),'stdoutSha256':hashlib.sha256(out).hexdigest(),'stderrBytes':len(err),'stderrSha256':hashlib.sha256(err).hexdigest()}
targets[2].write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
raise SystemExit(p.returncode if p.returncode else 0 if group_absent else 1)
