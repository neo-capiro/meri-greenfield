/** UI acknowledgement: time from handing the submit Request to the application until the accepted-request response resolves.
 * `dispatched` counts distinct runs newly handed to the scripted runtime (the service re-dispatches idempotently on replay).
 * Each run is a fresh conversation (the service admits one request per conversation binding), so every round uses its own principals.
 * Model completion is never part of the sample. Measured against the scripted loopback application, so it is a LOCAL_FIXTURE. */
import {performance} from 'node:perf_hooks';
import {syntheticId} from '../offline-targets/conversation-application.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function measureAcknowledgement({target,principals,credentials,concurrency=10,rounds=3,clock=()=>performance.now()}){
 if(!target||typeof target.app?.handle!=='function'||!Array.isArray(target.state?.starts)||!Array.isArray(principals)||!Number.isSafeInteger(concurrency)||concurrency<1||!Number.isSafeInteger(rounds)||rounds<1||rounds>50||principals.length<concurrency*rounds)fail('ACKNOWLEDGEMENT_CONFIGURATION');
 const samples=[],failures=[],runsBefore=new Set(target.state.starts).size;
 for(let round=0;round<rounds;round++){
  const batch=principals.slice(round*concurrency,(round+1)*concurrency).map(async(p,index)=>{const credential=credentials.get(p);if(typeof credential!=='string')fail('ACKNOWLEDGEMENT_CREDENTIAL');
   const body={requestId:syntheticId('ac4e',round*1000+index+1),prompt:`Acknowledgement probe round ${round} slot ${index}`};
   const started=clock();const response=await target.app.handle(target.request({route:'submit',credential,body}));const elapsed=clock()-started;
   if(response.status!==200){failures.push({round,index,status:response.status});return;}
   const accepted=await response.json();if(accepted.requestId!==body.requestId)failures.push({round,index,status:'REQUEST_MISMATCH'});else if(accepted.replayed!==false)failures.push({round,index,status:'REPLAYED'});else samples.push(elapsed);});
  await Promise.all(batch);
 }
 return {concurrency,rounds,requested:concurrency*rounds,accepted:samples.length,dispatched:new Set(target.state.starts).size-runsBefore,failures,samples};
}
