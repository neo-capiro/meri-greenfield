/** Own one Linux detached process group. Close alone never proves tree cleanup. */
import {launchFault} from './launch-configuration.mjs';
export function ownNativeProcess(child,{expiresAtMs,now,startedAtMs,shutdownMs,signal,onStop}){
 let closed=false,stopping=false,settled=false,physicalStopProven=false,reason=null,code=null,exitSignal=null;
 let expiryTimer,graceTimer,killTimer,pollTimer,at=startedAtMs;
 const completion=Promise.withResolvers();
 const absent=()=>{if(!Number.isSafeInteger(child.pid)||child.pid<2)return false;try{process.kill(-child.pid,0);return false;}catch(e){return e.code==='ESRCH';}};
 const kill=s=>{if(!Number.isSafeInteger(child.pid)||child.pid<2)return false;try{process.kill(-child.pid,s);return true;}catch{return false;}};
 const finish=proven=>{
  if(settled)return;settled=true;physicalStopProven=proven;
  for(const timer of [expiryTimer,graceTimer,killTimer,pollTimer])clearTimeout(timer);
  signal?.removeEventListener('abort',abort);
  completion.resolve(Object.freeze({physicalStopProven:proven,closed,code,signal:exitSignal,reason}));
 };
 function poll(){if(settled)return;if(closed&&absent()){finish(true);return;}pollTimer=setTimeout(poll,10);}
 function stop(value='CLOSED'){
  if(stopping||settled)return completion.promise;
  stopping=true;reason??=value;clearTimeout(expiryTimer);
  // Refuse pending/new observations before any physical retirement attempt.
  try{onStop();}catch{}
  child.stdin?.destroy();child.stdout?.resume();child.stderr?.resume();
  graceTimer=setTimeout(()=>finish(false),shutdownMs);
  kill('SIGTERM');killTimer=setTimeout(()=>{if(!settled)kill('SIGKILL');},Math.max(1,Math.floor(shutdownMs/2)));
  poll();return completion.promise;
 }
 function lease(){
  if(settled||stopping)return;
  let current;try{current=now();}catch{void stop('CLOCK');return;}
  if(!Number.isSafeInteger(current)||current<at){void stop('CLOCK');return;}
  at=current;if(current>=expiresAtMs){void stop('EXPIRED');return;}
  expiryTimer=setTimeout(lease,Math.min(1000,expiresAtMs-current));
 }
 const abort=()=>{void stop('CANCELLED');};
 child.on('error',()=>{void stop('PROCESS_ERROR');});
 child.once('close',(c,s)=>{closed=true;code=c;exitSignal=s;
  if(absent())finish(true);else void stop('DESCENDANTS');
 });
 signal?.addEventListener('abort',abort,{once:true});
 lease();if(signal?.aborted)abort();
 return Object.freeze({stop,completion:completion.promise,status:()=>Object.freeze({closed,stopping,settled,physicalStopProven,reason,code,signal:exitSignal}),
  async close(){const outcome=await stop();if(!outcome.physicalStopProven)throw launchFault('CLEANUP_UNKNOWN');return outcome;}});
}
