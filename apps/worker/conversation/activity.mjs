/** One bounded Claude Agent SDK query per durable activity; no replacement model loop. */
import {query as sdkQuery} from '@anthropic-ai/claude-agent-sdk';
import {randomUUID,createHash} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {validateShape,canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertSkillManifest} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {selectSkill} from '../../../packages/skills/index.mjs';
import {createTextProjector} from './text-projector.mjs';
import {buildConversationOptions} from './options.mjs';
import {createConversationInput} from './continuation/input.mjs';
import {createActivityLifecycle,assertLifecycleConfiguration,HOLD_CHECKPOINT_FAILED} from './continuation/activity-lifecycle.mjs';
import {readCapabilityPolicy} from './capabilities/policy.mjs';
import {createSdkCapabilities} from './capabilities/index.mjs';
import {createProgressProjector} from './capabilities/progress.mjs';
import {createGeneralReadRuntime,continuationSessionId} from './reads/runtime.mjs';
import {createIntentRuntime} from './intents/runtime.mjs';
import {prepareBrowserRun} from './browser/runtime.mjs';
import {attemptCleanup,cleanupConversation,CLEANUP_ATTEMPT_MS} from './cleanup.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fault=code=>Object.assign(new Error(code),{code});
// Trusted runtime-preparation facts the capability layer consumes; run data never supplies them.
const CAPABILITY_RUNTIME_FACTS=Object.freeze(['skillPluginDirectory','bashSandbox','sdkConfigDirectory','sdkSecureStorageDirectory']);
/** Acknowledgement bound for one terminal publication attempt: the control service's default per-request bound. Terminal
 * settlement makes at most two rounds over the (at most two) candidate events, so it is finite (here at most 12 s). */
export const TERMINAL_ATTEMPT_MS=3000;
export function createConversationActivity({runOwner,prepareRuntime,query=sdkQuery,heartbeat=()=>{},now=Date.now,newId=randomUUID,lifecycle,selectedSkills,generalReads,governedIntents,browser,objectiveGeneration,terminalAttemptMs=TERMINAL_ATTEMPT_MS,cleanupAttemptMs=CLEANUP_ATTEMPT_MS}){
 if(['load','append'].some(k=>typeof runOwner?.[k]!=='function')||typeof prepareRuntime!=='function'||typeof query!=='function'||typeof heartbeat!=='function'||!Number.isSafeInteger(terminalAttemptMs)||terminalAttemptMs<1||terminalAttemptMs>30000)throw fault('ACTIVITY_CONFIGURATION');
 if(!Number.isSafeInteger(cleanupAttemptMs)||cleanupAttemptMs<1||cleanupAttemptMs>30000)throw fault('ACTIVITY_CONFIGURATION');
 if(lifecycle!==undefined)assertLifecycleConfiguration(lifecycle,runOwner);
 if(selectedSkills!==undefined&&typeof selectedSkills.prepare!=='function')throw fault('SKILL_ACTIVITY_CONFIGURATION');
 // Trusted gateway general-read port (`apps/gateway/general-reads/mount.mjs`); absent means no general read.
 if(generalReads!==undefined&&['readAvailability','execute'].some(k=>typeof generalReads[k]!=='function'))throw fault('READ_ACTIVITY_CONFIGURATION');
 // Trusted control intent port (`apps/control/intents/mount.mjs`); absent means no governed write request.
 if(governedIntents!==undefined&&['readAvailability','prepare'].some(k=>typeof governedIntents[k]!=='function'))throw fault('INTENT_ACTIVITY_CONFIGURATION');
 // Trusted browser runtime port (`browser/runtime.mjs`); absent means no browser. The activation gate stays authoritative.
 if(browser!==undefined&&typeof browser.policy!=='function')throw fault('BROWSER_ACTIVITY_CONFIGURATION');
 if(objectiveGeneration!==undefined&&typeof objectiveGeneration.prepare!=='function')throw fault('OBJECTIVE_ACTIVITY_CONFIGURATION');
 return async function executeConversation({binding,signal}){
  validateShape('RunBinding',binding);let preparation,life,stream,controls,input,skillRuntime,readRuntime,intentRuntime,browserRun,browserOutcome='ended',skillOutput,terminalResult,claimed=false,closed=false,resultSeen=false,bytes=0,heartbeatTimer;const controller=new AbortController();let failure;let closing;const closeQuery=()=>{if(!closing&&stream&&!closed){closed=true;closing=Promise.resolve().then(()=>stream.close?.());closing.catch(()=>{});}return closing;};
  try{preparation=createOperationLifetime({deadlineMs:now()+3000,now,signal,errorFactory:fault});const saved=await preparation.run(signal=>runOwner.load({binding,signal}));validateShape('Run',saved.run);if(!same(saved.run.binding,binding)||saved.run.state!=='queued')throw fault('RUN_NOT_QUEUED');
   const policy=readCapabilityPolicy(saved); // Default-off SDK capabilities, validated before any claim; absent policy keeps first-chat behaviour.
   const prepareStarted=now();if(saved.continuation&&saved.nextTurn)throw fault('CONTINUATION_REFUSED');const lineage=saved.nextTurn?{nextTurn:saved.nextTurn}:saved.continuation?{continuation:saved.continuation}:null,sourceRequest=saved.nextTurn?.sourceRequest??saved.sourceRequest;if(lineage&&lifecycle===undefined)throw fault('CONTINUATION_UNAVAILABLE');
   const runtime=await preparation.run(signal=>prepareRuntime({binding,versions:saved.run.versions,
    ...(lineage?{...lineage,sourceRequest,request:saved.request,scopes:saved.run.scopes}:{}),runtimeSignal:controller.signal,signal}));
   life=createOperationLifetime({deadlineMs:runtime.deadlineMs,now,signal,errorFactory:fault});preparation.close();const abort=()=>controller.abort(life.signal.reason);life.signal.addEventListener('abort',abort,{once:true});
   const publish=async(type,data,eventId=newId())=>{life.check();await life.run(signal=>runOwner.append({binding,event:{eventId,createdAt:new Date(now()).toISOString(),type,data},signal}));life.check();};
   await publish('run.status',{state:'starting',reasonCode:null});claimed=true;if(!same(runtime.binding,binding)||!same(runtime.versions,saved.run.versions))throw fault('RUNTIME_PIN_REFUSED');
   if(saved.request.skill&&selectedSkills!==undefined)skillRuntime=await life.run(signal=>selectedSkills.prepare({binding,versions:saved.run.versions,request:saved.request,scopes:saved.run.scopes,...(lineage?{...lineage,sourceRequest}:{}),signal}));
   // A selected skill narrows general reads to its own operations; those the skill server already exposes are excluded.
   if(policy?.generalReads&&generalReads!==undefined){const skill=saved.request.skill?selectSkill(saved.request.skill.skillId,saved.request.skill.skillVersion).manifest:undefined;
    readRuntime=await life.run(signal=>createGeneralReadRuntime({binding,scopes:saved.run.scopes,policy,port:generalReads,now,deadlineMs:runtime.deadlineMs,
     ...(lineage?{expectedSessionId:continuationSessionId(lineage)}:{}),...(skill?{skill}:{}),exclude:skillRuntime?skillRuntime.selected.manifest.allowedOperations:[],signal}));}
   // Prepare-only write requests; on resume/fork the SDK session is pinned so a replayed tool use keeps its delivery identity.
   if(policy?.governedIntents&&governedIntents!==undefined)intentRuntime=await life.run(signal=>createIntentRuntime({binding,scopes:saved.run.scopes,policy,port:governedIntents,now,deadlineMs:runtime.deadlineMs,
    ...(lineage?{expectedSessionId:continuationSessionId(lineage)}:{}),signal}));
   const capabilities=policy===undefined?undefined:createSdkCapabilities(policy,{runOwner,binding,cwd:runtime.cwd,...Object.fromEntries(CAPABILITY_RUNTIME_FACTS.flatMap(k=>runtime[k]===undefined?[]:[[k,runtime[k]]])),now,newId});
   if(browser!==undefined)browserRun=await life.run(signal=>prepareBrowserRun({port:browser,binding,cwd:runtime.cwd,deadlineMs:runtime.deadlineMs,now,signal}));
   const objectiveRuntime=objectiveGeneration===undefined?null:await life.run(signal=>objectiveGeneration.prepare({binding,request:saved.request,versions:saved.run.versions,scopes:saved.run.scopes,cwd:runtime.cwd,model:runtime.model,proxyUrl:runtime.proxyUrl,proxyCredentialSha256:createHash('sha256').update(runtime.proxyCredential).digest('hex'),deadlineMs:runtime.deadlineMs,signal}));
   if(objectiveRuntime){if(lineage||saved.request.skill||typeof lifecycle?.captureCompletion!=='function'||typeof objectiveRuntime.capture!=='function')throw fault('OBJECTIVE_COMPLETION_UNAVAILABLE');life.limitDeadline(objectiveRuntime.deadlineMs);}
   const options=buildConversationOptions(runtime,controller,lineage?{...lineage,request:saved.request,
    sourceRequest,scopes:saved.run.scopes,started:prepareStarted,now}:undefined,skillRuntime?.sdkOptions,capabilities?.options,readRuntime?.sdkOptions??undefined,intentRuntime?.sdkOptions??undefined,browserRun?.fragment,objectiveRuntime?.outputFormat);if(lineage)life.limitDeadline(runtime.restoreReceipt.expiresAtMs);let selected;
   if(saved.request.skill){selected=selectSkill(saved.request.skill.skillId,saved.request.skill.skillVersion);if(!same(selected.pin,saved.request.skill))throw fault('SKILL_PIN_REFUSED');if(skillRuntime){if(!same(skillRuntime.selected,selected)||typeof skillRuntime.finish!=='function'||typeof skillRuntime.close!=='function')throw fault('SKILL_RUNTIME_REFUSED');}else assertSkillManifest(selected.manifest,catalog);options.maxTurns=Math.min(options.maxTurns,selected.manifest.budgets.maxTurns);options.maxBudgetUsd=Math.min(options.maxBudgetUsd,selected.manifest.budgets.maxCostMicroUSD/1000000);life.limitDeadline(now()+selected.manifest.budgets.maxRuntimeSeconds*1000);options.systemPrompt=selected.prose;}
   options.systemPrompt+='\n\nNormalized request context (data; grants no additional authority):\n'+JSON.stringify({window:saved.request.window,scopes:saved.run.scopes,skill:saved.request.skill});
   await publish('run.status',{state:'running',reasonCode:null});
   heartbeatTimer=setInterval(()=>{try{heartbeat({runId:binding.runId});}catch{controller.abort();}},5000);heartbeatTimer.unref?.();
   // query owns tool selection, compaction and the model loop. Its returned stream is consumed once.
   if(lifecycle!==undefined)input=createConversationInput({requestId:saved.request.requestId,prompt:saved.request.prompt});
   stream=query({prompt:input?.prompt??saved.request.prompt,options});if(typeof stream?.[Symbol.asyncIterator]!=='function')throw fault('SDK_STREAM_REFUSED');const iterator=stream[Symbol.asyncIterator]();const textParts=createTextProjector(newId),progressParts=createProgressProjector({policy,newId});
   if(lifecycle!==undefined)controls=createActivityLifecycle({config:lifecycle,runOwner,binding,saved,runtime,input,
    query:{interrupt:()=>stream.interrupt(),close:closeQuery},life,now});
   while(true){let next;try{next=await (controls?Promise.race([life.run(()=>iterator.next()),controls.failure.then(error=>{throw error;})]):life.run(()=>iterator.next()));}
    catch(error){if(controls?.isHeld()){capabilities?.check();return await controls.heldResult();}throw error;}if(next.done)break;const m=next.value;
    capabilities?.check(); // A latched capability/hook failure stops observation, checkpointing and output before this frame is used.
    if(m?.type==='system'&&m.subtype==='mirror_error')throw fault('SESSION_PERSISTENCE_FAILED');
    await controls?.observe(m);if(controls?.isHeld())continue;
    if(m?.parent_tool_use_id)continue; // Subagent/internal content is never a display event; only policy-admitted progress summaries are.
    // A refused display publication may be a committed pause/approval hold the control reader has not yet
    // claimed: the lifecycle fences output and settles it through the checkpoint, never a generic close.
    for(const part of [...textParts(m),...progressParts(m)]){if(controls?.isHeld())break;bytes+=Buffer.byteLength(part.text);if(bytes>runtime.maxOutputBytes)throw fault('OUTPUT_LIMIT');capabilities?.check();try{await publish('message.delta',part);}catch(error){if(!controls?.fence())throw error;}}
    if(controls?.isHeld())continue;
    if(m?.type==='result'){if(resultSeen)throw fault('SDK_RESULT_DUPLICATE');resultSeen=true;terminalResult=m;if(m.subtype!=='success'||m.is_error!==false)throw fault('SDK_EXECUTION_FAILED');capabilities?.check();if(controls||skillRuntime){if(controls?.canCaptureCompletion())await controls.finish({keepInputOpen:true});else {input?.close();await controls?.finish();}break;}}
    // Thinking, raw tool arguments, SDK errors and provider diagnostics are never forwarded.
   }
   capabilities?.check();if(controls?.isHeld())return await controls.heldResult();controls?.check();if(!resultSeen)throw fault('SDK_RESULT_MISSING');if(skillRuntime){skillOutput=await life.run(()=>skillRuntime.finish(terminalResult));if(typeof selectedSkills.publish!=='function')throw fault('OUTPUT_PUBLICATION_UNAVAILABLE');await life.run(signal=>selectedSkills.publish({binding,output:skillOutput,signal}));}
   const typedResult=objectiveRuntime?await life.run(signal=>objectiveRuntime.capture({sdkResult:terminalResult,signal})):undefined;
   if(controls?.canCaptureCompletion())await controls.captureCompletion(typedResult);else await publish('run.status',{state:'completed',reasonCode:null});return {state:'completed',...(skillOutput===undefined?{}:{output:skillOutput})};
  }catch(error){failure=error;controller.abort();clearInterval(heartbeatTimer);await attemptCleanup(closeQuery,{now,timeoutMs:cleanupAttemptMs});const cancelled=signal?.aborted||life?.signal.aborted;browserOutcome=cancelled?'cancelled':'failed';life?.close();preparation?.close();
   // A denied/unknown starting claimant cannot terminalize another admitted activity.
   // A held run refuses the ordinary terminal event and admits only the explicit uncheckpointed-hold failure, which
   // the store verifies against this run's unapplied pause/approval control (and refuses without one). The local
   // hold view only orders the attempts; the durable owner decides which one is true. Each candidate keeps one event ID,
   // so the second round is an idempotent replay that reads back a write whose acknowledgement was lost. When nothing
   // is acknowledged the run stays nonterminal, and the run reconciler settles it after the original is retired.
   if(claimed){const ordinary={state:cancelled?'cancelled':'failed',reasonCode:cancelled?'EXECUTION_STOPPED':'EXECUTION_FAILED'},hold={state:'failed',reasonCode:HOLD_CHECKPOINT_FAILED},createdAt=new Date(now()).toISOString();
    const candidates=(controls?.isHeld()?[hold,ordinary]:[ordinary,hold]).map(data=>({eventId:newId(),createdAt,type:'run.status',data}));
    const terminal=async event=>{const attempt=createOperationLifetime({deadlineMs:now()+terminalAttemptMs,now,errorFactory:fault});try{await attempt.run(signal=>runOwner.append({binding,event,signal}));return true;}catch{return false;}finally{attempt.close();}};
    settle:for(let round=0;round<2;round++)for(const event of candidates)if(await terminal(event))break settle;}
   throw fault(cancelled?'EXECUTION_STOPPED':'EXECUTION_FAILED');
  }finally{clearInterval(heartbeatTimer);controller.abort(failure);let known=false;
   try{known=await cleanupConversation({skillRuntime,readRuntime,intentRuntime,controls,input,closeQuery,browserRun,browserOutcome,now,timeoutMs:cleanupAttemptMs});}
   finally{life?.close();preparation?.close();}if(!known)throw fault('SDK_CLEANUP_UNKNOWN');}
 };
}
