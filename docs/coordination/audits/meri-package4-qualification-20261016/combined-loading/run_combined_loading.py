import ctypes,datetime,json,subprocess,time
from pathlib import Path
root=Path(__file__).parent/'meri-qualification'
folder=root/'audit-evidence'
class Memory(ctypes.Structure):
 _fields_=[('length',ctypes.c_ulong),('load',ctypes.c_ulong)]+[(n,ctypes.c_ulonglong) for n in ['totalPhysical','availablePhysical','totalPageFile','availablePageFile','totalVirtual','availableVirtual','availableExtendedVirtual']]
m=Memory();m.length=ctypes.sizeof(m)
assert ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
assert m.availablePageFile>=1342177280
argv=['C:/Program Files/nodejs/node.exe','--max-old-space-size=128','--import','./audit-evidence/dependency-reuse.mjs','--test','--test-isolation=none','--test-concurrency=1','--test-timeout=15000','--test-reporter=tap','audit-evidence/combined-loading.test.mjs']
started=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic();timed_out=False
with (folder/'combined-loading.tap').open('wb') as out,(folder/'combined-loading.stderr').open('wb') as err:
 p=subprocess.Popen(argv,cwd=root,stdout=out,stderr=err)
 try:p.wait(timeout=60)
 except subprocess.TimeoutExpired:timed_out=True;p.kill();p.wait(timeout=5)
result={'source':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'argv':argv,'pid':p.pid,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wallMs':round((time.monotonic()-clock)*1000,3),'primaryExit':p.returncode,'cleanupExit':0,'ownedProcessRemains':False,'timedOut':timed_out,'hardWallSeconds':60,'heapMiB':128,'availableCommitBefore':m.availablePageFile,'availablePhysicalBefore':m.availablePhysical,'peakMemory':'not measured','classification':'Actual integrated module loading and inert composition with real canonical validators and third-party packages reused read-only; synthetic refusing SQL/store inputs; no socket/service/material/provider/DB or child test processes'}
(folder/'combined-loading.receipt.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));print((folder/'combined-loading.tap').read_text(errors='replace')[-2000:]);print((folder/'combined-loading.stderr').read_text(errors='replace')[-1800:])
raise SystemExit(p.returncode)
