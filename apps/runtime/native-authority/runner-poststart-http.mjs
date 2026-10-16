/** Dedicated private control listener route. The ALB appends the final XFF hop;
 * the private listener's security group must admit only that internal ALB. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {taskRouterClientIPv4,taskRouterFault} from './task-router-boundary.mjs';
const getters=Object.fromEntries(['url','method','headers','body','signal'].map(key=>[key,Object.getOwnPropertyDescriptor(Request.prototype,key).get]));
const deny=()=>Response.json({error:{code:'RUNNER_POSTSTART_REFUSED'}},{status:403,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export function createRunnerPoststartApplication(configuration){
 const c=own(configuration,['authority','privateIngress'],['now','maxRequestMs','maxConcurrent']),challenge=storageMethod(c.authority,'challenge'),redeem=storageMethod(c.authority,'redeem'),assertIngress=storageMethod(c.privateIngress,'assert'),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,maxConcurrent=c.maxConcurrent??16;let active=0;
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000||!Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>64)throw taskRouterFault();
 async function handle(request,marker){let life,reserved=false;try{
  const r=Object.fromEntries(Object.entries(getters).map(([k,get])=>[k,get.call(request)])),url=new URL(r.url);
  const step=url.pathname==='/v1/runner-poststart/challenge'?'challenge':url.pathname==='/v1/runner-poststart/redeem'?'redeem':null;
  if(step===null)return null;assertIngress(marker);
  if(r.method!=='POST'||url.search||url.hash)throw taskRouterFault();
  const header=name=>Headers.prototype.get.call(r.headers,name),peerIPv4=taskRouterClientIPv4(header('x-forwarded-for'));
  if(header('authorization')!==null||header('content-encoding')!==null||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??''))throw taskRouterFault();
  const declared=header('content-length');if(declared!==null&&!/^(0|[1-9][0-9]*)$/u.test(declared))throw taskRouterFault();
  if(active>=maxConcurrent)throw taskRouterFault();active++;reserved=true;
  life=createOperationLifetime({now,signal:r.signal,deadlineMs:now()+maxRequestMs,errorFactory:taskRouterFault});
  const body=await jsonBody({body:r.body,length:declared===null?null:Number(declared)},16384,life,life.check);
  const input=step==='challenge'?own(body,['schemaVersion','taskArn','csrPem']):own(body,['schemaVersion','taskArn','csrPem','challengeId','proofBase64']);
  if(input.schemaVersion!==1)throw taskRouterFault();
  const {schemaVersion:_,...requestBody}=input;
  const result=await life.run(signal=>(step==='challenge'?challenge:redeem)({...requestBody,peerIPv4,signal}));
  life.check();return Response.json(result,{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch(error){if(error?.code==='RUNNER_POSTSTART_PENDING')return Response.json({error:{code:'RUNNER_POSTSTART_PENDING'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});return deny();}finally{if(reserved)active--;life?.close();}}
 return Object.freeze({application:Object.freeze({handle:request=>handle(request)}),privateApplication:Object.freeze({handle:(request,context)=>handle(request,context?.ingress)})});
}
