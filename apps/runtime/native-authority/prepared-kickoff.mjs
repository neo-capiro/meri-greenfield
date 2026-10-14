/** Finite original-task startup. Existing allocation/execution journals own durability. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {remoteOriginal,exactOriginal} from './remote-task-boundary.mjs';
import {executionFault} from './execution-broker.mjs';
const fault=()=>executionFault('KICKOFF_UNKNOWN'),same=(a,b)=>hash(a)===hash(b),taskArn=v=>typeof v==='string'&&/^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u.test(v);
function settings(c){const now=c.now??Date.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000,maxWaitMs=c.maxWaitMs??30000,pollMs=c.pollMs??100,cleanupMs=c.cleanupMs??30000;if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxWaitMs)||maxWaitMs<1||maxWaitMs>1800000||!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000||!Number.isSafeInteger(cleanupMs)||cleanupMs<1||cleanupMs>30000)throw fault();return {now,enabled,maxRequestMs,maxWaitMs,pollMs,cleanupMs};}
async function pause(life,ms){await life.run(signal=>new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(fault());},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();}));}
export function createPreparedRunnerGate(configuration){
 const c=own(configuration,['original','taskArn','authorizer'],['enabled','now','maxWaitMs']),original=remoteOriginal(c.original),s=settings(c),admitted=storageMethod(c.authorizer,'admitted');if(!taskArn(c.taskArn))throw fault();let closed=false,released=false,waited=false,releasing;const ready=Promise.withResolvers();ready.promise.catch(()=>{});
 function check(signal){nativeSignal(signal);if(!s.enabled||closed||signal?.aborted||s.now()>=original.expiresAtMs)throw fault();}
 function request(value){const v=own(value,['original','taskArn'],['signal']);exactOriginal(v.original,original);if(v.taskArn!==c.taskArn)throw fault();check(v.signal);return v;}
 async function proof(signal){check(signal);const started=s.now(),p=data(own(await admitted({original,signal}),['original','taskArn','checkedAtMs','expiresAtMs']));check(signal);exactOriginal(p.original,original);if(p.taskArn!==c.taskArn||!Number.isSafeInteger(p.checkedAtMs)||p.checkedAtMs<started||p.checkedAtMs>s.now()||p.expiresAtMs!==original.expiresAtMs)throw fault();return {...p,released};}
 async function readiness(value){const v=request(value),life=createOperationLifetime({now:s.now,signal:v.signal,deadlineMs:Math.min(s.now()+s.maxRequestMs,original.expiresAtMs),errorFactory:fault});try{return await life.run(signal=>proof(signal));}finally{life.close();}}
 async function release(value){const v=request(value);if(released)return readiness(value);if(releasing)return releasing;releasing=(async()=>{const p=await readiness(value);check(v.signal);released=true;ready.resolve();return {...p,released:true};})().catch(error=>{close();throw error;});releasing.catch(()=>{});return releasing;}
 async function wait(value={}){const {signal}=own(value,[],['signal']);check(signal);if(waited)throw fault();waited=true;const life=createOperationLifetime({now:s.now,signal,deadlineMs:Math.min(s.now()+s.maxWaitMs,original.expiresAtMs),errorFactory:fault});try{await life.run(signal=>proof(signal));await life.run(()=>ready.promise);return await life.run(signal=>proof(signal));}catch(error){close();throw error;}finally{life.close();}}
 function close(){closed=true;ready.reject(fault());}
 return Object.freeze({wait,readiness,release,close});
}
export function createPreparedTaskKickoff(configuration){
 const c=own(configuration,['original','controller','store','runner'],['enabled','now','maxRequestMs','maxWaitMs','pollMs','cleanupMs']),original=remoteOriginal(c.original),s=settings(c),allocate=storageMethod(c.controller,'allocate'),closeController=storageMethod(c.controller,'close'),read=storageMethod(c.store.allocations,'read'),readiness=storageMethod(c.runner,'readiness'),release=storageMethod(c.runner,'release'),key={binding:original.binding,allocationKey:original.executionKey};
 let dispatched=false,closed=false,attempt,allocationWork,closing,failure,waitingAllocation=false,attemptPending=false;const cancellation=new AbortController(),receipt={binding:original.binding,executionId:original.executionId,expiresAtMs:original.expiresAtMs};
 function input(value,field){const v=own(value,['binding',field],['signal']);nativeSignal(v.signal);if(!s.enabled||!same(v.binding,original.binding)||v[field]!==original[field]||v.signal?.aborted)throw fault();return v;}
 function check(signal){if(closed||signal?.aborted||s.now()>=original.expiresAtMs)throw fault();}
 async function stop(value){input(value,'executionId');await close();return data(receipt);}
 function close(){if(closing)return closing;closed=true;cancellation.abort(fault());closing=(async()=>{const life=createOperationLifetime({now:s.now,deadlineMs:s.now()+s.cleanupMs,errorFactory:fault});try{
   // Wait for a borrowed allocation that ignored cancellation before asking its
   // canonical owner to close. Late settlement repeats that same owner cleanup.
   if(allocationWork){waitingAllocation=true;try{await life.run(()=>allocationWork);}catch{}finally{waitingAllocation=false;}}
   return await life.run(()=>closeController());
  }finally{life.close();}})();closing.catch(()=>{});return closing;}
 async function startup(){const life=createOperationLifetime({now:s.now,signal:cancellation.signal,deadlineMs:Math.min(s.now()+s.maxWaitMs,original.expiresAtMs),errorFactory:fault});try{
  allocationWork=Promise.resolve().then(()=>{life.check();return allocate({signal:life.signal});});allocationWork.then(()=>{if(closed&&!waitingAllocation)void Promise.resolve().then(()=>closeController()).catch(()=>{});},()=>{});
  const admitted=await life.run(()=>allocationWork);life.check();check(life.signal);exactOriginal(admitted.original,original);if(!taskArn(admitted.resource?.taskArn))throw fault();const tuple={original,taskArn:admitted.resource.taskArn};
  const saved=await life.run(()=>read(key,life.check));if(saved.record?.state!=='ADMITTED'||!same(saved.record.original,original)||saved.record.resource.taskArn!==tuple.taskArn)throw fault();
  if(saved.record.resource.launchBinding?.state==='STARTED'){const restored=await life.run(signal=>storageMethod(c.controller,'reconcile')({signal}));life.check();check(life.signal);exactOriginal(restored.original,original);if(restored.taskArn!==tuple.taskArn)throw fault();return;}
  for(;;){life.check();check(life.signal);let p;try{p=await life.run(signal=>readiness({...tuple,signal}));}catch{life.check();check(life.signal);await pause(life,s.pollMs);continue;}exactOriginal(p.original,original);if(p.taskArn!==tuple.taskArn||p.expiresAtMs!==original.expiresAtMs||typeof p.released!=='boolean')throw fault();break;}
  const released=await life.run(signal=>release({...tuple,signal}));life.check();check(life.signal);exactOriginal(released.original,original);if(released.taskArn!==tuple.taskArn||released.released!==true||released.expiresAtMs!==original.expiresAtMs)throw fault();
  for(;;){const saved=await life.run(()=>read(key,life.check));life.check();check(life.signal);if(saved.record?.state!=='ADMITTED'||!same(saved.record.original,original)||saved.record.resource.taskArn!==tuple.taskArn||saved.record.resource.launchBinding?.state==='UNKNOWN')throw fault();if(saved.record.resource.launchBinding?.state==='STARTED')break;await pause(life,s.pollMs);}
 }catch(error){failure=error;try{await close();}catch{}throw error;}finally{life.close();}}
 async function kickoff(value){const v=input(value,'executionKey');check(v.signal);if(failure)throw fault();if(!dispatched){dispatched=true;attemptPending=true;attempt=startup().finally(()=>{attemptPending=false;});attempt.catch(()=>{});}return data(receipt);}
 async function status(value){const v=input(value,'executionId');check(v.signal);if(!dispatched||failure)throw fault();const life=createOperationLifetime({now:s.now,signal:v.signal,deadlineMs:Math.min(s.now()+s.maxRequestMs,original.expiresAtMs),errorFactory:fault});try{
  const saved=await life.run(()=>read(key,life.check));check(life.signal);if(!saved.record){if(attemptPending&&!failure&&!closed&&saved.run?.state==='queued'&&same(saved.run.binding,original.binding))return data({...receipt,state:'preparing'});throw fault();}if(!same(saved.record.original,original)||!['CLAIMED','ALLOCATED','ADMITTED'].includes(saved.record.state))throw fault();const phase=saved.record.resource?.launchBinding?.state;
  if(phase==='UNKNOWN')throw fault();if(phase!=='STARTED'||attemptPending)return data({...receipt,state:'preparing'});
  const stack=c.controller.prepared?.stack;if(!stack){if(attemptPending&&!failure&&!closed)return data({...receipt,state:'preparing'});throw fault();}const out=data(own(await life.run(signal=>storageMethod(stack.broker,'poll')({binding:original.binding,executionId:original.executionId,signal})),['binding','executionId','state']));check(life.signal);if(!same(out.binding,original.binding)||out.executionId!==original.executionId||!['executing','completed','failed','cancelled','paused','waiting-for-approval'].includes(out.state))throw fault();return data({...receipt,state:out.state});
 }finally{life.close();}}
 return Object.freeze({kickoff,status,stop,close});
}
