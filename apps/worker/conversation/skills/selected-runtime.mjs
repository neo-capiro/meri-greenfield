/** Opt-in original skill execution inside the existing single SDK task. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,assertWindow,assertWindowResolution} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {buildContinuationOptions} from '../continuation/options.mjs';
import {createOriginalSkillServer} from './mcp.mjs';
import {assertSkillInstallation,assertSkillRun} from './receipts.mjs';
import {createSelectedSkillOutput} from './output.mjs';
const fault=code=>Object.assign(Error(code),{code}),same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export async function createSelectedSkillRuntime(configuration) {
 const c=own(configuration,['binding','versions','request','scopes','selection','readForSkill','currentSkillRun','gateway','compileArtifact','now'],['artifactOutput','signal','continuation','sourceRequest','outputSchema']);
 const binding=data(c.binding),request=data(c.request),scopes=data(c.scopes),selection=data(own(c.selection,['subject','window','mondayBoardIds']));
 validateShape('RunBinding',binding);validateShape('RuntimeVersions',c.versions);scopes.forEach(s=>validateShape('Scope',s));assertSubject(selection.subject,binding);assertWindow(selection.window);
 const selected=selectSkill(request.skill.skillId,request.skill.skillVersion);
 if(!['quick_skill.relationship_brief','quick_skill.commitments_audit'].includes(selected.pin.skillId)||!same(request.skill,selected.pin)||!same(selection.subject.scopes,scopes)||
 !same(request.window,selection.window)||!selected.manifest.subjectKinds.includes(selection.subject.kind)||!selected.manifest.windowBases.includes(selection.window.basis)||
 c.versions.sdk!=='0.3.295'||c.versions.cli!=='2.1.295'||['readForSkill','currentSkillRun','compileArtifact','now'].some(k=>typeof c[k]!=='function')||typeof c.gateway?.execute!=='function')throw fault('SKILL_RUNTIME_CONFIGURATION');
 if(request.windowRequest!==null)assertWindowResolution(request.windowRequest,request.window);
 if(c.continuation)buildContinuationOptions(c.continuation,{binding,versions:c.versions,request,sourceRequest:c.sourceRequest,scopes});
 let deadlineMs=c.now()+selected.manifest.budgets.maxRuntimeSeconds*1000;const owner=createOperationLifetime({deadlineMs,now:c.now,signal:c.signal,errorFactory:fault}),life={...owner,limitDeadline(next){owner.limitDeadline(next);deadlineMs=Math.min(deadlineMs,next);},get deadlineMs(){return deadlineMs;}};
 const input={binding,skill:selected.pin,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection)};
 let installation,admission,server,closed=false,calls=0,readBytes=0;const receipts=[],pending=new Set();
 const current=async()=>{life.check();let started=c.now();const install=assertSkillInstallation(await life.run(signal=>c.readForSkill({...input,signal})),{input,selected,started,now:c.now,life,previous:installation});
  started=c.now();const run=assertSkillRun(await life.run(signal=>c.currentSkillRun({...input,signal})),{input,selected,scopes,started,now:c.now,life,previous:admission});installation??=install;admission??=run;life.check();};
 const read=async(operation,args,signal,deliveryId)=>{if(closed)throw fault('SKILL_RUNTIME_CLOSED');const ref=data(operation),requestArgs=data(args);
  if(!selected.manifest.allowedOperations.some(op=>same(ref,op)))throw fault('SKILL_OPERATION_REFUSED');
  if(calls>=selected.manifest.budgets.maxToolCalls)throw fault('SKILL_TOOL_BUDGET');calls++;
  const work=(async()=>{await current();if(!installation.operations.some(row=>same(row.operation,ref)))throw fault('UNAVAILABLE');const result=await life.run(owned=>c.gateway.execute({operation:ref,arguments:requestArgs,deliveryId,signal:signal?AbortSignal.any([signal,owned]):owned}));
   if(typeof result!=='string'||Buffer.byteLength(result)>selected.manifest.budgets.maxOutputBytes)throw fault('SKILL_RESULT_LIMIT');
   const raw=data(JSON.parse(result));await current();readBytes+=Buffer.byteLength(result);if(readBytes>2*selected.manifest.budgets.maxOutputBytes)throw fault('SKILL_READ_BYTES');
   receipts.push({deliveryId,operation:ref,request:requestArgs,resultSha256:canonicalSha256(raw),result:raw});return result;})();pending.add(work);try{return await work;}finally{pending.delete(work);}};
 let preparationId,ordinal=0;
 const readSource=async call=>{if(!same(call.binding,binding)||!same(call.window,selection.window)||!same(call.subject,selection.subject))throw fault('SKILL_COMPILER_CONTEXT_REFUSED');
  // The gateway owns normalization, current source policy and continuation state.
  // Compiler context is validated against the same canonical output DTO afterward.
  if(!preparationId)throw fault('SKILL_PREPARATION_REFUSED');const deliveryId='compiler:'+canonicalSha256({binding,preparationId,ordinal:ordinal++,operation:call.operation,arguments:call.request});return JSON.parse(await read(call.operation,call.request,call.signal,deliveryId));};
 try{await current();server=createOriginalSkillServer({selected,read,binding,expectedSessionId:c.continuation?(c.continuation.mode==='resume'?c.continuation.checkpoint.sessionId:c.continuation.targetSessionId):undefined,timeoutMs:selected.manifest.budgets.maxRuntimeSeconds*1000});
  const output=createSelectedSkillOutput({selected,binding,request,scopes,selection,readSource,current,compileArtifact:c.compileArtifact,artifactOutput:c.artifactOutput,receipts:()=>data(receipts),life});
  return Object.freeze({selected,sdkOptions:{mcpServers:{meri_original_reads:server.server},allowedTools:server.allowedTools,canUseTool:server.canUseTool,hooks:server.hooks,
    ...(c.outputSchema?{outputFormat:{type:'json_schema',schema:data(c.outputSchema)}}:{})},finish(raw){const r=data(raw);if(preparationId===undefined&&r.type==='result'&&r.subtype==='success'&&r.is_error===false&&r.structured_output&&same(r.structured_output.skill,selected.pin))preparationId=canonicalSha256({binding,requestSha256:input.requestSha256,structuredOutputSha256:canonicalSha256(r.structured_output)});return output.finish(raw);},receipts:()=>data(receipts),
   async close(){if(closed)return;closed=true;life.close();const cleanup=createOperationLifetime({deadlineMs:c.now()+1000,now:c.now,errorFactory:fault});try{await cleanup.run(()=>Promise.allSettled([...pending]));await cleanup.run(()=>server.close());}finally{cleanup.close();}}});
 }catch(e){life.close();await server?.close();throw e;}
}
