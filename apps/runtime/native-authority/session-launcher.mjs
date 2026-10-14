/** Trusted supervisor one-use SDK spawn binding; retain registration outside worker. */
import {spawn} from 'node:child_process';
import {openSync,closeSync,fstatSync,readFileSync,realpathSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {compileNativeLaunch,matchNativeLaunch,launchFault} from './launch-configuration.mjs';
import {ownNativeProcess} from './process-lifetime.mjs';
import {createNativeSessionRegistration} from './session-registration.mjs';

function verifyPaths(c){
 for(const name of [c.workspace,c.configDirectory]){const stat=lstatSync(name);if(!stat.isDirectory()||stat.isSymbolicLink()||realpathSync(name)!==name)throw launchFault('PATH');}
 if(realpathSync(c.launch.command)!==c.launch.command)throw launchFault('EXECUTABLE');
 let fd;try{fd=openSync(c.launch.command,'r');const stat=fstatSync(fd);
  if(!stat.isFile()||!(stat.mode&0o111)||stat.size<1||stat.size>268435456||createHash('sha256').update(readFileSync(fd)).digest('hex')!==c.executableSha256)throw launchFault('EXECUTABLE');
 }finally{if(fd!==undefined)closeSync(fd);}
 // Deployment must make the executable immutable through spawn; this readback
 // is a local pin, not image attestation or filesystem isolation.
}
export function createNativeSessionLauncher(configuration){
 const c=compileNativeLaunch(configuration);let used=false,closed=false,observer,owner,child,source,transport,spawnSignal;
 const cancelSpawn=()=>{void owner?.stop('SDK_CANCELLED');};
 const clear=()=>{closed=true;observer?.close();spawnSignal?.removeEventListener('abort',cancelSpawn);transport?.destroy();source?.resume();};
 const registration=Object.freeze({read(value){if(!observer||closed)throw launchFault('UNAVAILABLE');return observer.registration.read(value);}});
 function spawnClaudeCodeProcess(request){
  if(!c.enabled||closed||used||process.platform!=='linux')throw launchFault('UNAVAILABLE');
  spawnSignal=matchNativeLaunch(request,c);const current=c.now();
  if(c.signal?.aborted||spawnSignal?.aborted||!Number.isSafeInteger(current)||current<c.startedAtMs||current>=c.expiresAtMs)throw launchFault('STOPPED');
  try{verifyPaths(c);}catch{throw launchFault('PREFLIGHT');}
  const checked=c.now();
  if(c.signal?.aborted||spawnSignal?.aborted||!Number.isSafeInteger(checked)||checked<current||checked>=c.expiresAtMs)throw launchFault('STOPPED');
  used=true;
  child=spawn(c.launch.command,c.launch.args,{cwd:c.workspace,env:{...c.launch.env},stdio:['pipe','pipe','pipe'],detached:true});
  source=child.stdout;
  // Attach lifetime first: even observer initialization failure owns retirement.
  owner=ownNativeProcess(child,{...c,onStop:clear});
  try{
   if(closed)throw launchFault('STOPPED');
   observer=createNativeSessionRegistration({binding:c.binding,child,workspace:c.workspace,configDirectory:c.configDirectory,
    versions:c.versions,expiresAtMs:c.expiresAtMs,enabled:true,now:c.now,signal:c.signal,limits:c.limits});
   // Expose a readable facade, never the writable Transform witness tap.
   transport=Readable.from(observer.stdout,{objectMode:false});transport.on('error',()=>{void owner.stop('STREAM_ERROR');});
   observer.stdout.on('error',()=>{void owner.stop('STREAM_ERROR');});
   child.stdout=transport;child.stdio[1]=transport;
   spawnSignal?.addEventListener('abort',cancelSpawn,{once:true});
   if(c.signal?.aborted||spawnSignal?.aborted)cancelSpawn();
   return child;
  }catch(error){clear();void owner.stop('INITIALIZATION');throw launchFault('INITIALIZATION');}
 }
 return Object.freeze({registration,spawnClaudeCodeProcess,
  async close(){clear();return owner?owner.close():Object.freeze({physicalStopProven:false,closed:true,allocated:false});},
  completion:()=>owner?.completion??Promise.resolve({physicalStopProven:false,closed,allocated:false}),
  status:()=>Object.freeze({used,closed,observer:observer?.status()??null,process:owner?.status()??null})});
}
