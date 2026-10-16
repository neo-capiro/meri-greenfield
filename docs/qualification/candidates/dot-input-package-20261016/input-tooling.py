"""One conditional offline input-contract sequence, with native Windows memory/owned-process observations."""
import ctypes, hashlib, json, os, pathlib, subprocess, sys, time
from ctypes import wintypes as W
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT/'meri-greenfield'; CWD=REPO/'packages/contracts'; OUT=ROOT/'input-tooling'
PROFILE=json.loads((ROOT/'input-tooling-profile.json').read_text(encoding='utf-8-sig'))
K=ctypes.WinDLL('kernel32',use_last_error=True); P=ctypes.WinDLL('psapi',use_last_error=True)
class Memory(ctypes.Structure):
    _fields_=[('length',W.DWORD),('load',W.DWORD)]+[(n,ctypes.c_ulonglong) for n in ('physicalTotal','physicalAvailable','commitTotal','commitAvailable','virtualTotal','virtualAvailable','extended')]
class Entry(ctypes.Structure):
    _fields_=[('size',W.DWORD),('usage',W.DWORD),('pid',W.DWORD),('heap',ctypes.c_size_t),('module',W.DWORD),('threads',W.DWORD),('ppid',W.DWORD),('priority',W.LONG),('flags',W.DWORD),('name',W.WCHAR*260)]
class Counters(ctypes.Structure):
    _fields_=[('size',W.DWORD),('faults',W.DWORD)]+[(n,ctypes.c_size_t) for n in ('peak','rss','ppq','pq','pnp','np','page','peakpage')]
K.CreateToolhelp32Snapshot.restype=W.HANDLE;K.CreateToolhelp32Snapshot.argtypes=[W.DWORD,W.DWORD]
K.Process32FirstW.argtypes=[W.HANDLE,ctypes.POINTER(Entry)];K.Process32NextW.argtypes=K.Process32FirstW.argtypes
K.OpenProcess.restype=W.HANDLE;K.OpenProcess.argtypes=[W.DWORD,W.BOOL,W.DWORD];K.CloseHandle.argtypes=[W.HANDLE]
K.GetProcessTimes.argtypes=[W.HANDLE,*([ctypes.POINTER(W.FILETIME)]*4)]
P.GetProcessMemoryInfo.argtypes=[W.HANDLE,ctypes.POINTER(Counters),W.DWORD]
K.TerminateProcess.argtypes=[W.HANDLE,W.UINT]
def memory():
    m=Memory();m.length=ctypes.sizeof(m)
    if not K.GlobalMemoryStatusEx(ctypes.byref(m)):raise ctypes.WinError()
    return {n:getattr(m,n) for n in ('physicalTotal','physicalAvailable','commitTotal','commitAvailable')}
def processes():
    h=K.CreateToolhelp32Snapshot(2,0)
    if h==W.HANDLE(-1).value:raise ctypes.WinError()
    result={};e=Entry();e.size=ctypes.sizeof(e)
    try:
        more=K.Process32FirstW(h,ctypes.byref(e))
        while more:
            result[e.pid]={'pid':e.pid,'parent':e.ppid,'name':e.name};more=K.Process32NextW(h,ctypes.byref(e))
    finally:K.CloseHandle(h)
    return result
def observe(pid):
    h=K.OpenProcess(0x1000|0x10,False,pid)
    if not h:return None
    try:
        times=[W.FILETIME() for _ in range(4)]
        if not K.GetProcessTimes(h,*map(ctypes.byref,times)):return None
        created=(times[0].dwHighDateTime<<32)|times[0].dwLowDateTime
        c=Counters();c.size=ctypes.sizeof(c)
        rss=c.rss if P.GetProcessMemoryInfo(h,ctypes.byref(c),c.size) else None
        return {'created':created,'rss':rss}
    finally:K.CloseHandle(h)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def rows():return {p:digest(REPO/p) for p in PROFILE['preserved']}
def save(path,obj):path.write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')
def main():
    source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
    if source!=PROFILE['source']:raise RuntimeError('Unexpected exact source')
    if len(list((CWD/'dist').iterdir()))!=26:raise RuntimeError('Expected exactly26 existing artifacts before generation')
    OUT.mkdir(exist_ok=True);(ROOT/'input-package').mkdir(exist_ok=True);baseline=rows();save(OUT/'preserved-inputs.json',baseline)
    for stage in PROFILE['stages']:
        health=memory()
        if health['commitAvailable']<stage['reserveBytes']+1073741824:raise RuntimeError('Insufficient normal fresh commit margin')
        name=stage['name'];print('START '+name+' '+json.dumps(health),flush=True);known={};peak=0;reason=None
        with (OUT/(name+'.stdout.txt')).open('wb') as stdout,(OUT/(name+'.stderr.txt')).open('wb') as stderr:
            start=time.monotonic();proc=subprocess.Popen([PROFILE['node'],*stage['argv']],cwd=CWD,stdout=stdout,stderr=stderr,creationflags=subprocess.CREATE_NO_WINDOW)
            while True:
                allp=processes();owned={proc.pid};changed=True
                while changed:
                    changed=False
                    for pid,p in allp.items():
                        if p['parent'] in owned and pid not in owned:owned.add(pid);changed=True
                rss=0
                for pid in owned:
                    o=observe(pid)
                    if o:
                        known.setdefault(pid,{**allp.get(pid,{'pid':pid}),**o});rss+=o['rss'] or 0
                peak=max(peak,rss)
                if proc.poll() is not None:break
                if time.monotonic()-start>=stage['hardSeconds']:reason='timeout'
                if rss>stage['reserveBytes'] or memory()['commitAvailable']<1073741824:reason='pressure'
                if reason:
                    subprocess.run(['taskkill.exe','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10,creationflags=subprocess.CREATE_NO_WINDOW);proc.wait(timeout=10);break
                time.sleep(.05)
            code=proc.wait();cleanup=0;remaining=[]
            for pid,info in known.items():
                if pid==proc.pid:continue
                observed=observe(pid)
                if observed and observed['created']==info['created']:
                    for _ in range(20):
                        time.sleep(.05);observed=observe(pid)
                        if not observed or observed['created']!=info['created']:break
                    else:
                        h=K.OpenProcess(1|0x1000,False,pid)
                        if h:
                            try:K.TerminateProcess(h,1)
                            finally:K.CloseHandle(h)
                        cleanup=1;remaining.append(pid)
        same=rows()==baseline
        receipt={'source':source,'name':name,'argv':stage['argv'],'hardSeconds':stage['hardSeconds'],'memoryBefore':health,'primaryExit':code,'cleanupExit':cleanup,'reason':reason,'wallMs':round((time.monotonic()-start)*1000),'sampledOwnedTreeRssBytes':peak,'ownedPrimaryPid':proc.pid,'ownedExited':proc.poll() is not None,'observedOwnedProcesses':list(known.values()),'residualPids':remaining,'preservedBytes':same}
        save(OUT/(name+'.json'),receipt);print('TERMINAL '+json.dumps(receipt),flush=True)
        if code or cleanup or reason or not same:raise RuntimeError('Conditional sequence stopped: '+name)
    print('SEQUENCE_PASS',flush=True)
if __name__=='__main__':main()
