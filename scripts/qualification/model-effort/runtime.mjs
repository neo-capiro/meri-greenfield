/** Candidate-only entrypoint using the unchanged AgentCore HTTP/query/runner owners. */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {takeRuntimeManifest,LIMITS,fail,commitment} from './plan.mjs';
import {assertLoaded,observeQuery} from './observe.mjs';
import {verifyMethod,boundedJson} from './transport.mjs';
export async function main(args=process.argv.slice(2)){
 if(args.length===1&&args[0]==='--help'){process.stdout.write('Candidate runtime: node runtime.mjs. Reads credential-free MERI_MODEL_QUALIFICATION_MANIFEST, deletes it before SDK loading. No file fallback.\n');return 0;}
 if(args.length!==0)return 2;
 let transport,listener,app;const stop=new AbortController(),shutdown=()=>stop.abort();let timer,result=0;
 try{
  const {manifest:plan,allocationSha256}=takeRuntimeManifest();verifyMethod(plan.methodSha256);
  const [{agentcoreEnvironment,createAgentCoreControlTransport},{createAgentCoreQuery},{createAgentCoreWorkspace},{createAgentCoreApplication},{listenRuntime},{sdkQuery}]=await Promise.all([
   import('../../../apps/runtime/agentcore-control-client.mjs'),import('../../../apps/runtime/agentcore-query.mjs'),import('../../../apps/runtime/agentcore-workspace.mjs'),import('../../../apps/runtime/agentcore-http.mjs'),import('../../../apps/runtime/http-server.mjs'),import('../../../apps/worker/conversation/activity.mjs')]);
  const environment=agentcoreEnvironment();if(commitment(environment.origin)!==plan.controlOriginSha256)fail('QUALIFICATION_CONTROL_ORIGIN');
  transport=createAgentCoreControlTransport(environment);
  let used=false,caseId=null;
  // Logs contain bounded factual observations, never credentials, prompt, thinking or tool arguments.
  const emit=value=>process.stdout.write(JSON.stringify({eventNamespace:'meri-model-qualification/1',allocationSha256,caseId,...value})+'\n');
  const execute=async(raw,{signal})=>{
   if(used)fail('QUALIFICATION_ALREADY_ATTEMPTED');
   const selected=plan.cases.find(c=>commitment(raw.execution?.binding)===c.bindingSha256),c=selected?{...selected,binding:raw.execution.binding}:null;
   if(!c||raw.versions?.imageDigest!==plan.candidateImageDigest||raw.sourceEnabled===true||raw.approvedReads?.enabled===true||raw.intents?.enabled===true||Date.now()>=plan.expiresAtMs-LIMITS.cleanupMs)fail('QUALIFICATION_INVOCATION');
   used=true;caseId=c.id;
   const cutoff=Math.min(Date.now()+LIMITS.caseMs,plan.expiresAtMs-LIMITS.cleanupMs),cancel=new AbortController(),joined=AbortSignal.any([signal,stop.signal,cancel.signal]);
   const deadline=setTimeout(()=>cancel.abort(),Math.max(1,cutoff-Date.now()));let calls=0;
   const observer=observeQuery({query:sdkQuery,caseId,emit,abort:()=>cancel.abort()});
   const tapped=async(url,options)=>{
    if(++calls>150)fail('QUALIFICATION_NATIVE_CALL_LIMIT');
    const response=await transport.fetch(url,options),path=new URL(url).pathname;
    if(path==='/v1/runner/load'&&response.status===200){const loaded=await boundedJson(response.clone(),2097152);if(loaded.run?.versions?.imageDigest!==plan.candidateImageDigest)fail('QUALIFICATION_LOADED_IMAGE');emit({event:'loaded-request',...assertLoaded(loaded,c),imageDigest:loaded.run.versions.imageDigest});}
    if(path==='/v1/runner/record-usage'){
     const request=JSON.parse(options.body);
     if(Object.keys(c.binding).some(k=>request.binding?.[k]!==c.binding[k]))fail('QUALIFICATION_USAGE_BINDING');
     emit({event:'usage-write',usage:request.input?.usage??null,toolsUsed:request.input?.toolsUsed??null,httpStatus:response.status});
    }
    return response;
   };
   const run=createAgentCoreQuery({origin:environment.origin,fetchImpl:tapped,workspace:createAgentCoreWorkspace(),query:observer.query});
   emit({event:'attempt-started',requestId:c.requestId,binding:c.binding,cutoffMs:cutoff,releaseBindingSha256:plan.releaseBindingSha256,buildBindingSha256:plan.buildBindingSha256,methodSha256:plan.methodSha256,invocationImageDigest:raw.versions.imageDigest});
   try{const receipt=await run(raw,{signal:joined});emit({event:'settled',receipt,observation:observer.summary(),nativeCalls:calls});return receipt;}
   catch(error){emit({event:'unknown-or-failed',code:/^[A-Z0-9_]{1,100}$/.test(error?.code??'')?error.code:'QUALIFICATION_UNKNOWN',observation:observer.summary(),nativeCalls:calls});throw error;}
   finally{clearTimeout(deadline);}
  };
  app=createAgentCoreApplication({execute,signal:stop.signal});
  process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
  timer=setTimeout(shutdown,plan.expiresAtMs-Date.now());
  listener=await listenRuntime({configuration:{http:{hostname:'0.0.0.0',port:8080},limits:{requestMs:LIMITS.caseMs+LIMITS.cleanupMs,shutdownMs:LIMITS.cleanupMs}},application:app,readiness:async()=>{},signal:stop.signal,exposeReadiness:false});
  if(!stop.signal.aborted)await new Promise(r=>stop.signal.addEventListener('abort',r,{once:true}));
 }catch{process.stderr.write('MODEL_QUALIFICATION_RUNTIME_REFUSED_OR_UNKNOWN\n');result=listener?3:2;}
 finally{
  clearTimeout(timer);shutdown();process.removeListener('SIGINT',shutdown);process.removeListener('SIGTERM',shutdown);
  try{const [http,query]=await Promise.all([listener?.close(),app?.close({deadlineMs:Date.now()+LIMITS.cleanupMs})]);if(listener&&(!http.listenerStopped||http.pendingRequests!==0)||app&&!query.settled)result=3;}catch{result=3;}
  transport?.close();
 }
 return result;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))process.exitCode=await main();
