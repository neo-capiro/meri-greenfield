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
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fault=code=>Object.assign(new Error(code),{code});
export function createConversationActivity({runOwner,prepareRuntime,query=sdkQuery,heartbeat=()=>{},now=Date.now,newId=randomUUID}){
 if(['load','append'].some(k=>typeof runOwner?.[k]!=='function')||typeof prepareRuntime!=='function'||typeof query!=='function'||typeof heartbeat!=='function')throw fault('ACTIVITY_CONFIGURATION');
 return async function executeConversation({binding,signal}){
  validateShape('RunBinding',binding);let preparation,life,stream,claimed=false,closed=false,resultSeen=false,bytes=0,heartbeatTimer;const controller=new AbortController();let failure;const closeQuery=()=>{if(stream&&!closed){closed=true;stream.close?.();}};
  try{preparation=createOperationLifetime({deadlineMs:now()+3000,now,signal,errorFactory:fault});const saved=await preparation.run(signal=>runOwner.load({binding,signal}));validateShape('Run',saved.run);if(!same(saved.run.binding,binding)||saved.run.state!=='queued')throw fault('RUN_NOT_QUEUED');
   const runtime=await preparation.run(signal=>prepareRuntime({binding,versions:saved.run.versions,signal}));
   life=createOperationLifetime({deadlineMs:runtime.deadlineMs,now,signal,errorFactory:fault});preparation.close();const abort=()=>controller.abort(life.signal.reason);life.signal.addEventListener('abort',abort,{once:true});
   const publish=async(type,data,eventId=newId())=>{life.check();await life.run(signal=>runOwner.append({binding,event:{eventId,createdAt:new Date(now()).toISOString(),type,data},signal}));life.check();};
   await publish('run.status',{state:'starting',reasonCode:null});claimed=true;if(!same(runtime.binding,binding)||!same(runtime.versions,saved.run.versions))throw fault('RUNTIME_PIN_REFUSED');
   const options=buildConversationOptions(runtime,controller);let selected;
   if(saved.request.skill){selected=selectSkill(saved.request.skill.skillId,saved.request.skill.skillVersion);if(!same(selected.pin,saved.request.skill))throw fault('SKILL_PIN_REFUSED');assertSkillManifest(selected.manifest,catalog);options.maxTurns=Math.min(options.maxTurns,selected.manifest.budgets.maxTurns);options.maxBudgetUsd=Math.min(options.maxBudgetUsd,selected.manifest.budgets.maxCostMicroUSD/1000000);life.limitDeadline(now()+selected.manifest.budgets.maxRuntimeSeconds*1000);options.systemPrompt=selected.prose;}
   await publish('run.status',{state:'running',reasonCode:null});
   heartbeatTimer=setInterval(()=>{try{heartbeat({runId:binding.runId});}catch{controller.abort();}},5000);heartbeatTimer.unref?.();
   // query owns tool selection, compaction and the model loop. Its returned stream is consumed once.
   stream=query({prompt:saved.request.prompt,options});if(typeof stream?.[Symbol.asyncIterator]!=='function')throw fault('SDK_STREAM_REFUSED');const iterator=stream[Symbol.asyncIterator]();const textParts=createTextProjector(newId);
   while(true){const next=await life.run(()=>iterator.next());if(next.done)break;const m=next.value;
    if(m?.type==='system'&&m.subtype==='mirror_error')throw fault('SESSION_PERSISTENCE_FAILED');
    if(m?.parent_tool_use_id)continue; // Subagent/internal content is never a display event.
    for(const part of textParts(m)){bytes+=Buffer.byteLength(part.text);if(bytes>runtime.maxOutputBytes)throw fault('OUTPUT_LIMIT');await publish('message.delta',part);}
    if(m?.type==='result'){if(resultSeen)throw fault('SDK_RESULT_DUPLICATE');resultSeen=true;if(m.subtype!=='success'||m.is_error!==false)throw fault('SDK_EXECUTION_FAILED');}
    // Thinking, raw tool arguments, SDK errors and provider diagnostics are never forwarded.
   }
   if(!resultSeen)throw fault('SDK_RESULT_MISSING');await publish('run.status',{state:'completed',reasonCode:null});return {state:'completed'};
  }catch(error){failure=error;controller.abort();clearInterval(heartbeatTimer);try{closeQuery();}catch{}const cancelled=signal?.aborted||life?.signal.aborted;life?.close();preparation?.close();
   // A denied/unknown starting claimant cannot terminalize another admitted activity.
   if(claimed){const cleanup=createOperationLifetime({deadlineMs:now()+30,now,errorFactory:fault});try{await cleanup.run(signal=>runOwner.append({binding,event:{eventId:newId(),createdAt:new Date(now()).toISOString(),type:'run.status',data:{state:cancelled?'cancelled':'failed',reasonCode:cancelled?'EXECUTION_STOPPED':'EXECUTION_FAILED'}},signal}));}catch{}finally{cleanup.close();}}
   throw fault(cancelled?'EXECUTION_STOPPED':'EXECUTION_FAILED');
  }finally{clearInterval(heartbeatTimer);controller.abort(failure);try{closeQuery();}finally{life?.close();preparation?.close();}}
 };
}
