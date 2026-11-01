/** Release-only finite product-port driver. Mutations are each sent once; no retry/resume mode. */
import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {setTimeout as delay} from 'node:timers/promises';
import {readPlan,validatePlan,LIMITS,PAIRS,requestFor,selectionFor,selectionEqual,credential,journal,fail,sha} from './plan.mjs';
import {verifyMethod,post} from './transport.mjs';
const encode=v=>new TextEncoder().encode(JSON.stringify(v));
async function receivers(){const [initial,conversation,usage,models]=await Promise.all([import('../../../packages/contracts/dist/conversation-initial-input.mjs'),import('../../../packages/contracts/dist/conversation-application.mjs'),import('../../../packages/contracts/dist/conversation-usage.mjs'),import('../../../packages/contracts/model-selection.mjs')]);return {...initial,...conversation,...usage,...models};}
export async function runBatch({plan,append,readCredential=credential,send=post,contracts,now=Date.now,pause=delay}){
 validatePlan(plan,now());const r=contracts??await receivers();let estimate=0,historyReads=0;
 const call=async(c,path,body,session,deadline)=>{
  if(now()>=deadline)fail('QUALIFICATION_DEADLINE');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(LIMITS.requestMs,deadline-now()));
  // Persist intent before any network call. Never log credentials.
  append({event:'http-intent',caseId:c.id,path,requestSha256:sha(JSON.stringify(body)),atMs:now()});
  try{const out=await send(plan.controlOrigin,path,readCredential(session?c.sessionCredentialFile:c.nativeCredentialFile),body,{signal:controller.signal});append({event:'http-receipt',caseId:c.id,path,status:out.status,response:out.value,atMs:now()});if(out.status!==200||out.value?.error)fail('QUALIFICATION_HTTP_REFUSAL');return out;}
  finally{clearTimeout(timer);}
 };
 for(const c of plan.cases){
  const deadline=Math.min(plan.expiresAtMs-LIMITS.cleanupMs,now()+LIMITS.caseMs),selection=selectionFor(c.id);
  // Both are real read ports. Unavailable production rows are never overridden locally.
  const pref=await call(c,'/api/settings/user/read',{},false,deadline),tenant=await call(c,'/api/settings/tenant/read',{},false,deadline);
  // Settings replies do not expose an owner. The canonical allocation receiver below
  // proves the authenticated session's exact tenant/actor/conversation/run context.
  const catalog=r.assertModelCatalog(pref.value.modelCatalog);r.availableModelSelection(catalog,selection);
  if(!selectionEqual(catalog.defaultSelection,{provider:'bedrock',modelId:PAIRS[0].selection.modelId,effort:null}))fail('QUALIFICATION_DEFAULT');
  const policy=tenant.value.model;
  if(!Number.isInteger(policy?.maxTurns)||policy.maxTurns<1||policy.maxTurns>LIMITS.sdkTurnsPerCase||!Number.isInteger(policy.maxBudgetMicroUsd)||policy.maxBudgetMicroUsd<1||policy.maxBudgetMicroUsd>LIMITS.estimateMicroUsdPerCase||!Number.isSafeInteger(policy.monthlyCapMicroUsd)||policy.monthlyCapMicroUsd<1)fail('QUALIFICATION_TENANT_CAPS');
  const input=requestFor(c),context={tenantId:c.binding.tenantId,actorId:c.binding.actorId,conversationId:c.binding.conversationId,runId:c.binding.runId,clientId:null};
  const original=r.receiveConversationInitialInputRequest(encode(input));
  const allocation=await call(c,'/api/conversations/input/allocate',input,true,deadline);
  const allocated=await r.receiveConversationInitialInputResponse(allocation.status,allocation.bytes,original,context);
  if(allocated.created!==true||allocated.state!=='RESERVED'||Object.keys(c.binding).some(k=>allocated.allocation.binding[k]!==c.binding[k]))fail('QUALIFICATION_NOT_FRESH');
  const admission=await call(c,'/api/conversations/input/admit',input,true,deadline);
  const admitted=await r.receiveAllocatedConversationInputResponse(admission.status,admission.bytes,original,context,allocated);
  if(admitted.replayed!==false||!selectionEqual(admitted.request.modelSelection,selection))fail('QUALIFICATION_ADMISSION');
  const submittedRequest=r.receiveConversationRequest('submit',encode(input)),submitted=await call(c,'/api/conversations/submit',input,true,deadline);
  let view=await r.receiveConversationResponse('submit',submitted.status,submitted.bytes,submittedRequest);
  if(Object.keys(c.binding).some(k=>view.run.binding[k]!==c.binding[k]))fail('QUALIFICATION_RUN');
  let terminal;
  for(let count=0;count<LIMITS.historyReads;count++){
   const request=r.receiveConversationRequest('history',encode({after:0,limit:100})),read=await call(c,'/api/conversations/history',request,true,deadline);historyReads++;
   view=await r.receiveConversationResponse('history',read.status,read.bytes,request,view);
   if(!selectionEqual(view.request.modelSelection,selection)||view.request.requestId!==c.requestId)fail('QUALIFICATION_HISTORY');
   if(['completed','failed','cancelled','held'].includes(view.run.state)){terminal=view.run.state;break;}
   await pause(Math.min(5000,Math.max(1,deadline-now())),undefined,{signal:AbortSignal.timeout(Math.max(1,deadline-now()))});
  }
  if(terminal!=='completed')fail(terminal?'QUALIFICATION_TERMINAL_FAILURE':'QUALIFICATION_TERMINAL_UNKNOWN');
  const usageRequest=r.receiveConversationUsageRequest(encode({schemaVersion:'meri.conversation-usage/1',conversationId:c.binding.conversationId,runId:c.binding.runId}));
  const read=await call(c,'/api/conversations/usage',usageRequest,false,deadline),usage=r.receiveConversationUsageResponse(read.status,read.bytes,usageRequest);
  const amount=usage.usage?.runDelta?.sdkEstimateUsd;
  if(usage.recording!=='recorded'||usage.usage?.status!=='recorded'||usage.usage.providerBilledUsd!==null||typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>LIMITS.estimateMicroUsdPerCase/1e6||usage.toolAudit?.tools?.length!==0||usage.toolAudit.omitted!==0)fail('QUALIFICATION_USAGE_OR_TOOLS');
  estimate+=amount;if(estimate>LIMITS.aggregateEstimateMicroUsd/1e6)fail('QUALIFICATION_AGGREGATE');
  append({event:'case-product-complete',caseId:c.id,selection,estimateUsd:amount,aggregateEstimateUsd:estimate,qualification:'PENDING_RUNTIME_RECEIPT_REVIEW',providerEffortAcknowledgement:'UNKNOWN'});
 }
 return {cases:5,historyReads,estimateUsd:estimate,qualification:'PENDING_RUNTIME_RECEIPT_REVIEW'};
}
export async function main(args=process.argv.slice(2)){
 if(args.length===1&&args[0]==='--help'){process.stdout.write('Release only: node driver.mjs <allocation.json> <new-exclusive-private-journal.jsonl>. No retry/resume. Offline controls use runBatch with synthetic ports.\n');return 0;}
 if(args.length!==2)return 2;let log,claim;
 try{const plan=readPlan(resolve(args[0]));verifyMethod(plan.methodSha256);claim=journal(resolve(args[0])+'.attempted');claim.append({allocationSha256:sha(JSON.stringify(plan)),atMs:Date.now()});claim.close();log=journal(resolve(args[1]));log.append({event:'allocation-started',allocationSha256:sha(JSON.stringify(plan)),limits:LIMITS});const result=await runBatch({plan,append:v=>log.append(v)});log.append({event:'product-batch-complete',...result});return 0;}
 catch(error){log?.append({event:'STOP_NO_RESEND',code:/^[A-Z0-9_]{1,100}$/.test(error?.code??'')?error.code:'QUALIFICATION_UNKNOWN'});return log?3:2;}
 finally{claim?.close();log?.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))process.exitCode=await main();
