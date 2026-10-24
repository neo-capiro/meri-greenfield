/** AgentCore HTTP V1: one conversation environment, one active SDK invocation. */
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../control/action-application/http.mjs';
import {invocationInput,settlementResult,agentcoreFault,AGENTCORE_SESSION_HEADER,AGENTCORE_INVOCATION_BYTES} from './agentcore-contract.mjs';

export function createAgentCoreApplication(configuration){
 const {execute,now=Date.now,signal}=own(configuration,['execute'],['now','signal']);nativeSignal(signal);if(typeof execute!=='function'||typeof now!=='function')throw agentcoreFault('AGENTCORE_CONFIGURATION');
 let active=false,poisoned=false,session=null,lastFence=0,pending=null;const shutdown=new AbortController();
 const json=(value,status)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
 return Object.freeze({async close({deadlineMs}){shutdown.abort(agentcoreFault('RUNTIME_STOPPING'));const life=createOperationLifetime({now,deadlineMs,errorFactory:agentcoreFault});try{if(pending)await life.run(()=>pending);life.check();return {settled:true};}finally{life.close();}},async handle(request){
  const url=new URL(request.url);if(url.search)return json({error:{code:'REQUEST_REFUSED'}},400);
  if(url.pathname==='/ping')return request.method!=='GET'?json({error:{code:'METHOD_NOT_ALLOWED'}},405):shutdown.signal.aborted||signal?.aborted||poisoned?json({status:'Unhealthy'},503):json({status:active?'HealthyBusy':'Healthy'},200);
  if(url.pathname!=='/invocations')return json({error:{code:'NOT_FOUND'}},404);
  if(request.method!=='POST')return json({error:{code:'METHOD_NOT_ALLOWED'}},405);
  if(shutdown.signal.aborted||signal?.aborted||poisoned)return json({error:{code:'RUNTIME_UNAVAILABLE'}},503);
  let input;const readLife=createOperationLifetime({now,deadlineMs:now()+10000,signal:request.signal,errorFactory:agentcoreFault});
  try{if(! /^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))throw agentcoreFault('REQUEST_REFUSED');
   const length=request.headers.get('content-length');if(length!==null&&! /^(0|[1-9][0-9]*)$/u.test(length))throw agentcoreFault('REQUEST_REFUSED');
   input=invocationInput(await jsonBody({body:request.body,length:length===null?null:Number(length)},AGENTCORE_INVOCATION_BYTES,readLife,readLife.check));
   if(request.headers.get(AGENTCORE_SESSION_HEADER)!==input.execution.runtimeSessionId||input.execution.expiresAtMs<=now())throw agentcoreFault('REQUEST_REFUSED');
  }catch{return json({error:{code:'REQUEST_REFUSED'}},400);}finally{readLife.close();}
  const e=input.execution,key=hash({tenantId:e.binding.tenantId,actorId:e.binding.actorId,conversationId:e.binding.conversationId,runtimeSessionId:e.runtimeSessionId});
  if(session!==null&&session!==key)return json({error:{code:'SESSION_REFUSED'}},403);
  if(active||e.binding.writerFence<=lastFence)return json({error:{code:'INVOCATION_CONFLICT'}},409);
  session??=key;active=true;lastFence=e.binding.writerFence;
  const abort=new AbortController(),joined=AbortSignal.any([abort.signal,request.signal,shutdown.signal,...(signal?[signal]:[])]),encoder=new TextEncoder();let controller,ended=false;
  const enqueue=text=>{if(!ended)controller.enqueue(encoder.encode(text));};
  const stream=new ReadableStream({start(c){controller=c;enqueue(': accepted\n\n');},cancel(){ended=true;abort.abort(agentcoreFault('INVOCATION_DISCONNECTED'));}});
  const heartbeat=setInterval(()=>{try{enqueue(': active\n\n');}catch{abort.abort();}},15000);heartbeat.unref?.();
  pending=Promise.resolve().then(()=>execute(input,{signal:joined})).then(result=>{
   const receipt=settlementResult(result,e);enqueue('data: '+JSON.stringify(receipt)+'\n\n');
  }).catch(()=>{poisoned=true;try{enqueue('data: {"error":{"code":"EXECUTION_UNKNOWN"}}\n\n');}catch{}}).finally(()=>{clearInterval(heartbeat);active=false;if(!ended){ended=true;try{controller.close();}catch{}}});
  return new Response(stream,{headers:{'content-type':'text/event-stream','cache-control':'no-store',[AGENTCORE_SESSION_HEADER]:e.runtimeSessionId}});
 }});
}
