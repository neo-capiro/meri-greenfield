/** One bounded Claude Agent SDK query per durable activity; no replacement model loop. */
import {query as sdkQuery} from '@anthropic-ai/claude-agent-sdk';
export {sdkQuery};
import {randomUUID,createHash} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {RUNNER_LOAD_STAGE_MAX_MS} from '../../../packages/runtime/runner-load-budget.mjs';
import {validateShape,canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertInstalledSkillManifest} from '../../../packages/contracts/retrieval-0.3/installed-skill.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {selectSkill} from '../../../packages/skills/index.mjs';
import {describeSkillPlugin} from '../../../packages/skills/plugin.mjs';
import {createTextProjector} from './text-projector.mjs';
import {createSdkReadAhead} from './sdk-read-ahead.mjs';
import {buildConversationOptions} from './options.mjs';
import {documentRevisionContextSuffix} from './document-revision.mjs';
import {prepareUploadReadSources} from './upload-sources.mjs';
import {requestContextSuffix} from './request-context.mjs';
import {assertAutomaticClientContext} from './automatic-client-context.mjs';
import {createConversationInput} from './continuation/input.mjs';
import {createActivityLifecycle,assertLifecycleConfiguration,HOLD_CHECKPOINT_FAILED} from './continuation/activity-lifecycle.mjs';
import {readCapabilityPolicy} from './capabilities/policy.mjs';
import {createSdkCapabilities} from './capabilities/index.mjs';
import {createNativeHookBatch} from './capabilities/hooks.mjs';
import {mergeHookSets} from './capabilities/fragment.mjs';
import {projectSdkUsage} from '../../../packages/contracts/runtime-0.2/usage.mjs';
import {createProgressProjector} from './capabilities/progress.mjs';
import {continuationSessionId} from './reads/runtime.mjs';
import {readRunBudgets} from './reads/budget.mjs';
import {createProfileMounts} from './capabilities/mounts.mjs';
import {prepareBrowserRun} from './browser/runtime.mjs';
import {attemptCleanup,cleanupConversation,CLEANUP_ATTEMPT_MS} from './cleanup.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fault=code=>Object.assign(new Error(code),{code});
// Trusted runtime-preparation facts the capability layer consumes; run data never supplies them.
const CAPABILITY_RUNTIME_FACTS=Object.freeze(['skillPluginDirectory','bashSandbox','bashEgress','bashApprovals','sdkConfigDirectory','sdkSecureStorageDirectory','brokerSocketDirectory']);
/** Acknowledgement bound for one terminal publication attempt: the control service's default per-request bound. Terminal
 * settlement makes at most two rounds over the (at most two) candidate events, so it is finite (here at most 12 s). */
export const TERMINAL_ATTEMPT_MS=3000;
/** Text one folded `message.delta` publication carries at most: even fully JSON-escaped it stays inside the 128 KiB event bound. */
export const DELTA_FOLD_MAX_BYTES=16384;
// A streamed text delta outside any subagent; only these fold, and only with deltas of the same content block.
const textDelta=m=>m?.type==='stream_event'&&!m.parent_tool_use_id&&m.event?.type==='content_block_delta'&&m.event.delta?.type==='text_delta';
export function createConversationActivity({runOwner,prepareRuntime,query=sdkQuery,heartbeat=()=>{},now=Date.now,newId=randomUUID,lifecycle,selectedSkills,procedures,siteWorkflows,generalReads,governedIntents,browser,objectiveGeneration,terminalAttemptMs=TERMINAL_ATTEMPT_MS,cleanupAttemptMs=CLEANUP_ATTEMPT_MS,loadMaxMs=3000,loadExpiresAtMs,runtimeMaxMs=3000,runtimeExpiresAtMs,setupBudget,modelDeadlineMs,executionDeadlineMs,diagnostics}){
 // Optional trusted observers cannot affect execution, publication or bounded cleanup.
 const diagnostic=(method,value)=>{try{Promise.resolve(diagnostics?.[method]?.(value)).catch(()=>{});}catch{}};
 if(['load','append'].some(k=>typeof runOwner?.[k]!=='function')||typeof prepareRuntime!=='function'||typeof query!=='function'||typeof heartbeat!=='function'||!Number.isSafeInteger(terminalAttemptMs)||terminalAttemptMs<1||terminalAttemptMs>30000)throw fault('ACTIVITY_CONFIGURATION');
 if(!Number.isSafeInteger(cleanupAttemptMs)||cleanupAttemptMs<1||cleanupAttemptMs>30000)throw fault('ACTIVITY_CONFIGURATION');
 if(!Number.isSafeInteger(loadMaxMs)||loadMaxMs<1||loadMaxMs>RUNNER_LOAD_STAGE_MAX_MS||loadExpiresAtMs!==undefined&&!Number.isSafeInteger(loadExpiresAtMs))throw fault('ACTIVITY_CONFIGURATION');
 if(!Number.isSafeInteger(runtimeMaxMs)||runtimeMaxMs<1||runtimeMaxMs>30000||runtimeExpiresAtMs!==undefined&&!Number.isSafeInteger(runtimeExpiresAtMs)||setupBudget!==undefined&&(!Number.isSafeInteger(setupBudget.maxMs)||setupBudget.maxMs<1||setupBudget.maxMs>30000||!Number.isSafeInteger(setupBudget.expiresAtMs)))throw fault('ACTIVITY_CONFIGURATION');
 if(executionDeadlineMs!==undefined&&(!Number.isSafeInteger(executionDeadlineMs)||executionDeadlineMs<1))throw fault('ACTIVITY_CONFIGURATION');
 if(modelDeadlineMs!==undefined&&(!Number.isSafeInteger(modelDeadlineMs)||modelDeadlineMs<1||executionDeadlineMs!==undefined&&modelDeadlineMs>=executionDeadlineMs))throw fault('ACTIVITY_CONFIGURATION');
 if(lifecycle!==undefined)assertLifecycleConfiguration(lifecycle,runOwner);
 if(selectedSkills!==undefined&&typeof selectedSkills.prepare!=='function')throw fault('SKILL_ACTIVITY_CONFIGURATION');
 if(procedures!==undefined&&typeof procedures.prepare!=='function')throw fault('PROCEDURE_ACTIVITY_CONFIGURATION');
 // Trusted gateway general-read port (`apps/gateway/general-reads/mount.mjs`); absent means no general read.
 if(generalReads!==undefined&&['readAvailability','execute'].some(k=>typeof generalReads[k]!=='function'))throw fault('READ_ACTIVITY_CONFIGURATION');
 // Trusted control intent port (`apps/control/intents/mount.mjs`); absent means no governed write request.
 if(governedIntents!==undefined&&['readAvailability','prepare'].some(k=>typeof governedIntents[k]!=='function'))throw fault('INTENT_ACTIVITY_CONFIGURATION');
 // Trusted browser runtime port (`browser/runtime.mjs`); absent means no browser. The activation gate stays authoritative.
 if(browser!==undefined&&typeof browser.policy!=='function')throw fault('BROWSER_ACTIVITY_CONFIGURATION');
 if(objectiveGeneration!==undefined&&typeof objectiveGeneration.prepare!=='function')throw fault('OBJECTIVE_ACTIVITY_CONFIGURATION');
 return async function executeConversation({binding,signal}){
  const nativeAudit=createNativeHookBatch();
  const drained=Promise.withResolvers();drained.promise.catch(()=>{});
  diagnostic('stage','activity-input');validateShape('RunBinding',binding);let preparation,life,setupLife,modelLife,stream,controls,input,skillRuntime,procedureRuntime,readRuntime,intentRuntime,uploadRuntime,browserRun,browserOutcome='ended',browserPreparationCleanupUnknown=false,skillOutput,terminalResult,usageBasis,usageAttempted=false,claimed=false,closed=false,resultSeen=false,bytes=0,heartbeatTimer;const controller=new AbortController();let failure;let closing,iterator;const closeQuery=()=>{if(!closing&&stream&&!closed){closed=true;closing=Promise.resolve().then(async()=>{await stream.close?.();
    // The pinned SDK's close() starts cleanup but returns void. Query.return()
   // awaits that same cleanup (including its transcript batch flush), then ends
   // the iterator. The fallback is for ordinary AsyncIterable test adapters.
   const owner=typeof stream.return==='function'?stream:iterator;
   if(typeof owner?.return==='function'){const end=await owner.return();if(end?.done!==true)throw fault('SDK_CLEANUP_UNKNOWN');}
   // No transient upload source bytes enter native workspace/checkpoint capture.
   await uploadRuntime?.close();
  });closing.catch(()=>{});}return closing;};
  async function recordUsage(result){
   // One bounded delivery by this claimant, including an unavailable result after SDK failure.
   // Set the guard before effects: an unknown acknowledgement must never cause another payload or query.
   if(!claimed||usageAttempted)return;usageAttempted=true;let attempt;
   try{attempt=createOperationLifetime({deadlineMs:now()+terminalAttemptMs,now,errorFactory:fault});
    if(typeof runOwner.recordUsage!=='function')throw fault('SDK_USAGE_UNAVAILABLE');let usage=null;
    try{usage=projectSdkUsage(result,usageBasis);}catch{}
    const receipt=await attempt.run(signal=>runOwner.recordUsage({binding,input:{usage,toolsUsed:nativeAudit.snapshot()},signal}));
    diagnostic('usage',receipt.status);
   }catch{diagnostic('usage','unavailable');}finally{attempt?.close();}
  }
  // Each operation keeps its own cap inside the original expiry. The model
  // leaves one completion allowance; local cleanup has independent bounds.
  try{diagnostic('stage','activity-load');preparation=createOperationLifetime({deadlineMs:Math.min(now()+loadMaxMs,loadExpiresAtMs??Infinity),now,signal,errorFactory:fault});const saved=await preparation.run(signal=>runOwner.load({binding,signal}));preparation.close();preparation=undefined;validateShape('Run',saved.run);if(!same(saved.run.binding,binding)||saved.run.state!=='queued')throw fault('RUN_NOT_QUEUED');
   if(saved.request.siteWorkflow&&(browser===undefined||typeof siteWorkflows?.resolve!=='function'))throw fault('SITE_WORKFLOW_BROWSER_UNAVAILABLE');
   diagnostic('stage','activity-policy');const policy=readCapabilityPolicy(saved); // Default-off SDK capabilities, validated before any claim; absent policy keeps first-chat behaviour.
   const runBudgets=readRunBudgets(saved); // The run's admitted allocation budgets bound the early read ledger; absent keeps its defaults.
   const prepareStarted=now();if(saved.continuation&&saved.nextTurn)throw fault('CONTINUATION_REFUSED');const lineage=saved.nextTurn?{nextTurn:saved.nextTurn}:saved.continuation?{continuation:saved.continuation}:null,sourceRequest=saved.nextTurn?.sourceRequest??saved.sourceRequest;if(lineage&&lifecycle===undefined)throw fault('CONTINUATION_UNAVAILABLE');
   // The claim is published as soon as this activity has verified the queued run, so `starting` covers runtime preparation and setup.
   // Failures after it settle through the terminal attempts below; only the claimant may terminalize.
    diagnostic('stage','activity-starting');preparation=createOperationLifetime({deadlineMs:Math.min(now()+runtimeMaxMs,runtimeExpiresAtMs??loadExpiresAtMs??Infinity),now,signal,errorFactory:fault});
    await preparation.run(signal=>runOwner.append({binding,event:{eventId:newId(),createdAt:new Date(now()).toISOString(),type:'run.status',data:{state:'starting',reasonCode:null}},signal}));preparation.check();preparation.close();claimed=true;
   // A run whose policy enables the skill plugin asks runtime preparation for its read-only plugin copy (the trusted skillPluginDirectory fact).
    diagnostic('stage','runtime-prepare');preparation=createOperationLifetime({deadlineMs:Math.min(now()+runtimeMaxMs,runtimeExpiresAtMs??loadExpiresAtMs??Infinity),now,signal,errorFactory:fault});const runtime=await preparation.run(signal=>prepareRuntime({binding,versions:saved.run.versions,model:saved.model,...(policy?.skillPlugin===true?{skillPlugin:true}:{}),...(policy===undefined?{}:{capabilityPolicy:policy}),
    request:saved.request,...(lineage?{...lineage,sourceRequest,scopes:saved.run.scopes}:{}),runtimeSignal:controller.signal,signal}));
    diagnostic('stage','activity-setup');life=createOperationLifetime({deadlineMs:Math.min(runtime.deadlineMs,executionDeadlineMs??Infinity),now,signal,errorFactory:fault});preparation.close();const abort=()=>controller.abort(life.signal.reason);life.signal.addEventListener('abort',abort,{once:true});
   const publish=async(type,data,eventId=newId())=>{life.check();await life.run(signal=>runOwner.append({binding,event:{eventId,createdAt:new Date(now()).toISOString(),type,data},signal}));life.check();};
    if(!same(runtime.binding,binding)||!same(runtime.versions,saved.run.versions))throw fault('RUNTIME_PIN_REFUSED');usageBasis=runtime.usageBasis;
   setupLife=setupBudget?createOperationLifetime({deadlineMs:Math.min(now()+setupBudget.maxMs,setupBudget.expiresAtMs),now,signal:life.signal,errorFactory:fault}):null;const setupRun=fn=>setupLife?setupLife.run(fn):life.run(fn);
   if(saved.request.skill&&selectedSkills!==undefined)skillRuntime=await setupRun(signal=>selectedSkills.prepare({binding,versions:saved.run.versions,request:saved.request,scopes:saved.run.scopes,...(lineage?{...lineage,sourceRequest}:{}),signal}));
   // Wave5 MO01/ST16: the persisted procedure selection is re-resolved for this exact run. Independent of any skill:
   // a procedure narrows guidance and the read surface and never replaces or widens the skill path above.
   if(saved.request.procedure&&procedures!==undefined)procedureRuntime=await setupRun(signal=>procedures.prepare({binding,versions:saved.run.versions,request:saved.request,scopes:saved.run.scopes,signal}));
   // G3: general reads and prepare-only write requests are mounted from the profile alone (capabilities/mounts.mjs): the full tool list
   // whenever the policy enables them, with or without a trusted port; per-run availability is answered per call (UNAVAILABLE).
   // A selected skill narrows general reads to its own operations; those the skill server already exposes are excluded. On resume/fork
   // the SDK session is pinned so a replayed tool use keeps its delivery identity.
   if(policy?.generalReads||policy?.governedIntents){const skill=saved.request.skill?selectSkill(saved.request.skill.skillId,saved.request.skill.skillVersion).manifest:undefined;
    const mounts=await setupRun(signal=>createProfileMounts({policy,binding,scopes:saved.run.scopes,now,deadlineMs:runtime.deadlineMs,...(generalReads===undefined?{}:{generalReads}),...(governedIntents===undefined?{}:{governedIntents}),
     ...(lineage?{expectedSessionId:continuationSessionId(lineage)}:{}),...(skill?{skill}:{}),...(procedureRuntime===undefined?{}:{procedure:procedureRuntime.policy}),exclude:skillRuntime?skillRuntime.selected.manifest.allowedOperations:[],...(runBudgets===undefined?{}:{runBudgets}),signal}));
    readRuntime=mounts.reads??undefined;intentRuntime=mounts.intents??undefined;}
   // The run owner's child port is the only durable child crossing: the SDK's Agent admission persists the assignment
   // identity and the current goal revision before the child is dispatched, and the child result receipt before the
   // parent is acknowledged. Without that port no Agent call is admitted (capabilities/index.mjs).
   const childAssignments=typeof runOwner.dispatchChild==='function'&&typeof runOwner.settleChild==='function'?Object.freeze({
    dispatch:input=>runOwner.dispatchChild({binding,input}),settle:input=>runOwner.settleChild({binding,input})}):undefined;
   const capabilities=policy===undefined?undefined:createSdkCapabilities(policy,{runOwner,binding,cwd:runtime.cwd,...(childAssignments===undefined?{}:{childAssignments}),...Object.fromEntries(CAPABILITY_RUNTIME_FACTS.flatMap(k=>runtime[k]===undefined?[]:[[k,runtime[k]]])),now,newId});
   if(browser!==undefined){
    // The lifetime may reject before the preparation promise settles. Keep ownership of a late run handle so it can
    // still be cleaned up; until then the outcome is unknown and the disposable host must be quarantined.
    let settled=false,abandoned=false,prepared;
    const prepare=async signal=>{try{prepared=await prepareBrowserRun({port:browser,binding,cwd:runtime.cwd,deadlineMs:runtime.deadlineMs,now,signal,siteWorkflow:saved.request.siteWorkflow,siteWorkflows});
     if(abandoned)await prepared.settle({outcome:'cancelled'});return prepared;}
     catch(error){browserPreparationCleanupUnknown ||= error?.code==='BROWSER_CLEANUP_UNKNOWN';throw error;}
     finally{settled=true;}};
    try{browserRun=await setupRun(prepare);}
    catch(error){abandoned=true;if(prepared)browserRun=prepared;else if(!settled)browserPreparationCleanupUnknown=true;throw error;}
   }
   const objectiveRuntime=objectiveGeneration===undefined?null:await setupRun(signal=>objectiveGeneration.prepare({binding,request:saved.request,versions:saved.run.versions,scopes:saved.run.scopes,cwd:runtime.cwd,model:runtime.model,deadlineMs:runtime.deadlineMs,signal}));
   if(objectiveRuntime){if(lineage||saved.request.skill||typeof lifecycle?.captureCompletion!=='function'||typeof objectiveRuntime.capture!=='function')throw fault('OBJECTIVE_COMPLETION_UNAVAILABLE');life.limitDeadline(objectiveRuntime.deadlineMs);}
   const {automaticClientContext,...sdkRuntime}=runtime;
   uploadRuntime=await setupRun(()=>prepareUploadReadSources({binding,request:saved.request,manifests:saved.uploadSources,runOwner,cwd:runtime.cwd,deadlineMs:runtime.deadlineMs,signal:life.signal,now,abort:error=>controller.abort(error)}));
   if(automaticClientContext!=null)assertAutomaticClientContext(automaticClientContext,{binding,scopes:saved.run.scopes});
   const options=buildConversationOptions(sdkRuntime,controller,lineage?{...lineage,request:saved.request,
    sourceRequest,scopes:saved.run.scopes,started:prepareStarted,now}:undefined,skillRuntime?.sdkOptions,capabilities?.options,readRuntime?.sdkOptions??undefined,intentRuntime?.sdkOptions??undefined,browserRun?.fragment,objectiveRuntime?.outputFormat);if(lineage&&!saved.nextTurn?.sdkSession&&saved.continuation?.kind!=='native-session')life.limitDeadline(runtime.restoreReceipt.expiresAtMs);let selected;
   if(saved.request.skill){
    selected=selectSkill(saved.request.skill.skillId,saved.request.skill.skillVersion);if(!same(selected.pin,saved.request.skill))throw fault('SKILL_PIN_REFUSED');
    if(skillRuntime){if(!same(skillRuntime.selected,selected)||typeof skillRuntime.finish!=='function'||typeof skillRuntime.close!=='function')throw fault('SKILL_RUNTIME_REFUSED');}
    else if(selectedSkills!==undefined){
     const nativeSkill=describeSkillPlugin({selection:selected.pin}).skills.find(s=>s.skillId===selected.pin.skillId&&s.skillVersion===selected.pin.skillVersion);
     if(!nativeSkill||!policy?.skillPlugin||!policy.generalReads||generalReads===undefined||!runtime.skillPluginDirectory||policy.skillNames!==null&&!policy.skillNames.includes(nativeSkill.name))throw fault('SKILL_RUNTIME_REFUSED');
    }else assertInstalledSkillManifest(selected.manifest,catalog);
    options.maxTurns=Math.min(options.maxTurns,selected.manifest.budgets.maxTurns);options.maxBudgetUsd=Math.min(options.maxBudgetUsd,selected.manifest.budgets.maxCostMicroUSD/1000000);life.limitDeadline(now()+selected.manifest.budgets.maxRuntimeSeconds*1000);options.systemPrompt.append+='\n'+selected.prose;
   }
   // Add application context to the full native preset, never replace the SDK system prompt.
   options.systemPrompt.append+=requestContextSuffix({window:saved.request.window,scopes:saved.run.scopes,skill:saved.request.skill,automaticClientContext});
   options.systemPrompt.append+=documentRevisionContextSuffix(saved.request,saved.documentRevisionContext);
   if(uploadRuntime)options.systemPrompt.append+=uploadRuntime.prompt;
   // Wave5 MO01/ST16: the resolved procedure is appended as data that grants no additional authority, and the
   // narrowing can only remove a mounted Capiro read tool the procedure did not grant — never add or widen one.
   if(procedureRuntime){options.systemPrompt.append+=procedureRuntime.systemPromptAppend;options.allowedTools=procedureRuntime.narrow(options.allowedTools);}
    options.hooks=mergeHookSets([options.hooks??{},uploadRuntime?.hooks??{},nativeAudit.hooks]);
    setupLife?.check();setupLife?.close();setupLife=undefined;
    diagnostic('stage','activity-running');await publish('run.status',{state:'running',reasonCode:null});
   heartbeatTimer=setInterval(()=>{try{heartbeat({runId:binding.runId});}catch{controller.abort();}},5000);heartbeatTimer.unref?.();
   // query owns tool selection, compaction and the model loop. Its returned stream is consumed once.
    diagnostic('stage','activity-query');modelLife=modelDeadlineMs===undefined?null:createOperationLifetime({deadlineMs:Math.min(modelDeadlineMs,runtime.deadlineMs-terminalAttemptMs),now,signal:life.signal,errorFactory:fault});if(lifecycle!==undefined)input=createConversationInput({requestId:saved.request.requestId,prompt:saved.request.prompt});
   stream=query({prompt:input?.prompt??saved.request.prompt,options});if(typeof stream?.[Symbol.asyncIterator]!=='function')throw fault('SDK_STREAM_REFUSED');iterator=stream[Symbol.asyncIterator]();const textParts=createTextProjector(newId),progressParts=createProgressProjector({policy,newId});
   // Every display publication is a full authorization round at control (seconds), so the deltas the SDK produced meanwhile join the
   // next one instead of each waiting for its own. Each folded message is still observed, projected and counted in order; nothing is
   // read past a result, and a message read early is used only while a read could still be made (deadline, lifecycle failure).
   const readLife=modelLife??life,ahead=createSdkReadAhead(()=>readLife.run(()=>iterator.next()),{last:m=>m?.type==='result',check:()=>{readLife.check();controls?.check();uploadRuntime?.check();}});
   async function foldDeltas(first,text){
    for(let m=ahead.peek();textDelta(m)&&m.event.index===first.event.index&&Buffer.byteLength(text)<DELTA_FOLD_MAX_BYTES;m=ahead.peek()){
     ahead.take();capabilities?.check();uploadRuntime?.check();await controls?.observe(m);if(controls?.isHeld())break;
     for(const part of textParts(m)){bytes+=Buffer.byteLength(part.text);if(bytes>runtime.maxOutputBytes)throw fault('OUTPUT_LIMIT');capabilities?.check();uploadRuntime?.check();text+=part.text;}
    }
    return text;
   }
   if(lifecycle!==undefined)controls=createActivityLifecycle({config:lifecycle,runOwner,binding,saved,runtime,input,
    query:{interrupt:()=>stream.interrupt(),close:closeQuery,drain:()=>drained.promise},life,now});
    while(true){diagnostic('stage','activity-stream');let next;try{next=await (controls?Promise.race([ahead.next(),controls.failure.then(error=>{throw error;})]):ahead.next());}
    catch(error){drained.reject(error);if(controls?.isHeld()){capabilities?.check();uploadRuntime?.check();return await controls.heldResult();}throw error;}if(next.done){drained.reject(fault('SDK_RESULT_MISSING'));break;}const m=next.value;
    capabilities?.check();uploadRuntime?.check(); // A latched capability/hook failure stops observation, checkpointing and output before this frame is used.
    if(m?.type==='system'&&m.subtype==='init')runtime.sessionStore.observeInit?.(m);
    if(m?.type==='system'&&m.subtype==='mirror_error')throw fault('SESSION_PERSISTENCE_FAILED');
    await controls?.observe(m);if(controls?.isHeld()){
     if(m?.type==='result'&&!m.parent_tool_use_id){if(resultSeen)throw fault('SDK_RESULT_DUPLICATE');resultSeen=true;terminalResult=m;await recordUsage(m);drained.resolve();return await controls.heldResult();}
     continue;
    }
    if(m?.parent_tool_use_id)continue; // Subagent/internal content is never a display event; only policy-admitted progress summaries are.
    // A refused display publication may be a committed pause/approval hold the control reader has not yet
    // claimed: the lifecycle fences output and settles it through the checkpoint, never a generic close.
    for(const part of [...textParts(m),...progressParts(m)]){if(controls?.isHeld())break;bytes+=Buffer.byteLength(part.text);if(bytes>runtime.maxOutputBytes)throw fault('OUTPUT_LIMIT');capabilities?.check();uploadRuntime?.check();
     const text=textDelta(m)?await foldDeltas(m,part.text):part.text;if(controls?.isHeld())break;
     diagnostic('stage','activity-output');try{await ahead.during(()=>publish('message.delta',{messageId:part.messageId,text}));}catch(error){if(!controls?.fence())throw error;}diagnostic('stage','activity-stream');}
    if(controls?.isHeld())continue;
    if(m?.type==='result'){diagnostic('stage','activity-result');if(resultSeen)throw fault('SDK_RESULT_DUPLICATE');resultSeen=true;terminalResult=m;await recordUsage(m);drained.resolve();if(m.subtype!=='success'||m.is_error!==false)throw fault('SDK_EXECUTION_FAILED');capabilities?.check();uploadRuntime?.check();if(controls||skillRuntime){diagnostic('stage','activity-finalize');if(controls?.canCaptureCompletion())await controls.finish({keepInputOpen:true});else {input?.close();await controls?.finish();}break;}}
    // Thinking, raw tool arguments, SDK errors and provider diagnostics are never forwarded.
   }
    diagnostic('stage','activity-finalize');capabilities?.check();uploadRuntime?.check();if(controls?.isHeld())return await controls.heldResult();controls?.check();if(!resultSeen)throw fault('SDK_RESULT_MISSING');if(skillRuntime){skillOutput=await life.run(()=>skillRuntime.finish(terminalResult));if(typeof selectedSkills.publish!=='function')throw fault('OUTPUT_PUBLICATION_UNAVAILABLE');await life.run(signal=>selectedSkills.publish({binding,output:skillOutput,signal}));}
   const typedResult=objectiveRuntime?await life.run(signal=>objectiveRuntime.capture({sdkResult:terminalResult,signal})):undefined;
   diagnostic('stage','activity-complete');if(controls?.canCaptureCompletion())await controls.captureCompletion(typedResult);else await publish('run.status',{state:'completed',reasonCode:null});return {state:'completed',...(skillOutput===undefined?{}:{output:skillOutput})};
  }catch(error){diagnostic('failure',error);failure=error;browserPreparationCleanupUnknown ||= error?.code==='BROWSER_CLEANUP_UNKNOWN';diagnostic('stage','activity-cleanup');controller.abort();clearInterval(heartbeatTimer);await attemptCleanup(closeQuery,{now,timeoutMs:cleanupAttemptMs,onFailure:error=>diagnostic('failure',error)});const cancelled=signal?.aborted||life?.signal.aborted;browserOutcome=cancelled?'cancelled':'failed';modelLife?.close();setupLife?.close();life?.close();preparation?.close();
   // A denied/unknown starting claimant cannot terminalize another admitted activity.
   // A held run refuses the ordinary terminal event and admits only the explicit uncheckpointed-hold failure, which
   // the store verifies against this run's unapplied pause/approval control (and refuses without one). The local
   // hold view only orders the attempts; the durable owner decides which one is true. Each candidate keeps one event ID,
   // so the second round is an idempotent replay that reads back a write whose acknowledgement was lost. When nothing
   // is acknowledged the run stays nonterminal, and the run reconciler settles it after the original is retired.
    if(claimed){diagnostic('stage','activity-terminal');const ordinary={state:cancelled?'cancelled':'failed',reasonCode:cancelled?'EXECUTION_STOPPED':'EXECUTION_FAILED'},hold={state:'failed',reasonCode:HOLD_CHECKPOINT_FAILED},createdAt=new Date(now()).toISOString();
    const candidates=(controls?.isHeld()?[hold,ordinary]:[ordinary,hold]).map(data=>({eventId:newId(),createdAt,type:'run.status',data}));
    const terminal=async event=>{const attempt=createOperationLifetime({deadlineMs:now()+terminalAttemptMs,now,errorFactory:fault});try{await attempt.run(signal=>runOwner.append({binding,event,signal}));return true;}catch{return false;}finally{attempt.close();}};
    settle:for(let round=0;round<2;round++)for(const event of candidates)if(await terminal(event))break settle;
    // Preparation can fail while starting; the existing store admits usage only after terminalization.
    await recordUsage();}
   throw fault(cancelled?'EXECUTION_STOPPED':'EXECUTION_FAILED');
  }finally{diagnostic('stage','activity-cleanup');clearInterval(heartbeatTimer);controller.abort(failure);let known=false;
   try{known=await cleanupConversation({skillRuntime,readRuntime,intentRuntime,uploadRuntime,controls,input,closeQuery,browserRun,browserOutcome,now,timeoutMs:cleanupAttemptMs,onFailure:error=>diagnostic('failure',error)});}
   catch(error){diagnostic('failure',error);throw error;}finally{modelLife?.close();setupLife?.close();life?.close();preparation?.close();}if(!known||browserPreparationCleanupUnknown){const error=fault('SDK_CLEANUP_UNKNOWN');diagnostic('failure',error);throw error;}}
 };
}
