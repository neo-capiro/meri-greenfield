/** Local SDK process execution: the SDK spawn hook receives a deferred facade over this runner's own prepared task.
 * Prepare, the one-use start claim, started and stop stay control's run commands (through the receiver's authority
 * calls); the bytes stay on local pipes; a bounded lease recheck replaces the forwarded path's per-frame verification. */
import {EventEmitter} from 'node:events';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createDeferredProcessTransport} from './deferred-process-transport.mjs';
import {descriptor,transportLimits,remoteFault} from './remote-task-boundary.mjs';
import {captureRunnerFailure} from '../runner-runtime-diagnostics.mjs';

export const LOCAL_EXECUTION_LEASE_MS=5000;

export function createLocalSdkProcessClient(configuration){
 const c=own(configuration,['task'],['leaseMs','limits']),leaseMs=c.leaseMs??LOCAL_EXECUTION_LEASE_MS,limits=transportLimits(c.limits);
 const prepare=storageMethod(c.task,'prepare'),start=storageMethod(c.task,'start'),verify=storageMethod(c.task,'verify'),processOf=storageMethod(c.task,'process'),stop=storageMethod(c.task,'stop');
 if(!Number.isSafeInteger(leaseMs)||leaseMs<100||leaseMs>30000)throw remoteFault();
 const events=new EventEmitter();events.on('error',()=>{});
 let requested,started=false,closed=false,closing,spawnSignal,lease,leaseBusy=false,exit,stdoutEnded=false,exitEmitted=false;
 const emitExit=()=>{if(exitEmitted)return;exitEmitted=true;clearInterval(lease);events.emit('exit',exit?.code??null,exit?.signal??null);};
 const fail=async error=>{if(closed)return;try{await close();}catch{return;}events.emit('error',error);};
 // Bytes the SDK writes before the start acknowledgement (its initialize request) stay bounded here until attach.
 const deferred=createDeferredProcessTransport({maxBytes:limits.maxBufferedBytes,onError:error=>{void fail(error);}});
 // Natural completion needs both the process exit and the end of its stdout, as on the forwarded path.
 deferred.stdout.on('end',()=>{stdoutEnded=true;if(exit)emitExit();});
 async function close(){
  if(closing)return closing;closed=true;clearInterval(lease);
  closing=(async()=>{const result=await stop();const receipt=result.receipt;
   if(receipt?.physicalStopProven!==true&&!(receipt?.physicalStopProven===false&&receipt.notAllocated===true&&Object.keys(receipt).length===2))throw remoteFault();
   deferred.close();emitExit();})();
  closing.catch(()=>{});return closing;
 }
 function attach(port){
  port.on('exit',(code,signal)=>{exit={code,signal};if(stdoutEnded)emitExit();});
  port.on('error',error=>{void fail(error);});
  deferred.attach({stdin:port.stdin,stdout:port.stdout});
  lease=setInterval(()=>{if(leaseBusy||closed)return;leaseBusy=true;verify({}).then(()=>{leaseBusy=false;},error=>{leaseBusy=false;void fail(error);});},leaseMs);lease.unref?.();
 }
 function spawnClaudeCodeProcess(value){
  if(requested||closed)throw remoteFault();const raw=own(value,['command','args','cwd','env'],['signal']);nativeSignal(raw.signal);if(raw.signal?.aborted)throw remoteFault();
  requested=descriptor({command:raw.command,args:raw.args,cwd:raw.cwd,env:raw.env});spawnSignal=raw.signal;raw.signal?.addEventListener('abort',()=>{void close().catch(()=>{});},{once:true});
  return Object.freeze({stdin:deferred.stdin,stdout:deferred.stdout,get killed(){return closed;},get exitCode(){return exit?.code??null;},get signalCode(){return exit?.signal??null;},
   kill(){void close().catch(()=>{});return true;},on:(...args)=>events.on(...args),once:(...args)=>events.once(...args),off:(...args)=>events.off(...args)});
 }
 async function startPreparedProcess(){
  if(!requested||started||closed||spawnSignal?.aborted)throw remoteFault();started=true;let origin='native-prepare';
  try{
   const prepared=await prepare({descriptor:requested,signal:spawnSignal});if(closed||spawnSignal?.aborted||prepared.descriptorSha256!==hash(requested))throw remoteFault();
   origin='native-start';const response=await start({descriptorSha256:prepared.descriptorSha256,signal:spawnSignal});
   if(closed||spawnSignal?.aborted||response.descriptorSha256!==prepared.descriptorSha256)throw remoteFault();attach(processOf());
  }catch(error){if(!closed&&!spawnSignal?.aborted)captureRunnerFailure(error,origin);try{await close();}catch{}throw error;}
 }
 return Object.freeze({spawnClaudeCodeProcess,startPreparedProcess,close,status:()=>({requested:!!requested,started,closed})});
}
