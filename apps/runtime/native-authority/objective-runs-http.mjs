/** Control native operations for the Objective generation `runs` port (D7-4). The Temporal worker has no database pool; it
 * calls these through its existing native capability client (native-client.mjs, `/v1/` + operation), authorized exactly like
 * the prepared kickoff operations: POST, no query, JSON without content-encoding, and a Bearer that matches the control
 * capability digest. They are served only on the PRIVATE control listener (control-route-boundary.mjs `/v1/` paths).
 *   POST /v1/objective-generation/runs/start  {binding,generationJobId,acceptedRequest,selection} -> {kind:'started'|'not-started'}
 *   POST /v1/objective-generation/runs/read   {binding}                                          -> {run:Run|null}
 * Disabled (the default) the application answers null for every path, so the route boundary answers 404 and nothing is read. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {matchesCapability} from './task-verifier.mjs';
import {MAX_OBJECTIVE_SELECTION_BYTES} from '../../../packages/runtime/objective-generation-custody.mjs';

export const OBJECTIVE_RUNS_PREFIX='/v1/objective-generation/runs/';
export const OBJECTIVE_RUNS_OPERATIONS=Object.freeze({start:'objective-generation/runs/start',read:'objective-generation/runs/read'});
const ROUTES=Object.freeze({
 ['/v1/'+OBJECTIVE_RUNS_OPERATIONS.start]:{method:'start',fields:['binding','generationJobId','acceptedRequest','selection'],limit:MAX_OBJECTIVE_SELECTION_BYTES+262144},
 ['/v1/'+OBJECTIVE_RUNS_OPERATIONS.read]:{method:'read',fields:['binding'],limit:16384},
});
const get=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const fault=()=>Object.assign(Error('OBJECTIVE_RUNS_UNAVAILABLE'),{code:'OBJECTIVE_RUNS_UNAVAILABLE'});
const headers=Object.freeze({'cache-control':'no-store'});

export function createObjectiveRunsApplication(configuration={}){
 let c,calls;
 try{
  c=own(configuration,['controlCapabilitySha256'],['owner','enabled','now','maxRequestMs']);
  c.enabled=c.enabled??false;c.now=c.now??Date.now;c.maxRequestMs=c.maxRequestMs??10000;
  if(typeof c.enabled!=='boolean'||typeof c.now!=='function'||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000||
     typeof c.controlCapabilitySha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.controlCapabilitySha256)||c.enabled&&c.owner===undefined)throw fault();
  calls=c.enabled?Object.fromEntries(['start','read'].map(m=>[m,storageMethod(c.owner,m)])):null;
 }catch{throw fault();}
 async function handle(request){
  if(!c.enabled)return null;
  let life,work;
  try{
   const r=Object.fromEntries(Object.entries(get).map(([k,g])=>[k,g.call(request)])),url=new URL(r.url),route=ROUTES[url.pathname];
   if(!Object.hasOwn(ROUTES,url.pathname))return null;
   const header=k=>Headers.prototype.get.call(r.headers,k),auth=header('authorization');
   if(r.method!=='POST'||url.search||!auth?.startsWith('Bearer ')||!matchesCapability(auth.slice(7),c.controlCapabilitySha256)||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding'))throw fault();
   const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))throw fault();
   life=createOperationLifetime({now:c.now,signal:r.signal,deadlineMs:c.now()+c.maxRequestMs,errorFactory:fault});
   const body=own(await jsonBody({body:r.body,length:length===null?null:Number(length)},route.limit,life,life.check),route.fields);
   // start is idempotent, and the workflow driver only reads back after an unconfirmed effect, so a start cut off half way
   // could never be resumed. Once the whole request is received it runs to its own bounded deadline, not the caller's signal.
   work=route.method==='start'?createOperationLifetime({now:c.now,deadlineMs:c.now()+c.maxRequestMs,errorFactory:fault}):life;
   const value=data(await work.run(signal=>calls[route.method]({...body,signal})));work.check();
   if(route.method==='start'){own(value,['kind']);if(!['started','not-started'].includes(value.kind))throw fault();}
   else{own(value,['run']);if(value.run!==null)validateShape('Run',value.run);}
   return Response.json(value,{headers});
  }catch{return Response.json({error:{code:'OBJECTIVE_RUNS_UNAVAILABLE'}},{status:503,headers});}finally{if(work!==life)work?.close();life?.close();}
 }
 return Object.freeze({handle,state:()=>c.enabled?'composed':'disabled'});
}
