/** Synchronous Temporal admission loss and inspection of owned close evidence.
 * No authentication, resource disposal, network or SDK initialization lives here. */
import {types} from 'node:util';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';

const unavailableCode='TEMPORAL_AUTHORIZATION_UNAVAILABLE';
const cleanupCode='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN';
const getUrl=Object.getOwnPropertyDescriptor(Request.prototype,'url').get;
const getMethod=Object.getOwnPropertyDescriptor(Request.prototype,'method').get;
const getSignal=Object.getOwnPropertyDescriptor(Request.prototype,'signal').get;
const unavailable=()=>Response.json({error:{code:unavailableCode}},{status:503,
 headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const marker=value=>value!==null&&typeof value==='object'&&!types.isProxy(value)&&value instanceof Error&&Object.getOwnPropertyDescriptor(value,'code')?.value===cleanupCode;

/** Preserve an existing cleanup marker and its original cause across wrappers. */
export function temporalCleanupUnknown(cause){
 return marker(cause)?cause:Object.assign(new Error(cleanupCode,{cause}),{code:cleanupCode});
}

export function createTemporalRuntimeFence(){
 let lost=false,cause;const controller=new AbortController();
 function lose(reason){if(lost)return false;lost=true;cause=reason;controller.abort(reason);return true;}
 function check(){if(lost)throw Object.assign(new Error(unavailableCode,{cause}),{code:unavailableCode});}
 return Object.freeze({lose,check,healthy:()=>!lost,signal:controller.signal,
  /** This wrapper grants no stop authority. The captured original handler still
   * checks its native control bearer, body and exact original task custody. */
  wrap(application){
   const handle=storageMethod(application,'handle');
   return Object.freeze({handle(request){
    let delegated;
    try{
     if(types.isProxy(request))return unavailable();
     const address=getUrl.call(request),method=getMethod.call(request),url=new URL(address);
     const stop=method==='POST'&&url.pathname==='/v1/execution/kickoff/stop'&&!url.search&&!url.hash&&!address.includes('?');
     if(stop)delegated=request;
     else{
      if(lost)return unavailable();
      delegated=new Request(request,{signal:AbortSignal.any([getSignal.call(request),controller.signal])});
     }
    }catch{return unavailable();}
    return handle(delegated);
   }});
  },
 });
}

// Existing runtime close/status evidence uses these counts. A malformed count
// cannot serve as zero work. No physical stop is inferred from a void close.
const pendingCounts=['unsettledOperations','pendingOperations','pendingRequests','pendingInitializations','pendingReads','pendingWrites','pendingStartup','pendingMaterial','pendingExternalOperations','pendingServiceOperations','pendingTransactions','pendingQueries','pendingBorrows','pendingConnections','pending'];
function inspectReceipt(value){
 if(value===undefined||value===null)return;
 if(marker(value))throw value;
 const receipt=data(value);
 if(typeof receipt!=='object'||Array.isArray(receipt))throw value;
 for(const key of pendingCounts)if(Object.hasOwn(receipt,key)&&!(key==='pending'&&receipt[key]===false)&&
    (!Number.isSafeInteger(receipt[key])||receipt[key]!==0))throw receipt;
 if(['CLEANUP_UNKNOWN','UNKNOWN'].includes(receipt.state)||Object.hasOwn(receipt,'uncertain')&&receipt.uncertain!==false||Object.hasOwn(receipt,'cleanupErrors')&&(!Array.isArray(receipt.cleanupErrors)||receipt.cleanupErrors.length!==0))throw receipt;
 for(const key of ['closed','listenerStopped'])if(Object.hasOwn(receipt,key)&&receipt[key]!==true)throw receipt;
 if(Object.hasOwn(receipt,'initializing')&&receipt.initializing!==false||
    Object.hasOwn(receipt,'failures')&&(!Array.isArray(receipt.failures)||receipt.failures.length!==0)||
    Object.hasOwn(receipt,'failure')&&receipt.failure!==null)throw receipt;
}

/** Inspect actual, unfiltered Promise.allSettled close results at each owner
 * boundary. Native close APIs may return void. physicalStopProven:false alone
 * says nothing about pending work and is never upgraded into physical proof.
 * Pass the allocated worker's public getState() result after awaiting its run;
 * INITIALIZED has no public dispose. Never run it just to manufacture cleanup. */
export function assertTemporalRuntimeCleanup(results,options={}){
 const problems=[];
 try{
  const c=own(options,[],['workerState']);
  if(!Array.isArray(results)||types.isProxy(results))throw Error('TEMPORAL_CLEANUP_RESULTS');
  for(const result of results){
   try{
    const item=own(result,['status'],['value','reason']);
    if(item.status==='rejected'){own(result,['status','reason']);throw item.reason;}
    if(item.status!=='fulfilled')throw Error('TEMPORAL_CLEANUP_RESULT');
    own(result,['status','value']);inspectReceipt(item.value);
   }catch(error){problems.push(error);}
  }
  if(c.workerState!==undefined&&c.workerState!=='STOPPED')problems.push(Object.freeze({workerState:c.workerState}));
 }catch(error){problems.push(error);}
 if(problems.length)throw temporalCleanupUnknown(problems.length===1?problems[0]:new AggregateError(problems,cleanupCode));
}
