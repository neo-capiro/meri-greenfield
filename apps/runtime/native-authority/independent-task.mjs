/** One original task, actual separate supervisor process, byte-only SDK worker transport. */
import {fork} from 'node:child_process';import {EventEmitter} from 'node:events';import {Readable} from 'node:stream';
import {readFileSync,readlinkSync} from 'node:fs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {compileNativeLaunch,matchNativeLaunch} from './launch-configuration.mjs';
import {verifyNativeLaunchPaths} from './session-launcher.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {executionFault} from './execution-broker.mjs';
export function createIndependentNativeTask(configuration){
 const c=own(configuration,['original','launchConfiguration'],['now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,original=data(c.original),p=compileNativeLaunch(c.launchConfiguration);
 if(hash(original.binding)!==hash(p.binding)||original.expiresAtMs!==p.expiresAtMs||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw executionFault('TASK_CONFIGURATION');
 const compiled={binding:p.binding,workspace:p.workspace,configDirectory:p.configDirectory,versions:p.versions,expiresAtMs:p.expiresAtMs,executableSha256:p.executableSha256,launch:p.launch,enabled:p.enabled,shutdownMs:p.shutdownMs,limits:p.limits};
 let supervisor,nativeBirth,booted=false,launched=false,retiring=false,closed=false,stopped=false,nextId=0,exitCode=null,signalCode=null,timer;const events=new EventEmitter(),pending=new Map();events.on('error',()=>{});
 const completion=Promise.withResolvers(),ready=Promise.withResolvers();ready.promise.catch(()=>{});
 function absent(){if(!supervisor?.pid)return false;try{process.kill(-supervisor.pid,0);return false;}catch(e){return e.code==='ESRCH';}}
 function nativeAbsent(){if(!nativeBirth)return true;try{process.kill(-nativeBirth.pid,0);return false;}catch(e){return e.code==='ESRCH';}}
 function birth(pid){if(!Number.isSafeInteger(pid)||pid<2)throw executionFault('TASK_REFUSED');const stat=readFileSync('/proc/'+pid+'/stat','utf8'),parts=stat.slice(stat.lastIndexOf(')')+2).split(' ');return {pid,parent:Number(parts[1]),group:Number(parts[2]),started:parts[19],executable:readlinkSync('/proc/'+pid+'/exe')};}
 function pinNative(pid){const fact=birth(pid);if(fact.parent!==supervisor.pid||fact.group!==pid||fact.executable!==p.launch.command||nativeBirth&&(nativeBirth.pid!==pid||nativeBirth.started!==fact.started))throw executionFault('TASK_REFUSED');nativeBirth=fact;}
 function send(value){if(!supervisor?.connected)throw executionFault('TASK_UNAVAILABLE');supervisor.send(value);}
 async function bounded(signal,body){const life=createOperationLifetime({now,signal,deadlineMs:now()+maxRequestMs,errorFactory:()=>executionFault('TASK_UNAVAILABLE')});try{return await life.run(body);}finally{life.close();}}
 async function rpc(type,request,signal){nativeSignal(signal);if(closed||!booted||retiring||pending.size>=32)throw executionFault('TASK_UNAVAILABLE');const id=++nextId,reply=Promise.withResolvers();pending.set(id,reply);
  try{return await bounded(signal,()=>{send({type,id,...(request?{request}:{})});return reply.promise;});}finally{pending.delete(id);}}
 function tuple(value){const v=own(value,['binding','executionKey','executionId','planSha256','expiresAtMs','versions'],['signal','plan']);nativeSignal(v.signal);
  if(hash({binding:v.binding,executionKey:v.executionKey,executionId:v.executionId,planSha256:v.planSha256,expiresAtMs:v.expiresAtMs,versions:v.versions})!==hash(original))throw executionFault('TASK_REFUSED');return v;}
 const receipt=()=>data({binding:original.binding,executionId:original.executionId,planSha256:original.planSha256,expiresAtMs:original.expiresAtMs,versions:original.versions,taskId:String(supervisor.pid),state:stopped?'stopped':'executing',physicalStopProven:stopped});
 async function launch(value){const input=tuple(value);if(supervisor||closed||!p.enabled||now()>=p.expiresAtMs||input.signal?.aborted)throw executionFault('TASK_REFUSED');
  supervisor=fork(new URL('./supervisor-process.mjs',import.meta.url),[],{env:{},stdio:['ignore','ignore','pipe','ipc','pipe','pipe'],detached:true});supervisor.stderr.resume();
  const failed=()=>{ready.reject(executionFault('TASK_UNAVAILABLE'));for(const r of pending.values())r.reject(executionFault('TASK_UNAVAILABLE'));void close().catch(()=>{});};
  supervisor.on('error',failed);supervisor.once('disconnect',()=>{if(!retiring)failed();});supervisor.stdio[4].on('error',failed);supervisor.stdio[5].on('error',failed);
  supervisor.on('message',message=>{
   if(message.type==='ready'){booted=true;ready.resolve();}
   if(message.type==='launched'){try{pinNative(message.pid);}catch{events.emit('error',executionFault('TASK_REFUSED'));void close().catch(()=>{});}}
   if(message.type==='exit'){exitCode=message.code;signalCode=message.signal;events.emit('exit',exitCode,signalCode);}
   if(message.type==='stopped')stopped=message.status?.process===null||message.status?.process?.physicalStopProven===true;
   if(message.type==='reply')pending.get(message.id)?.resolve(message.value);
   if(message.type==='refused'){pending.get(message.id)?.reject(executionFault('TASK_REFUSED'));if(!booted)ready.reject(executionFault('TASK_REFUSED'));events.emit('error',executionFault('TASK_REFUSED'));}
  });
  supervisor.once('close',()=>{closed=true;clearTimeout(timer);const clean=stopped&&absent()&&nativeAbsent();stopped=clean;ready.reject(executionFault('TASK_STOPPED'));for(const r of pending.values())r.reject(executionFault('TASK_STOPPED'));completion.resolve(clean);});
  send({type:'boot',configuration:compiled});timer=setTimeout(()=>{void close().catch(()=>{});},Math.max(1,p.expiresAtMs-now()));
  try{await bounded(input.signal,()=>ready.promise);return receipt();}catch{await close();throw executionFault('TASK_UNAVAILABLE');}
 }
 function spawnClaudeCodeProcess(value){if(!booted||closed||retiring||launched||now()>=p.expiresAtMs)throw executionFault('TASK_REFUSED');const signal=matchNativeLaunch(value,p);if(signal?.aborted)throw executionFault('TASK_REFUSED');launched=true;
  const cancel=()=>{void close().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});completion.promise.finally(()=>signal?.removeEventListener('abort',cancel));send({type:'launch'});
  const stdout=Readable.from(supervisor.stdio[4],{objectMode:false});return Object.freeze({stdin:supervisor.stdio[5],stdout,get killed(){return retiring;},get exitCode(){return exitCode;},get signalCode(){return signalCode;},kill(){void close().catch(()=>{});return true;},on:(event,fn)=>events.on(event,fn),once:(event,fn)=>events.once(event,fn),off:(event,fn)=>events.off(event,fn)});
 }
 async function close(){if(!supervisor)return;if(!retiring){retiring=true;try{send({type:'stop'});}catch{}supervisor.stdio[4].resume();supervisor.stdio[5].end();}
  const graceful=await bounded(undefined,()=>completion.promise).catch(()=>false);if(!graceful){
   // Only a kernel-pinned original native leader may receive fallback containment.
   if(nativeBirth)try{const actual=birth(nativeBirth.pid);if(actual.started===nativeBirth.started&&actual.group===nativeBirth.group&&actual.executable===nativeBirth.executable)process.kill(-nativeBirth.pid,'SIGKILL');}catch{}
   if(!closed)try{process.kill(-supervisor.pid,'SIGKILL');}catch{}await bounded(undefined,()=>completion.promise).catch(()=>false);}
  if(!stopped||!closed||!absent()||!nativeAbsent())throw executionFault('TASK_CLEANUP_UNKNOWN');}
 async function inspect(value){const input=tuple(value);if(!supervisor||!booted)await bounded(input.signal,()=>ready.promise);if(closed){if(!stopped)throw executionFault('TASK_CLEANUP_UNKNOWN');return receipt();}
  const observed=await rpc('inspect',undefined,input.signal);if(observed.status?.process?.closed){await close();return receipt();}
  if(launched){if(!nativeBirth||observed.pid!==nativeBirth.pid)throw executionFault('TASK_UNAVAILABLE');const actual=birth(nativeBirth.pid);if(actual.started!==nativeBirth.started||actual.group!==nativeBirth.group||actual.executable!==nativeBirth.executable)throw executionFault('TASK_UNAVAILABLE');}
  if(!supervisor.pid||absent())throw executionFault('TASK_UNAVAILABLE');return receipt();}
 async function retire(value){tuple(value);await close();if(!supervisor)throw executionFault('TASK_NOT_FOUND');return receipt();}
 async function readiness({signal}={}){nativeSignal(signal);if(signal?.aborted||closed||retiring||!p.enabled||now()>=p.expiresAtMs)throw executionFault('TASK_UNAVAILABLE');verifyNativeLaunchPaths(p);if(signal?.aborted||now()>=p.expiresAtMs)throw executionFault('TASK_UNAVAILABLE');}
 return Object.freeze({launch,inspect,retire,readiness,spawnClaudeCodeProcess,registration:Object.freeze({read:value=>{const v=own(value,['binding','key'],['signal','deadlineMs']);return rpc('read',{binding:v.binding,key:v.key,...(v.deadlineMs?{deadlineMs:v.deadlineMs}:{})},v.signal);}}),close,
  status:()=>Object.freeze({supervisorPid:supervisor?.pid??null,nativePid:nativeBirth?.pid??null,booted,launched,closed,physicalStopProven:stopped&&closed&&absent()&&nativeAbsent()})});
}
