import ctypes, datetime, hashlib, json, subprocess, sys, time
from pathlib import Path
root=Path(__file__).parent/'meri-input-admission'
folder=root/'docs/coordination/evidence/input-admission'
folder.mkdir(parents=True,exist_ok=True)
class Memory(ctypes.Structure):
 _fields_=[('length',ctypes.c_ulong),('load',ctypes.c_ulong)]+[(n,ctypes.c_ulonglong) for n in ['totalPhysical','availablePhysical','totalPageFile','availablePageFile','totalVirtual','availableVirtual','availableExtendedVirtual']]
def capacity():
 m=Memory();m.length=ctypes.sizeof(m)
 if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):raise RuntimeError('Normal capacity observation unavailable; no probe retry')
 return {'availableCommit':m.availablePageFile,'availablePhysical':m.availablePhysical}
before=capacity()
if before['availableCommit']<1342177280:raise SystemExit('Capacity below existing 1280MiB start threshold; no test launched')
label=sys.argv[1]
argv=['C:/Program Files/nodejs/node.exe','--max-old-space-size=128','--import','../dependency-reuse.mjs','--test','--test-isolation=none','--test-concurrency=1','--test-timeout=15000','--test-reporter=tap',*sys.argv[2:]]
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
tracked=subprocess.check_output(['git','status','--short'],cwd=root,text=True)
hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['apps/control/conversations/service.mjs',*sys.argv[2:]]}
start=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic();stop=None;minimum=dict(before)
with (folder/(label+'.tap')).open('wb') as out,(folder/(label+'.stderr')).open('wb') as err:
 p=subprocess.Popen(argv,cwd=root,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
 while p.poll() is None:
  elapsed=time.monotonic()-clock
  current=capacity()
  minimum={k:min(minimum[k],current[k]) for k in minimum}
  if elapsed>=120:stop='HARD_WALL_120S'
  if current['availableCommit']<536870912:stop='ACTUAL_COMMIT_PRESSURE'
  if stop:p.kill();p.wait(timeout=5);break
  time.sleep(.2)
result={'sourceBase':source,'worktreeStatusBefore':tracked,'sourceSha256':hashes,'argv':argv,'pid':p.pid,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wallMs':round((time.monotonic()-clock)*1000,3),'exit':p.returncode,'stopReason':stop,'hardWallSeconds':120,'heapMiB':128,'ownedProcessRemains':p.poll() is None,'capacityBefore':before,'minimumObserved':minimum,'claim':'One node process, no child tests/services/database/provider. Scripted SQL and synthetic session/Temporal ports only. Existing installed dependencies resolved read-only.'}
(folder/(label+'.receipt.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));print((folder/(label+'.tap')).read_text(errors='replace')[-6000:]);print((folder/(label+'.stderr')).read_text(errors='replace')[-2500:])
raise SystemExit(p.returncode or (1 if stop else 0))
