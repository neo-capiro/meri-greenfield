/** Four bounded Objective activities run in control, reached with the Temporal worker's existing private capability. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {matchesCapability} from './task-verifier.mjs';

export const OBJECTIVE_ACTIVITIES_PREFIX='/v1/objective-generation/activities/';
export const OBJECTIVE_ACTIVITY_OPERATIONS=Object.freeze({
 objectiveGenerationSource:'objective-generation/activities/source',
 objectiveGenerationStartRun:'objective-generation/activities/start-run',
 objectiveGenerationReadRun:'objective-generation/activities/read-run',
 objectiveGenerationComplete:'objective-generation/activities/complete',
});
const routes=new Map(Object.entries(OBJECTIVE_ACTIVITY_OPERATIONS).map(([method,operation])=>['/v1/'+operation,method]));
const fault=()=>Error('OBJECTIVE_ACTIVITY_UNAVAILABLE'),headers=Object.freeze({'cache-control':'no-store'});
export function createObjectiveActivitiesApplication(configuration={}){
 const c=own(configuration,['controlCapabilitySha256'],['activitiesFor','now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??15000;
 if(typeof c.controlCapabilitySha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.controlCapabilitySha256)||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  c.activitiesFor!==undefined&&typeof c.activitiesFor!=='function')throw fault();
 async function handle(request){let life;
  try{
   const url=new URL(request.url),method=routes.get(url.pathname);if(!method||!c.activitiesFor)return null;
   const auth=request.headers.get('authorization');
   if(request.method!=='POST'||url.search||!auth?.startsWith('Bearer ')||!matchesCapability(auth.slice(7),c.controlCapabilitySha256)||
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.has('content-encoding'))throw fault();
   life=createOperationLifetime({now,signal:request.signal,deadlineMs:now()+maxRequestMs,errorFactory:fault});
   const length=request.headers.get('content-length');if(length!==null&&(!/^[1-9][0-9]*$/u.test(length)||Number(length)>16384))throw fault();
   const body=await jsonBody({body:request.body,length:length===null?null:Number(length)},16384,life,life.check);
   const activities=c.activitiesFor({signal:life.signal}),value=data(await life.run(()=>activities[method](body)));life.check();
   const encoded=JSON.stringify(value);if(Buffer.byteLength(encoded)>16384)throw fault();return new Response(encoded,{headers:{...headers,'content-type':'application/json'}});
  }catch{return Response.json({error:{code:'OBJECTIVE_ACTIVITY_UNAVAILABLE'}},{status:503,headers});}finally{life?.close();}
 }
 return Object.freeze({handle,state:()=>c.activitiesFor?'composed':'disabled'});
}