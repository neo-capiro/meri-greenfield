/** Compatibility client for existing browser-guarded Core routes; no background authority or immutable ACK is supplied here. */
import {own,work,materializationInput,fail} from './identity.mjs';
import {plannerObservation} from './core-receipts.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {ProductError,productFailure} from '../product-access/errors.mjs';
export function createCorePlannerMaterializer({transport,now=Date.now,maxRequestMs=3000,maxFactBytes=1048576}){
 if(typeof transport?.request!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxFactBytes)||maxFactBytes<1||maxFactBytes>16777216)fail('CONFIGURATION');
 async function call(method,value){
  const {work:raw,signal,deadlineMs}=own(value,['work','deadlineMs'],['signal']),w=work(raw);nativeSignal(signal);if(!Number.isSafeInteger(deadlineMs))fail('CONFIGURATION');
  const cutoff=Math.min(deadlineMs,now()+maxRequestMs),life=createOperationLifetime({now,signal,deadlineMs:cutoff,errorFactory:code=>new ProductError('OBJECTIVE_PLANNER_'+code)});
  let dispatched=false;
  try{
   const response=own(await life.run(signal=>{dispatched=true;return transport.request({method,path:'/planner/strategy-materializations'+(method==='GET'?'/'+w.plannerRequestId:''),body:method==='POST'?JSON.stringify(materializationInput(w)):null,work:w,signal,deadlineMs:cutoff});}),['status','body']);
   if(response.status===401||response.status===403)fail('ACCESS_DENIED');
   // GET can become SOURCE_STALE after an Objective revision advances. Neither that nor 404 proves an absent effect.
   if(response.status!==(method==='POST'?201:200))return {state:'unconfirmed'};
   if(typeof response.body!=='string'||Buffer.byteLength(response.body)>maxFactBytes)fail('INVALID_RECEIPT');
   let json;try{json=JSON.parse(response.body);}catch{fail('INVALID_RECEIPT');}
   const observation=plannerObservation(json,w);life.check();return {state:'observed',observation};
  }catch(error){
   if(method==='POST'&&dispatched)fail('OUTCOME_UNCONFIRMED','UNKNOWN');
   if(productFailure(error))throw error;fail('OBSERVATION_UNAVAILABLE');
  }finally{life.close();}
 }
 return Object.freeze({read:call.bind(null,'GET'),apply:call.bind(null,'POST')});
}
