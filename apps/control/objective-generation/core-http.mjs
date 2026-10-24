/** Fixed Core job transport. Core derives its subject from the saved job; only control holds this service secret. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {uuid} from '../../artifacts/storage/boundary.mjs';
import {jsonBody} from '../action-application/http.mjs';
import {ProductError} from '../product-access/errors.mjs';

const routes=Object.freeze({
 admit:'/strategy-api/internal/objective-canonical/generation-admissions',
 publish:'/strategy-api/internal/objective-canonical/generation-requests',
 accept:'/strategy-api/internal/objective-canonical/generation-acceptances',
 complete:'/strategy-api/internal/objective-canonical/generation-completions',
 current:'/api/internal/objective-generation/current',
});
const readRoutes=Object.freeze({'admission-read':routes.admit,'request-read':routes.publish,'completion-read':routes.complete});
const unavailable=()=>({kind:'unavailable'}),fault=()=>new ProductError('OBJECTIVE_GENERATION_CORE_UNAVAILABLE');
const refuse=()=>{throw fault();};
function cancel(response){try{Promise.resolve(response?.body?.cancel()).catch(()=>{});}catch{}}
export function createCoreObjectiveGenerationTransport(configuration){
 const c=own(configuration,['source','origin','getServiceSecret'],['fetchImpl','now','maxRequestMs','maxFactBytes']);
 const source=data(own(c.source,['generationJobId','binding']));uuid(source.generationJobId);validateShape('RunBinding',source.binding);
 const origin=new URL(c.origin),fetchImpl=c.fetchImpl??globalThis.fetch,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,maxFactBytes=c.maxFactBytes??1048576;
 if(origin.protocol!=='https:'||origin.origin!==c.origin||origin.pathname!=='/'||origin.username||origin.password||origin.search||origin.hash||
  typeof c.getServiceSecret!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  !Number.isSafeInteger(maxFactBytes)||maxFactBytes<1||maxFactBytes>1048576)refuse();
 const body=JSON.stringify({schemaVersion:1,generationJobId:source.generationJobId});
 async function send(phase,value){
  const v=own(value,['deadlineMs'],['signal']);nativeSignal(v.signal);if(!Number.isSafeInteger(v.deadlineMs))refuse();
  const reading=Object.hasOwn(readRoutes,phase),route=reading?readRoutes[phase]+'/'+source.generationJobId:routes[phase];let life,response;
  try{
   life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs,now()+maxRequestMs),errorFactory:fault});
   const secret=await life.run(signal=>c.getServiceSecret({signal}));life.check();
   if(typeof secret!=='string'||secret.length<16||secret.length>8192||/[\s\x00-\x1f\x7f]/u.test(secret))refuse();
   response=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(origin.origin+route,{method:reading?'GET':'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{'x-internal-service-secret':secret,...(reading?{}:{'content-type':'application/json'}),accept:'application/json','accept-encoding':'identity'},...(reading?{}:{body})}));
    pending.then(r=>{if(life.signal.aborted)cancel(r);},()=>{});return pending;});life.check();
   if(types.isProxy(response)||!(response instanceof Response)||response.redirected||response.status!==((reading||phase==='current')?200:201))return unavailable();
   const length=response.headers.get('content-length');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get('content-type')??'')||![null,'identity'].includes(response.headers.get('content-encoding'))||
    length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||Number(length)>maxFactBytes))refuse();
   const raw=await jsonBody({body:response.body,length:length===null?null:Number(length)},maxFactBytes,life,life.check);life.check();
   return data({kind:'unqualified-response',status:response.status,value:raw});
  }catch{return unavailable();}finally{cancel(response);life?.close();}
 }
 return Object.freeze({available:()=>true,current:v=>send('current',v),admit:v=>send('admit',v),publish:v=>send('publish',v),accept:v=>send('accept',v),
  readAdmission:v=>send('admission-read',v),readRequest:v=>send('request-read',v),complete:v=>send('complete',v),readCompletion:v=>send('completion-read',v)});
}
