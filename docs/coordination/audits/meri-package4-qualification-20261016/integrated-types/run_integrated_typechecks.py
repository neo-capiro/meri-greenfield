import ctypes,datetime,hashlib,json,subprocess,time
from pathlib import Path
root=Path(__file__).parent/'meri-qualification'
peer=Path('C:/Users/neoma/Documents/Codex/2026-10-15/task-4/meri-greenfield')
folder=root/'audit-evidence/integrated-types'
folder.mkdir(exist_ok=True)
node='C:/Program Files/nodejs/node.exe'
tsc=peer/'apps/runtime/node_modules/typescript/bin/tsc'
pin=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def memory():
 class Memory(ctypes.Structure):
  _fields_=[('length',ctypes.c_ulong),('load',ctypes.c_ulong)]+[(n,ctypes.c_ulonglong)for n in ['totalPhysical','availablePhysical','totalPageFile','availablePageFile','totalVirtual','availableVirtual','availableExtendedVirtual']]
 m=Memory();m.length=ctypes.sizeof(m)
 if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):raise OSError('normal memory observation failed')
 return {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'availableCommitBytes':m.availablePageFile,'availablePhysicalBytes':m.availablePhysical}
dependency_roots=[peer/p/'node_modules' for p in ['apps/runtime','apps/control/conversations','apps/worker/conversation','packages/contracts','packages/ui-stream','packages/window-resolution','apps/artifacts/storage','']]
paths={'*':[str(p/'*').replace('\\','/')for p in dependency_roots]}
# NodeNext paths to a package directory do not select its exports/types entry.
# Resolve the actual installed declaration files instead; no ambient stubs.
for row in json.loads((folder/'resolved-root-declarations.json').read_text()):
 paths[row['name']]=[row['declaration'].replace('\\','/')]
for directory in ['contracts','ui-stream','window-resolution']:
 p=root/'packages'/directory;pkg=json.loads((p/'package.json').read_text());exports=pkg['exports']
 if isinstance(exports,str):exports={'.':exports}
 for subpath,value in exports.items():
  target=value if isinstance(value,str)else value.get('types',value.get('import',value.get('default')))
  paths[pkg['name']+(''if subpath=='.'else subpath[1:])]=[str(p/target).replace('\\','/')]
locks=[]
for path in ['package-lock.json','apps/runtime/package-lock.json','apps/control/conversations/package-lock.json','apps/worker/conversation/package-lock.json','packages/ui-stream/package-lock.json']:
 assert sha(root/path)==sha(peer/path),path
 locks.append({'path':path,'sha256':sha(root/path)})
stages=[]
for label,project in [('conversations','apps/control/conversations'),('runtime','apps/runtime')]:
 before=memory()
 if before['availableCommitBytes']<2147483648:
  stages.append({'project':project,'status':'HELD_BEFORE_LAUNCH','reason':'Need1GiB compiler reserve plus1GiB remaining commit','memoryBefore':before});break
 original=root/project/'tsconfig.json'
 overlay=folder/f'tsconfig.{label}.json'
 overlay.write_text(json.dumps({'extends':str(original).replace('\\','/'),'compilerOptions':{'baseUrl':str(root).replace('\\','/'),'paths':paths,'typeRoots':[str(p/'@types').replace('\\','/')for p in dependency_roots if(p/'@types').is_dir()]}},indent=2)+'\n')
 argv=[node,'--max-old-space-size=768',str(tsc),'--noEmit','-p',str(overlay),'--pretty','false','--extendedDiagnostics']
 out=folder/f'{label}.stdout.txt';err=folder/f'{label}.stderr.txt'
 started=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic();timed_out=False;pressure=False;minimum=before['availableCommitBytes']
 with out.open('wb')as stdout,err.open('wb')as stderr:
  p=subprocess.Popen(argv,cwd=root/project,stdout=stdout,stderr=stderr)
  while p.poll()is None:
   sample=memory();minimum=min(minimum,sample['availableCommitBytes'])
   if time.monotonic()-clock>120 or sample['availableCommitBytes']<1073741824:
    timed_out=time.monotonic()-clock>120;pressure=sample['availableCommitBytes']<1073741824;p.kill();p.wait(timeout=5);break
   time.sleep(.1)
 record={'project':project,'source':pin,'argv':argv,'originalTsconfigSha256':sha(original),'dependencyOverlaySha256':sha(overlay),'pid':p.pid,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wallMs':round((time.monotonic()-clock)*1000,3),'primaryExit':p.returncode,'cleanupExit':0,'ownedProcessRemains':False,'timedOut':timed_out,'pressureStop':pressure,'memoryBefore':before,'minimumAvailableCommitBytes':minimum,'peakProcessRss':'not measured','stdoutSha256':sha(out),'stderrSha256':sha(err)}
 stages.append(record);(folder/f'{label}.receipt.json').write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps(record),flush=True)
 lines=out.read_text(errors='replace').splitlines();print('\n'.join(lines[:35]+(['...']if len(lines)>55 else[])+lines[-20:]),flush=True)
 if timed_out or pressure:break
result={'source':pin,'compilerVersion':json.loads((tsc.parent.parent/'package.json').read_text())['version'],'classification':'Real TypeScript compiler over original complete project inputs/strict options; task-local dependency-resolution overlay only, read-only exact-lock third-party dependencies and integrated product public exports. No suppression, emit, install, services/provider/DB/browser or native child. Canonical unmodified CLI with materialized local dependencies is not claimed. Junction creation was denied; not retried or escalated.','verifiedEqualDependencyLocks':locks,'stages':stages}
(folder/'SUMMARY.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'source':pin,'compilerVersion':result['compilerVersion'],'outcomes':[{'project':r['project'],'exit':r.get('primaryExit'),'status':r.get('status','TERMINAL')}for r in stages]}),flush=True)
