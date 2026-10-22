/** Owner observations retain only telemetry identities, never transport authority.
 * Placement/admission read IDs precede the model request ID. Their work belongs
 * to the admitted run; the next settled request drains that pending run work.
 * Concurrent model requests keep separate counters and can never drain one another.
 */
import {AsyncLocalStorage} from 'node:async_hooks';
import {currentTurnTelemetry} from '../../runtime/telemetry/turn-context.mjs';
const requests=new AsyncLocalStorage(),finalizers=new WeakMap();
const observe=work=>{try{return work();}catch{return undefined;}};

/** Flush settled request counters after all work on the HTTP request. */
export function runOwnerHttpRequest(telemetry,work){
 if(!telemetry)return work();
 return telemetry.provisional(()=>requests.run({settlements:[]},async()=>{
  try{return await work();}
  finally{for(const {binding,requestId}of requests.getStore().settlements)
   observe(()=>telemetry.counters(binding,{requestId,includeRun:true,reset:true,release:true}));}
 }));
}
function settled(telemetry,binding,requestId){
 const pending=requests.getStore();
 if(pending)pending.settlements.push({binding,requestId});
 else observe(()=>telemetry.counters(binding,{requestId,includeRun:true,reset:true,release:true}));
}
export function finishOwnerChannel(channel){observe(()=>finalizers.get(channel)?.());}

export function observeOwnerChannel(channel,{telemetry=currentTurnTelemetry(),identity}){
 if(!telemetry)return channel;
 let reported=false;
 function finish(){
  const after=identity();
  if(reported||!after.binding)return;
  reported=true;
  // An OPEN can discover its canonical binding and then fail before the first
  // model operation. Materialize the empty request slot to drain its run work.
  telemetry.withRequest(after.requestId,after.binding,()=>{});
  settled(telemetry,after.binding,after.requestId);
 }
 const wrap=method=>async(...args)=>{
  const invoke=async()=>{
   const before=identity();
   if(before.binding)observe(()=>telemetry.bind(before.binding));
   const work=()=>channel[method](...args);
   try{return before.requestId&&!reported?await telemetry.withRequest(before.requestId,before.binding,work):await work();}
   finally{observe(()=>{const after=identity();if(after.binding)telemetry.bind(after.binding);if(after.settled||after.failed)finish();});}
  };
  return currentTurnTelemetry()===telemetry?invoke():telemetry.provisional(invoke);
 };
 const wrapped=Object.freeze({get available(){return channel.available;},get canReadOutcome(){return channel.canReadOutcome;},
  close(){channel.close();finish();},readOutcome:wrap('readOutcome'),open:wrap('open'),poll:wrap('poll'),reply:wrap('reply'),operation:wrap('operation')});
 finalizers.set(wrapped,finish);return wrapped;
}
