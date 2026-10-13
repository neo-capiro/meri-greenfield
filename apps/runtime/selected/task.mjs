/** Isolated SDK task: original MCP tools and opaque trusted-control completion only. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertSubject,assertWindow} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import {createOriginalSkillServer} from '../../worker/conversation/skills/mcp.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {fault} from '../config.mjs';
import {assertSelectedCompletion} from '../../../packages/contracts/runtime-0.2/selected.mjs';
const hash=canonicalSha256,same=(a,b)=>hash(a)===hash(b),uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value);
export function createTaskSelectedSkills({native,now=Date.now,sourceEnabled=false}){
 if(typeof native?.call!=='function'||typeof now!=='function'||typeof sourceEnabled!=='boolean')throw fault('SELECTED_TASK_CONFIGURATION');
 const active=new Map();
 async function prepare(raw){
  if(!sourceEnabled)throw fault('UNAVAILABLE');if(active.size>=64)throw fault('SELECTED_SESSION_LIMIT');const args=own(raw,['binding','versions','request','scopes'],['signal','continuation','sourceRequest']);nativeSignal(args.signal);
  const binding=data(args.binding),request=data(args.request),scopes=data(args.scopes);validateShape('RunBinding',binding);validateShape('RuntimeVersions',args.versions);
  if(args.continuation!==undefined)throw fault('SELECTED_CONTINUATION_UNAVAILABLE');scopes.forEach(scope=>validateShape('Scope',scope));
  const selected=selectSkill(request.skill.skillId,request.skill.skillVersion);if(!same(selected.pin,request.skill))throw fault('SELECTED_TASK_PIN_REFUSED');
  const life=createOperationLifetime({deadlineMs:now()+selected.manifest.budgets.maxRuntimeSeconds*1000,now,signal:args.signal,errorFactory:fault});let server,closed=false,attempted,completion;
  try{
   const started=now(),session=data(await life.run(signal=>native.call('selected/prepare',{binding,requestSha256:hash(request)},{signal})));own(session,['sessionId','binding','requestSha256','selection','checkedAtMs','expiresAtMs']);
   if(!uuid(session.sessionId)||!same(session.binding,binding)||session.requestSha256!==hash(request)||!Number.isSafeInteger(session.checkedAtMs)||session.checkedAtMs<started||session.checkedAtMs>now()||!Number.isSafeInteger(session.expiresAtMs)||session.expiresAtMs<=now())throw fault('SELECTED_TASK_SESSION_REFUSED');
   assertSubject(session.selection.subject,binding);assertWindow(session.selection.window);if(!same(session.selection.subject.scopes,scopes)||!same(session.selection.window,request.window))throw fault('SELECTED_TASK_SESSION_REFUSED');life.limitDeadline(session.expiresAtMs);
   const selector={binding,sessionId:session.sessionId,requestSha256:hash(request),selectionSha256:hash(session.selection)};
   server=createOriginalSkillServer({selected,binding,timeoutMs:selected.manifest.budgets.maxRuntimeSeconds*1000,expectedSessionId:args.continuation?(args.continuation.mode==='resume'?args.continuation.checkpoint.sessionId:args.continuation.targetSessionId):undefined,read:async(operation,argumentsValue,signal,deliveryId)=>{
    if(closed)throw fault('SELECTED_TASK_CLOSED');const response=data(await life.run(owned=>native.call('selected/read',{...selector,operation,arguments:argumentsValue,deliveryId},{signal:signal?AbortSignal.any([owned,signal]):owned})));own(response,['result']);if(typeof response.result!=='string'||Buffer.byteLength(response.result)>selected.manifest.budgets.maxOutputBytes)throw fault('SELECTED_TASK_RESULT_REFUSED');life.check();return response.result;
   }});
   const runtime={selected,sdkOptions:{mcpServers:{meri_original_reads:server.server},allowedTools:server.allowedTools,canUseTool:server.canUseTool,hooks:server.hooks},finish(raw){
    const result=data(raw);if(result.type!=='result'||result.subtype!=='success'||result.is_error!==false||result.structured_output===undefined)throw fault('SKILL_LITERAL_OUTPUT_REQUIRED');const input=data(result.structured_output);
    if(!same(input.skill,selected.pin)||Buffer.byteLength(JSON.stringify(input))>selected.manifest.budgets.maxOutputBytes)throw fault('SKILL_OUTPUT_PIN_REFUSED');const inputSha256=hash(input);if(attempted!==undefined){if(attempted!==inputSha256)throw fault('SKILL_OUTPUT_REPLAY_REFUSED');return completion;}attempted=inputSha256;
    return completion=life.run(async signal=>{const receipt=assertSelectedCompletion(await native.call('selected/finish',{...selector,structuredOutput:input},{signal}),selector,inputSha256);life.check();return receipt;
    });
   },async close(){if(closed)return;closed=true;active.delete(session.sessionId);life.close();const cleanup=createOperationLifetime({deadlineMs:now()+1000,now,errorFactory:fault});try{await cleanup.run(()=>server.close());}finally{cleanup.close();}}};
   active.set(session.sessionId,{selector,runtime});return Object.freeze(runtime);
  }catch(error){life.close();const cleanup=createOperationLifetime({deadlineMs:now()+1000,now,errorFactory:fault});try{await cleanup.run(()=>server?.close());}finally{cleanup.close();}throw error;}
 }
 async function publish({binding,output,signal}){nativeSignal(signal);const receipt=data(output),record=[...active.values()].find(v=>same(v.selector.binding,binding)&&v.selector.requestSha256===receipt.requestSha256&&v.selector.selectionSha256===receipt.selectionSha256);if(!record)throw fault('SELECTED_TASK_COMPLETION_REFUSED');
  return native.call('selected/publish',{...record.selector,completionId:receipt.completionId},{signal});
 }
 return Object.freeze({prepare,publish,async close(){await Promise.all([...active.values()].map(v=>v.runtime.close()));}});
}
