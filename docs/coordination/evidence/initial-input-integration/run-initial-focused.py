import ctypes, datetime, hashlib, json, subprocess, sys, time
from pathlib import Path
root=Path(__file__).parent/'meri-initial-input-integration'
folder=root/'docs/coordination/evidence/initial-input-integration'
folder.mkdir(parents=True,exist_ok=True)
class Memory(ctypes.Structure):
 _fields_=[('length',ctypes.c_ulong),('load',ctypes.c_ulong)]+[(n,ctypes.c_ulonglong) for n in ['totalPhysical','availablePhysical','totalPageFile','availablePageFile','totalVirtual','availableVirtual','availableExtendedVirtual']]
class Counters(ctypes.Structure):
 _fields_=[('cb',ctypes.c_ulong),('PageFaultCount',ctypes.c_ulong)]+[(n,ctypes.c_size_t) for n in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage']]
def capacity():
 m=Memory();m.length=ctypes.sizeof(m)
 if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):raise RuntimeError('Normal capacity observation unavailable; no probe retry')
 return {'availableCommit':m.availablePageFile,'availablePhysical':m.availablePhysical}
def rss(p):
 m=Counters();m.cb=ctypes.sizeof(m)
 if not ctypes.windll.psapi.GetProcessMemoryInfo(ctypes.c_void_p(int(p._handle)),ctypes.byref(m),m.cb):raise RuntimeError('Normal process observation unavailable; no probe retry')
 return m.WorkingSetSize
before=capacity()
if before['availableCommit']<1342177280:raise SystemExit('Capacity below existing 1280MiB start threshold; no test launched')
label=sys.argv[1];tests=sys.argv[2:]
argv=['C:/Program Files/nodejs/node.exe','--max-old-space-size=128','--import','../dependency-reuse.mjs','--test','--test-isolation=none','--test-concurrency=1','--test-timeout=15000','--test-reporter=tap',*tests]
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();tracked=subprocess.check_output(['git','status','--short'],cwd=root,text=True)
paths=['apps/control/conversations/service.mjs','apps/control/conversations/initial-input/http.mjs','apps/control/conversations/postgres-store.mjs','apps/control/conversations/initial-input-facts.mjs','apps/control/conversations/initial-input-journal.mjs',*tests,*[p.relative_to(root).as_posix() for p in (root/'packages/contracts/conversation-initial-input').glob('*.mjs')]]
hashes={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths}
start=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic();stop=None;minimum=dict(before);peak=0;observationFailure=None
with (folder/(label+'.tap')).open('wb') as out,(folder/(label+'.stderr')).open('wb') as err:
 p=subprocess.Popen(argv,cwd=root,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
 try:
  while p.poll() is None:
   current=capacity();minimum={k:min(minimum[k],current[k]) for k in minimum};peak=max(peak,rss(p))
   if time.monotonic()-clock>=120:stop='HARD_WALL_120S'
   if current['availableCommit']<536870912:stop='ACTUAL_COMMIT_PRESSURE'
   if peak>268435456:stop='WORKING_SET_256MIB'
   if stop:p.kill();p.wait(timeout=5);break
   time.sleep(.1)
 except Exception as e:
  observationFailure=str(e);stop='OBSERVATION_FAILURE'
 finally:
  if p.poll() is None:p.kill();p.wait(timeout=5)
result={'sourceBase':source,'worktreeStatusBefore':tracked,'sourceSha256':hashes,'argv':argv,'pid':p.pid,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wallMs':round((time.monotonic()-clock)*1000,3),'exit':p.returncode,'stopReason':stop,'observationFailure':observationFailure,'hardWallSeconds':120,'heapMiB':128,'sampledPeakWorkingSet':peak,'workingSetStopMiB':256,'ownedProcessRemains':p.poll() is None,'capacityBefore':before,'minimumObserved':minimum,'claim':'One Node process, no child tests/services/database/provider. Scripted SQL/synthetic session and Temporal ports only. Existing installed dependencies resolved read-only. Sampling is observed, not a guaranteed peak.'}
(folder/(label+'.receipt.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));print((folder/(label+'.tap')).read_text(errors='replace')[-8000:]);print((folder/(label+'.stderr')).read_text(errors='replace')[-3500:])
raise SystemExit(p.returncode or (1 if stop else 0))
