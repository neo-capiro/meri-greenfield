/** Control native operations for the schedule worker's two lane-1 owners (D016-A item 5, lane B3): scheduled native admission
 * and native allocation retirement of ONE routine occurrence. The schedule worker is its own service and holds no prepared
 * candidate, so it reaches control's admission (scheduled-admission.mjs over the candidate's template and the canonical journals)
 * and the candidate's initial-run retirement through its native capability client (native-client.mjs, `/v1/` + operation),
 * authorized exactly like the Objective `runs` operations (objective-runs-http.mjs): POST, no query, JSON without content-encoding,
 * a Bearer matching the control capability digest, served only on the PRIVATE control listener (control-route-boundary.mjs).
 *   POST /v1/routines/occurrences/admit  {occurrence,occurrenceKey,effect,input} -> {admitted:{binding,requestSha256,expiresAtMs,replayed}} | {refused:{code}}
 *   POST /v1/routines/occurrences/retire {binding}                               -> {retired:{physicalStopProven:true}}                  | {refused:{code}}
 * Both are idempotent on the occurrence (admission replays its one immutable run; retirement re-proves one physical stop), so once
 * the whole request is received each runs to its own bounded deadline, never the caller's signal: a cut-off attempt is repeated by
 * the worker's reconciliation, never resumed. `refused` carries the owner's typed code (ROUTINES_OCCURRENCE_*, SCHEDULE_ADMISSION_*,
 * the retirement's own codes) so the worker reports exactly what its in-process owner would have thrown; 503
 * ROUTINES_OCCURRENCE_UNAVAILABLE is everything else (no evidence). Disabled (the default) the application answers null for every
 * path, so the route boundary answers 404 and nothing is read. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {matchesCapability} from './task-verifier.mjs';

export const ROUTINES_OCCURRENCE_PREFIX='/v1/routines/occurrences/';
export const ROUTINES_OCCURRENCE_OPERATIONS=Object.freeze({admit:'routines/occurrences/admit',retire:'routines/occurrences/retire'});
/** The grammar of a carried refusal code (the dispatch owner's `exposed` grammar). */
export const ROUTINES_OCCURRENCE_CODE=/^[A-Z][A-Z0-9_]{0,63}$/u;
const HEX64=/^[a-f0-9]{64}$/u;
/** The approved instruction is at most 100000 characters (approved-instructions.mjs); the projection, task and events are small. */
const ROUTES=Object.freeze({
 ['/v1/'+ROUTINES_OCCURRENCE_OPERATIONS.admit]:{method:'admit',fields:['occurrence','occurrenceKey','effect','input'],limit:262144},
 ['/v1/'+ROUTINES_OCCURRENCE_OPERATIONS.retire]:{method:'retire',fields:['binding'],limit:16384},
});
const get=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const fault=()=>Object.assign(Error('ROUTINES_OCCURRENCE_UNAVAILABLE'),{code:'ROUTINES_OCCURRENCE_UNAVAILABLE'});
const headers=Object.freeze({'cache-control':'no-store'});

/** A closed reply: exactly one of the route's positive member or `refused:{code}`. Throws for anything else. */
export function assertOccurrenceReply(method,value){
 const keys=Object.keys(value);
 if(keys.length!==1)throw fault();
 if(keys[0]==='refused'){const r=own(value.refused,['code']);if(typeof r.code!=='string'||!ROUTINES_OCCURRENCE_CODE.test(r.code))throw fault();return value;}
 if(method==='admit'){
  if(keys[0]!=='admitted')throw fault();
  const r=own(value.admitted,['binding','requestSha256','expiresAtMs','replayed']);validateShape('RunBinding',r.binding);
  if(typeof r.requestSha256!=='string'||!HEX64.test(r.requestSha256)||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<1||typeof r.replayed!=='boolean')throw fault();
  return value;
 }
 if(keys[0]!=='retired')throw fault();
 const r=own(value.retired,['physicalStopProven']);if(r.physicalStopProven!==true)throw fault();
 return value;
}

export function createRoutinesOccurrenceApplication(configuration={}){
 let c,calls;
 try{
  c=own(configuration,['controlCapabilitySha256'],['owner','enabled','now','maxRequestMs']);
  c.enabled=c.enabled??false;c.now=c.now??Date.now;c.maxRequestMs=c.maxRequestMs??10000;
  if(typeof c.enabled!=='boolean'||typeof c.now!=='function'||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000||
     typeof c.controlCapabilitySha256!=='string'||!HEX64.test(c.controlCapabilitySha256)||c.enabled&&c.owner===undefined)throw fault();
  calls=c.enabled?Object.fromEntries(['admit','retire'].map(m=>[m,storageMethod(c.owner,m)])):null;
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
   // Idempotent effects run to their own bounded deadline once the whole request is in; the caller's signal no longer cuts them.
   work=createOperationLifetime({now:c.now,deadlineMs:c.now()+c.maxRequestMs,errorFactory:fault});
   const value=data(await work.run(signal=>calls[route.method]({...body,signal})));work.check();
   return Response.json(assertOccurrenceReply(route.method,value),{headers});
  }catch{return Response.json({error:{code:'ROUTINES_OCCURRENCE_UNAVAILABLE'}},{status:503,headers});}finally{work?.close();life?.close();}
 }
 return Object.freeze({handle,state:()=>c.enabled?'composed':'disabled'});
}
