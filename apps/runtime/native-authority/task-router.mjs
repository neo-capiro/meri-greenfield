/** Bounded original-task forwarding. Only the dedicated private listener receives privateApplication. */
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {remoteOriginal,exactOriginal} from './remote-task-boundary.mjs';
import {taskRouterFault,taskRouterBody,taskRouterOperation,createTaskRouterIngress} from './task-router-boundary.mjs';
const getters=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const reply=(status=403)=>Response.json({error:{code:status===503?'TASK_ROUTER_UNAVAILABLE':'TASK_ROUTER_REFUSED'}},{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const pin=candidate=>hash(Object.fromEntries(Object.entries(candidate).filter(([key])=>key!=='checkedAtMs')));
export function createTaskRouterApplication(configuration){
 const c=own(configuration,['authority','networkReader','connector'],['privateIngress','enabled','now','maxRequestMs','maxConcurrent','maxOriginals','maxBufferedBytes']),enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??8000,maxConcurrent=c.maxConcurrent??64,maxOriginals=c.maxOriginals??1024,maxBufferedBytes=c.maxBufferedBytes??201326592;
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>256||!Number.isSafeInteger(maxOriginals)||maxOriginals<1||maxOriginals>4096||!Number.isSafeInteger(maxBufferedBytes)||maxBufferedBytes<8388608||maxBufferedBytes>268435456)throw taskRouterFault();
 const verify=storageMethod(c.authority,'verify'),observe=storageMethod(c.networkReader,'observe'),connect=storageMethod(c.connector,'connect'),assertIngress=storageMethod(c.privateIngress??createTaskRouterIngress(),'assert'),active=new Set(),originals=new Map();let closed=false,reservedBytes=0,cleanupRequests=0;
 async function handle(request,marker){let life,entry,controller,connection,reservation=0,cleanupSlot=false;
  try{
   const info=Object.fromEntries(Object.entries(getters).map(([key,get])=>[key,get.call(request)])),url=new URL(info.url);
   if(!url.pathname.startsWith('/v1/native-task/'))return null;
   assertIngress(marker);if(!enabled||closed)return reply(503);
   const operation=taskRouterOperation(url.pathname.slice('/v1/native-task/'.length));if(info.method!=='POST'||url.search||url.hash)throw taskRouterFault();nativeSignal(info.signal);
   const header=name=>Headers.prototype.get.call(info.headers,name),authorization=header('authorization');
   if(typeof authorization!=='string'||!/^Bearer \S{1,8192}$/u.test(authorization)||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding')!==null)throw taskRouterFault();
   const declared=header('content-length');if(declared!==null&&!/^(0|[1-9][0-9]*)$/u.test(declared))throw taskRouterFault();
   const cleanup=operation==='stop',maxRequestBytes=['configuration','workspace-restore'].includes(operation)?50331648:2097152,maxResponseBytes=operation==='capture'?67108864:2097152;
   // Keep one bounded cleanup slot and its bytes available even when ordinary forwarding is saturated.
   reservation=maxRequestBytes+maxResponseBytes;
   if((cleanup?cleanupRequests>=1:active.size-cleanupRequests>=maxConcurrent)||reservation>(cleanup?maxBufferedBytes:maxBufferedBytes-4194304)-reservedBytes){reservation=0;throw taskRouterFault();}
   reservedBytes+=reservation;if(cleanup){cleanupSlot=true;cleanupRequests++;}controller=new AbortController();active.add(controller);
   life=createOperationLifetime({now,signal:AbortSignal.any([info.signal,controller.signal]),deadlineMs:now()+maxRequestMs,errorFactory:taskRouterFault});
   const input=taskRouterBody(await jsonBody({body:info.body,length:declared===null?null:Number(declared)},maxRequestBytes,life,life.check),operation),original=remoteOriginal(input.original);
   if(!cleanup)life.limitDeadline(original.expiresAtMs);
   const authority=()=>life.run(signal=>verify({original,operation,credential:authorization.slice(7),signal,check:life.check}));
   const first=await authority();exactOriginal(first.original,original);if(!cleanup)life.limitDeadline(first.expiresAtMs);
   for(const [key,value]of originals)if(value.expiresAtMs<=now()&&value.requests.size===0)originals.delete(key);
   entry=originals.get(original.executionKey);
   if(!entry){if(originals.size>=maxOriginals)throw taskRouterFault();entry={expiresAtMs:original.expiresAtMs,stopping:false,requests:new Set()};originals.set(original.executionKey,entry);}
   if(cleanup){entry.stopping=true;for(const pending of entry.requests)pending.abort(taskRouterFault());}
   else if(entry.stopping||entry.requests.size>=8)throw taskRouterFault();
   entry.requests.add(controller);
   const check=()=>{life.check();if(!cleanup&&entry.stopping)throw taskRouterFault();};
   const network=()=>life.run(signal=>observe({original,resource:first.resource,signal,check}));
   const candidate=await network();check();
   // A late connector result must still be closed when cancellation won the race.
   connection=await life.run(signal=>Promise.resolve(connect({candidate,signal})).then(value=>{if(life.signal.aborted){try{value.close();}catch{}throw taskRouterFault();}return value;}));
   const current=await authority();if(current.pinSha256!==first.pinSha256)throw taskRouterFault();if(!cleanup)life.limitDeadline(current.expiresAtMs);
   const connected=await network();if(pin(connected)!==pin(candidate))throw taskRouterFault();check();
   const response=await life.run(signal=>storageMethod(connection,'send')({operation,body:Buffer.from(JSON.stringify(input)),authorization,signal,maxResponseBytes}));check();
   if(response?.status!==200||!Buffer.isBuffer(response.body)||response.body.length>maxResponseBytes)throw taskRouterFault();
   const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(response.body));exactOriginal(parsed.original,original);
   const after=await authority();if(after.pinSha256!==first.pinSha256)throw taskRouterFault();
   // A stop is intentionally allowed to end RUNNING status. Every ordinary response needs fresh task+ENI evidence.
   if(!cleanup){life.limitDeadline(after.expiresAtMs);const returned=await network();if(pin(returned)!==pin(candidate))throw taskRouterFault();}
   check();return new Response(response.body,{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }catch{return reply();}finally{try{connection?.close();}catch{}entry?.requests.delete(controller);active.delete(controller);reservedBytes-=reservation;if(cleanupSlot)cleanupRequests--;life?.close();}
 }
 return Object.freeze({application:Object.freeze({handle:request=>handle(request)}),privateApplication:Object.freeze({handle:(request,context)=>handle(request,context?.ingress)}),close(){closed=true;for(const controller of active)controller.abort(taskRouterFault());},status:()=>({closed,activeRequests:active.size,trackedOriginals:originals.size})});
}
