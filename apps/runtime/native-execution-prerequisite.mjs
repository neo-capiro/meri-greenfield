/** Cohesive Control-side native execution prerequisite.
 *
 * Need is derived only from the retained canonical request and its selected uploads; readiness is the existing
 * allocation owner's read-only host answer. Every dependency await is raced against one owned operation lifetime
 * bounded by the original execution deadline and the existing provisioning effect allowance. Short dependency
 * reads use the ordinary request budget; polling never holds a transaction and unsettled work is not stop proof.
 */
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {assertUploadSelections} from '../../packages/contracts/upload-selection.mjs';
import {canonicalSha256 as selectionHash} from '../../packages/contracts/validate.mjs';

const fail=()=>{throw Object.assign(Error('EXECUTION_NATIVE_PREREQUISITE_REFUSED'),{code:'EXECUTION_NATIVE_PREREQUISITE_REFUSED'});};
const finite=value=>Number.isSafeInteger(value)&&value>0;

export function createNativeExecutionPrerequisite({store,uploadInputSource,nativeAllocations,policySha256,now=Date.now,
 requestTimeoutMs,effectTimeoutMs}){
 if(typeof store?.read!=='function'||typeof nativeAllocations?.ready!=='function'||typeof now!=='function'||
  !finite(requestTimeoutMs)||!finite(effectTimeoutMs)||typeof policySha256!=='string'||
  !/^[a-f0-9]{64}$/u.test(policySha256))fail();
 const lifeFor=(deadlineMs,outerSignal,allowance)=>{
  const limit=Math.min(finite(deadlineMs)?deadlineMs:now()+allowance,now()+allowance);
  if(limit<=now())fail();
  return createOperationLifetime({now,deadlineMs:limit,signal:outerSignal,
   errorFactory:()=>Object.assign(Error('EXECUTION_NATIVE_PREREQUISITE_REFUSED'),
    {code:'EXECUTION_NATIVE_PREREQUISITE_REFUSED'})});
 };
 async function readNeed({binding,signal,deadlineMs,life}){
  const request=lifeFor(Math.min(life.deadline(),now()+requestTimeoutMs),life.signal,requestTimeoutMs);
  let saved;try{saved=await request.run(s=>store.read(binding,{after:0,limit:1},()=>s.throwIfAborted()));}finally{request.close();}
  const selections=saved?.request?.uploads;
  if(selections===undefined)return Object.freeze({kind:'none'});
  if(typeof uploadInputSource?.read!=='function')fail();
  let selected;try{selected=assertUploadSelections(selections);}catch{fail();}
  for(const selection of selected){
   const short=lifeFor(Math.min(life.deadline(),now()+requestTimeoutMs),life.signal,requestTimeoutMs);
   try{await short.run(s=>uploadInputSource.read({binding,selection,deadlineMs:short.deadline(),signal:s}));}
   finally{short.close();}
  }
  return Object.freeze({kind:'native-processing',hostMode:'native-processing',policySha256,uploadCount:selected.length,
   selectionSha256:selectionHash(selected)});
 }
 async function need({binding,executionId,signal,deadlineMs}){
  const life=lifeFor(deadlineMs,signal,requestTimeoutMs);
  try{const {selectionSha256,...value}=await readNeed({binding,signal,deadlineMs,life});return Object.freeze(value);}finally{life.close();}
 }
 async function ready({binding,executionId,signal,deadlineMs}){
  const life=lifeFor(deadlineMs,signal,effectTimeoutMs);
  try{
   const first=await readNeed({binding,signal,deadlineMs,life});
   if(first.kind==='none')return Object.freeze({status:'none'});
   for(;;){
    life.check();
    const allocation=lifeFor(Math.min(life.deadline(),now()+requestTimeoutMs),life.signal,requestTimeoutMs);
    let result;try{result=await allocation.run(s=>nativeAllocations.ready({binding,policySha256,signal:s}));}finally{allocation.close();}
    if(result?.status==='ready'){
     // The retained requirement must still be the same live selection after the wait.
     const final=await readNeed({binding,signal,deadlineMs,life});
     if(final.kind!=='native-processing'||final.policySha256!==first.policySha256||
      final.uploadCount!==first.uploadCount||final.selectionSha256!==first.selectionSha256||
      final.policySha256!==policySha256)fail();
     const currentUntilMs=result.currentUntilMs,leaseDeadlineMs=result.leaseDeadlineMs;
     if(!Number.isSafeInteger(currentUntilMs)||currentUntilMs<=now()||!Number.isSafeInteger(leaseDeadlineMs)||
      leaseDeadlineMs<=now()||!Number.isSafeInteger(result.generation))fail();
     return Object.freeze({...result,policySha256,currentUntilMs:Math.min(currentUntilMs,leaseDeadlineMs,life.deadline())});
    }
    if(!['absent','not-ready'].includes(result?.status))fail();
    const delay=Math.min(250,Math.max(0,life.deadline()-now()));
    if(life.deadline()<=now())fail();
    await life.run(s=>new Promise((resolve,reject)=>{
     let timer;
     const finish=()=>{if(timer)clearTimeout(timer);s.removeEventListener('abort',abort);};
     const abort=()=>{finish();reject(Object.assign(Error('EXECUTION_NATIVE_PREREQUISITE_REFUSED'),
      {code:'EXECUTION_NATIVE_PREREQUISITE_REFUSED'}));};
     timer=setTimeout(()=>{finish();resolve();},delay);
     s.addEventListener('abort',abort,{once:true});
    }));
   }
  }finally{life.close();}
 }
 return Object.freeze({need,ready});
}
