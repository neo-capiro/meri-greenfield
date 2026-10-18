/** Production caller for meriObjectiveGenerationWorkflow (task: the dispatcher had no production caller). PUBLIC control route,
 * composed only when the control configuration declares `objectiveGeneration.start` (configuration.mjs); otherwise `handle`
 * answers null for every request and the route boundary keeps answering 404.
 *
 *   POST /api/objective-generation/start   Authorization: Bearer <action session>   {"generationJobId":"<uuid>"}
 *   202 {"state":"requested","generationJobId":...}     503 {"error":{"code":"OBJECTIVE_GENERATION_UNAVAILABLE"|..._UNKNOWN}}
 *
 * The browser has already obtained the job from Core with the user's consent (D7-1: Core owns the Objective command and the
 * planner loop). This route only asks Meri to drive that job server-side. Authority:
 *   - the existing action-session owner authenticates the caller freshly (tenant and actor only; the session's own
 *     conversation is irrelevant: an Objective job gets its own derived conversation),
 *   - the binding is DERIVED from (tenant, actor, job) (objective-source/run-starts.mjs), never taken from JSON,
 *   - notAfterMs is server-set (now + declared window),
 *   - the job itself is admitted only by Core inside the workflow (source step), which checks the job belongs to this actor
 *     and consent. A job ID that is not this actor's therefore never gets past Core admission; the workflow waits and expires.
 * Starting is idempotent per (tenant, job) by Temporal workflow ID. A lost start acknowledgement is UNKNOWN (never retried here). */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {objectiveRunIdentity} from '../objective-source/run-starts.mjs';

export const OBJECTIVE_GENERATION_START_PATH='/api/objective-generation/start';
const get=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const headers=Object.freeze({'cache-control':'no-store','x-content-type-options':'nosniff'});
const answer=(code,status=503)=>Response.json({error:{code}},{status,headers});
const fault=code=>Object.assign(Error(code),{code});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);

export function createObjectiveGenerationStartApplication(configuration={}){
 let enabled=false,authenticate,start,windowMs,now=Date.now,maxRequestMs=3000;
 try{
  const flag=configuration&&typeof configuration==='object'&&!types.isProxy(configuration)?Object.getOwnPropertyDescriptor(configuration,'enabled'):null;
  if(flag&&'value'in flag&&flag.value===true){
   const c=own(configuration,['enabled','sessions','dispatcher','windowMs'],['now','maxRequestMs']);
   authenticate=storageMethod(c.sessions,'authenticateSession');start=storageMethod(c.dispatcher,'start');
   windowMs=c.windowMs;now=c.now??now;maxRequestMs=c.maxRequestMs??maxRequestMs;
   if(!Number.isSafeInteger(windowMs)||windowMs<60000||windowMs>86400000||typeof now!=='function'||types.isProxy(now)||
      !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw fault('CONFIGURATION');
   enabled=true;
  }
 }catch{throw fault('OBJECTIVE_GENERATION_CONFIGURATION');}
 async function handle(request){
  if(!enabled)return null;
  let r;try{r=Object.fromEntries(Object.entries(get).map(([k,g])=>[k,g.call(request)]));}catch{return null;}
  const url=new URL(r.url);if(url.pathname!==OBJECTIVE_GENERATION_START_PATH)return null;
  let life,dispatched=false;
  try{
   const header=k=>Headers.prototype.get.call(r.headers,k),auth=header('authorization'),length=header('content-length');
   if(r.method!=='POST'||url.search||url.hash||!auth?.startsWith('Bearer ')||auth.length>8199||header('content-encoding')||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||length!==null&&!/^[1-9][0-9]{0,3}$/u.test(length))return answer('OBJECTIVE_GENERATION_REFUSED',400);
   life=createOperationLifetime({now,signal:r.signal,deadlineMs:now()+maxRequestMs,errorFactory:()=>fault('OBJECTIVE_GENERATION_UNAVAILABLE')});
   let body;try{body=own(await jsonBody({body:r.body,length:length===null?null:Number(length)},1024,life,life.check),['generationJobId']);}catch{return answer('OBJECTIVE_GENERATION_REFUSED',400);}
   if(!uuid(body.generationJobId))return answer('OBJECTIVE_GENERATION_REFUSED',400);
   const started=now();let session,identity;
   try{
    session=data(await life.run(signal=>authenticate({credential:auth.slice(7),signal,deadlineMs:started+maxRequestMs})));const p=session.principal;
    if(!Number.isSafeInteger(session.checkedAtMs)||session.checkedAtMs<started||session.checkedAtMs>now()||!Number.isSafeInteger(session.expiresAtMs)||session.expiresAtMs<=now())throw fault('SESSION');
    identity=objectiveRunIdentity({tenantId:p?.tenantId,actorId:p?.actorId,generationJobId:body.generationJobId});
   }catch{life.check();return answer('SESSION_REFUSED',401);}
   life.check();dispatched=true;
   await life.run(signal=>start({source:{generationJobId:body.generationJobId,binding:identity.binding,notAfterMs:now()+windowMs},signal,deadlineMs:Math.min(session.expiresAtMs,now()+maxRequestMs)}));
   life.check();
   return Response.json({state:'requested',generationJobId:body.generationJobId},{status:202,headers});
  }catch{return answer(dispatched?'OBJECTIVE_GENERATION_UNKNOWN':'OBJECTIVE_GENERATION_UNAVAILABLE');}finally{life?.close();}
 }
 return Object.freeze({handle,state:()=>enabled?'composed':'disabled'});
}
