/** One bounded Claude Agent SDK query per durable activity; no replacement model loop. */
import {query as sdkQuery} from '@anthropic-ai/claude-agent-sdk';
import {randomUUID} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {validateShape,canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertSkillManifest} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {selectSkill} from '../../../packages/skills/index.mjs';
import {createTextProjector} from './text-projector.mjs';
import {buildConversationOptions} from './options.mjs';
import {createConversationInput} from './continuation/input.mjs';
import {createActivityLifecycle,assertLifecycleConfiguration} from './continuation/activity-lifecycle.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fault=code=>Object.assign(new Error(code),{code});
export function createConversationActivity({runOwner,prepareRuntime,query=sdkQuery,heartbeat=()=>{},now=Date.now,newId=randomUUID,lifecycle,selectedSkills}){
 if(['load','append'].some(k=>typeof runOwner?.[k]!=='function')||typeof prepareRuntime!=='function'||typeof query!=='function'||typeof heartbeat!=='function')throw fault('ACTIVITY_CONFIGURATION');
 if(lifecycle!==undefined)assertLifecycleConfiguration(lifecycle,runOwner);
 if(selectedSkills!==undefined&&typeof selectedSkills.prepare!=='function')throw fault('SKILL_ACTIVITY_CONFIGURATION');
 return async function executeConversation({binding,signal}){
  validateShape('RunBinding',binding);let preparation,life,stream,controls,input,skillRuntime,skillOutput,terminalResult,claimed=false,closed=false,resultSeen=false,bytes=0,heartbeatTimer;const controller=new AbortController();let failure;let closing;const closeQuery=()=>{if(!closing&&stream&&!closed){closed=true;closing=Promise.resolve().then(()=>stream.close?.());closing.catch(()=>{});}return closing;};
  try{preparation=createOperationLifetime({deadlineMs:now()+3000,now,signal,errorFactory:fault});const saved=await preparation.run(signal=>runOwner.load({binding,signal}));validateShape('Run',saved.run);if(!same(saved.run.binding,binding)||saved.run.state!=='queued')throw fault('RUN_NOT_QUEUED');
   const prepareStarted=now();if(saved.continuation&&saved.nextTurn)throw fault('CONTINUATION_REFUSED');const lineage=saved.nextTurn?{nextTurn:saved.nextTurn}:saved.continuation?{continuation:saved.continuation}:null,sourceRequest=saved.nextTurn?.sourceRequest??saved.sourceRequest;if(lineage&&lifecycle===undefined)throw fault('CONTINUATION_UNAVAILABLE');
   const runtime=await preparation.run(signal=>prepareRuntime({binding,versions:saved.run.versions,
    ...(lineage?{...lineage,sourceRequest,request:saved.request,scopes:saved.run.scopes}:{}),runtimeSignal:controller.signal,signal}));
   life=createOperationLifetime({deadlineMs:runtime.deadlineMs,now,signal,errorFactory:fault});preparation.close();const abort=()=>controller.abort(life.signal.reason);life.signal.addEventListener('abort',abort,{once:true});
   const publish=async(type,data,eventId=newId())=>{life.check();await life.run(signal=>runOwner.append({binding,event:{eventId,createdAt:new Date(now()).toISOString(),type,data},signal}));life.check();};
   await publish('run.status',{state:'starting',reasonCode:null});claimed=true;if(!same(runtime.binding,binding)||!same(runtime.versions,saved.run.versions))throw fault('RUNTIME_PIN_REFUSED');
   if(saved.request.skill&&selectedSkills!==undefined)skillRuntime=await life.run(signal=>selectedSkills.prepare({binding,versions:saved.run.versions,request:saved.request,scopes:saved.run.scopes,...(lineage?{...lineage,sourceRequest}:{}),signal}));
   const options=buildConversationOptions(runtime,controller,lineage?{...lineage,request:saved.request,
    sourceRequest,scopes:saved.run.scopes,started:prepareStarted,now}:undefined,skillRuntime?.sdkOptions);if(lineage)life.limitDeadline(runtime.restoreReceipt.expiresAtMs);let selected;
   if(saved.request.skill){selected=selectSkill(saved.request.skill.skillId,saved.request.skill.skillVersion);if(!same(selected.pin,saved.request.skill))throw fault('SKILL_PIN_REFUSED');if(skillRuntime){if(!same(skillRuntime.selected,selected)||typeof skillRuntime.finish!=='function'||typeof skillRuntime.close!=='function')throw fault('SKILL_RUNTIME_REFUSED');}else assertSkillManifest(selected.manifest,catalog);options.maxTurns=Math.min(options.maxTurns,selected.manifest.budgets.maxTurns);options.maxBudgetUsd=Math.min(options.maxBudgetUsd,selected.manifest.budgets.maxCostMicroUSD/1000000);life.limitDeadline(now()+selected.manifest.budgets.maxRuntimeSeconds*1000);options.systemPrompt=selected.prose;}
   options.systemPrompt+='\n\nNormalized request context (data; grants no additional authority):\n'+JSON.stringify({window:saved.request.window,scopes:saved.run.scopes,skill:saved.request.skill});
   await publish('run.status',{state:'running',reasonCode:null});
   heartbeatTimer=setInterval(()=>{try{heartbeat({runId:binding.runId});}catch{controller.abort();}},5000);heartbeatTimer.unref?.();
   // query owns tool selection, compaction and the model loop. Its returned stream is consumed once.
   if(lifecycle!==undefined)input=createConversationInput({requestId:saved.request.requestId,prompt:saved.request.prompt});
   stream=query({prompt:input?.prompt??saved.request.prompt,options});if(typeof stream?.[Symbol.asyncIterator]!=='function')throw fault('SDK_STREAM_REFUSED');const iterator=stream[Symbol.asyncIterator]();const textParts=createTextProjector(newId);
   if(lifecycle!==undefined)controls=createActivityLifecycle({config:lifecycle,runOwner,binding,saved,runtime,input,
    query:{interrupt:()=>stream.interrupt(),close:closeQuery},life,now});
   while(true){let next;try{next=await (controls?Promise.race([life.run(()=>iterator.next()),controls.failure.then(error=>{throw error;})]):life.run(()=>iterator.next()));}
    catch(error){if(controls?.isHeld())return await controls.heldResult();throw error;}if(next.done)break;const m=next.value;
    if(m?.type==='system'&&m.subtype==='mirror_error')throw fault('SESSION_PERSISTENCE_FAILED');
    await controls?.observe(m);if(controls?.isHeld())continue;
    if(m?.parent_tool_use_id)continue; // Subagent/internal content is never a display event.
    for(const part of textParts(m)){bytes+=Buffer.byteLength(part.text);if(bytes>runtime.maxOutputBytes)throw fault('OUTPUT_LIMIT');await publish('message.delta',part);}
    if(m?.type==='result'){if(resultSeen)throw fault('SDK_RESULT_DUPLICATE');resultSeen=true;terminalResult=m;if(m.subtype!=='success'||m.is_error!==false)throw fault('SDK_EXECUTION_FAILED');if(controls||skillRuntime){if(controls?.canCaptureCompletion())await controls.finish({keepInputOpen:true});else {input?.close();await controls?.finish();}break;}}
    // Thinking, raw tool arguments, SDK errors and provider diagnostics are never forwarded.
   }
   if(controls?.isHeld())return await controls.heldResult();controls?.check();if(!resultSeen)throw fault('SDK_RESULT_MISSING');if(skillRuntime){skillOutput=await life.run(()=>skillRuntime.finish(terminalResult));if(typeof selectedSkills.publish!=='function')throw fault('OUTPUT_PUBLICATION_UNAVAILABLE');await life.run(signal=>selectedSkills.publish({binding,output:skillOutput,signal}));}if(controls?.canCaptureCompletion())await controls.captureCompletion();else await publish('run.status',{state:'completed',reasonCode:null});return {state:'completed',...(skillOutput===undefined?{}:{output:skillOutput})};
  }catch(error){failure=error;controller.abort();clearInterval(heartbeatTimer);try{await closeQuery();}catch{}const cancelled=signal?.aborted||life?.signal.aborted;life?.close();preparation?.close();
   // A denied/unknown starting claimant cannot terminalize another admitted activity.
   if(claimed&&!controls?.isHeld()){const cleanup=createOperationLifetime({deadlineMs:now()+30,now,errorFactory:fault});try{await cleanup.run(signal=>runOwner.append({binding,event:{eventId:newId(),createdAt:new Date(now()).toISOString(),type:'run.status',data:{state:cancelled?'cancelled':'failed',reasonCode:cancelled?'EXECUTION_STOPPED':'EXECUTION_FAILED'}},signal}));}catch{}finally{cleanup.close();}}
   throw fault(cancelled?'EXECUTION_STOPPED':'EXECUTION_FAILED');
  }finally{clearInterval(heartbeatTimer);controller.abort(failure);try{await skillRuntime?.close();await controls?.finish();controls?.close();input?.close();await closeQuery();}catch{throw fault('SDK_CLEANUP_UNKNOWN');}finally{life?.close();preparation?.close();}}
 };
}
