import ctypes,datetime,hashlib,json,subprocess,time
from ctypes import wintypes as w
from pathlib import Path
root=Path(__file__).parent/'meri-qualification'
folder=root/'audit-evidence/accepted-followup-closure';folder.mkdir(exist_ok=True)
expected='03def1608c1f5365524502592fa8885283c69215'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==expected
class Memory(ctypes.Structure):
 _fields_=[('length',w.DWORD),('load',w.DWORD)]+[(n,ctypes.c_ulonglong)for n in ['totalPhysical','availablePhysical','totalPageFile','availablePageFile','totalVirtual','availableVirtual','availableExtendedVirtual']]
class Entry(ctypes.Structure):
 _fields_=[('dwSize',w.DWORD),('cntUsage',w.DWORD),('th32ProcessID',w.DWORD),('th32DefaultHeapID',ctypes.c_size_t),('th32ModuleID',w.DWORD),('cntThreads',w.DWORD),('th32ParentProcessID',w.DWORD),('pcPriClassBase',w.LONG),('dwFlags',w.DWORD),('szExeFile',w.WCHAR*260)]
class Counters(ctypes.Structure):
 _fields_=[('cb',w.DWORD),('PageFaultCount',w.DWORD)]+[(n,ctypes.c_size_t)for n in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage','PrivateUsage']]
k=ctypes.WinDLL('kernel32',use_last_error=True);ps=ctypes.WinDLL('psapi',use_last_error=True)
k.CreateToolhelp32Snapshot.argtypes=[w.DWORD,w.DWORD];k.CreateToolhelp32Snapshot.restype=w.HANDLE
k.Process32FirstW.argtypes=[w.HANDLE,ctypes.POINTER(Entry)];k.Process32NextW.argtypes=k.Process32FirstW.argtypes
k.CloseHandle.argtypes=[w.HANDLE];k.OpenProcess.argtypes=[w.DWORD,w.BOOL,w.DWORD];k.OpenProcess.restype=w.HANDLE
ps.GetProcessMemoryInfo.argtypes=[w.HANDLE,ctypes.POINTER(Counters),w.DWORD]
def at():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def memory():
 m=Memory();m.length=ctypes.sizeof(m)
 if not k.GlobalMemoryStatusEx(ctypes.byref(m)):raise OSError(ctypes.get_last_error())
 return {'at':at(),'commit':m.availablePageFile,'physical':m.availablePhysical}
def children(pid):
 snap=k.CreateToolhelp32Snapshot(2,0)
 if snap==ctypes.c_void_p(-1).value:raise OSError(ctypes.get_last_error())
 entries=[];e=Entry();e.dwSize=ctypes.sizeof(e)
 try:
  ok=k.Process32FirstW(snap,ctypes.byref(e))
  while ok:
   entries.append((e.th32ProcessID,e.th32ParentProcessID,e.szExeFile));ok=k.Process32NextW(snap,ctypes.byref(e))
 finally:k.CloseHandle(snap)
 owned={pid};result=[]
 for _ in range(32):
  added=[r for r in entries if r[1] in owned and r[0] not in owned]
  if not added:break
  for row in added:owned.add(row[0]);result.append({'pid':row[0],'parentPid':row[1],'image':row[2]})
 return result
def rss(pid):
 h=k.OpenProcess(0x410,False,pid)
 if not h:return None
 try:
  c=Counters();c.cb=ctypes.sizeof(c)
  return c.WorkingSetSize if ps.GetProcessMemoryInfo(h,ctypes.byref(c),c.cb) else None
 finally:k.CloseHandle(h)
before=memory()
if min(before['commit'],before['physical'])<1342177280:
 (folder/'HELD.json').write_text(json.dumps({'status':'HELD_BEFORE_LAUNCH','memory':before,'minimum':1342177280},indent=2)+'\n');raise SystemExit('capacity hold before launch')
files=['apps/control/conversations/test/initial-input.test.mjs','apps/control/conversations/test/store.test.mjs','apps/gateway/sources/bill-text/test/handler.test.mjs','apps/worker/conversation/reads/test/bill-text.test.mjs','scripts/scope-ledger/source-exposure.test.mjs','apps/runtime/artifacts/test/recovery-composition.test.mjs','apps/runtime/test/input-admission-mount.test.mjs','audit-evidence/combined-loading.test.mjs']
argv=['C:/Program Files/nodejs/node.exe','--max-old-space-size=128','--import','./audit-evidence/dependency-reuse.mjs','--test','--test-isolation=none','--test-concurrency=1','--test-timeout=15000','--test-reporter=tap',*files]
start=at();clock=time.monotonic();minimum=before['commit'];peak=None;seen=[];reason=None;monitor_error=None
with(folder/'closure.tap').open('wb')as out,(folder/'closure.stderr').open('wb')as err:
 p=subprocess.Popen(argv,cwd=root,stdout=out,stderr=err)
 while p.poll()is None:
  try:
   m=memory();minimum=min(minimum,m['commit']);observed=rss(p.pid)
   if observed is not None:peak=max(peak or 0,observed)
   current=children(p.pid)
   if current:seen.extend(current);reason='UNEXPECTED_CHILD'
   if m['commit']<1073741824:reason='COMMIT_PRESSURE'
   if time.monotonic()-clock>60:reason='HARD_WALL'
  except Exception as e:reason='MONITOR_FAILURE';monitor_error=str(e)
  if reason:
   if seen:subprocess.run(['taskkill','/PID',str(p.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
   else:p.kill()
   p.wait(timeout=5);break
  time.sleep(.05)
 p.wait(timeout=5)
left=children(p.pid)
receipt={'source':expected,'argv':argv,'pid':p.pid,'startedAt':start,'finishedAt':at(),'wallMs':round((time.monotonic()-clock)*1000,3),'primaryExit':p.returncode,'cleanupExit':0 if not left else 1,'ownedProcessRemains':False,'remainingChildren':left,'observedChildren':seen,'stopReason':reason,'monitorError':monitor_error,'heapMiB':128,'hardWallSeconds':60,'memoryBefore':before,'minimumAvailableCommit':minimum,'sampledPeakWorkingSet':peak,'classification':'Focused coherent accepted follow-up controls: original-input store CAS and legacy accept, bill-text canonical adapter/durable scripted SQL/worker schemas, current source-exposure ledger, same-exclusion recovery and actual input mount. Actual counts are in TAP. Scripted SQL/SDK/identity/Temporal replies; actual canonical product source, third-party packages reused read-only. No real socket/DB/provider/material or installed-image qualification.'}
for name in ['closure.tap','closure.stderr']:
 payload=(folder/name).read_bytes();receipt[name+'Sha256']=hashlib.sha256(payload).hexdigest()
(folder/'closure.receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',newline='\n')
print(json.dumps(receipt));print((folder/'closure.tap').read_text(errors='replace')[-5000:]);print((folder/'closure.stderr').read_text(errors='replace')[-2000:])
assert p.returncode==0 and not left and reason is None
