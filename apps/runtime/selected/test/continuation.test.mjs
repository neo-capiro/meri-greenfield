import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskSelectedSkills} from '../task.mjs';
import {selectedOutputCompiler} from '../output-format.mjs';
import {runtimeFixture} from '../../../worker/conversation/skills/test/runtime-fixture.mjs';
import {continuationFixture,id} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {describeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';

function fixture(skillId,mode,kind){
 const f=runtimeFixture(),c=f.configuration,selected=selectSkill(skillId,describeSkillPlugin().skills.find(s=>s.skillId===skillId).skillVersion),base=continuationFixture(mode),cp=base.continuation.checkpoint;
 const sourceRequest={...c.request,skill:selected.pin,windowRequest:{basis:'unbounded'}},request={...sourceRequest,requestId:id(914)};
 const binding={...c.binding,conversationId:mode==='fork'?id(910):c.binding.conversationId,runId:id(911),attemptId:id(912),workerId:id(913),writerFence:mode==='fork'?1:c.binding.writerFence+1};
 cp.binding=c.binding;cp.workspace.binding=c.binding;cp.scopes=c.scopes;cp.workspace.scopes=c.scopes;cp.opaqueSession.scopes=c.scopes;cp.versions=c.versions;cp.workspaceSha256=hash(cp.workspace);
 const contextSha256=hash({window:sourceRequest.window,skill:selected.pin,scopes:c.scopes}),sourceRequestSha256=hash(sourceRequest);
 const continuation=kind==='native-session'?{kind,mode,controlId:base.continuation.controlId,sdkSession:{binding:c.binding,key:{projectKey:'synthetic-native-project',sessionId:cp.sessionId},ownerSha256:'a'.repeat(64),entriesCount:3},versions:c.versions,scopes:c.scopes,sourceRequestSha256,contextSha256,targetSessionId:base.continuation.targetSessionId}:{...base.continuation,checkpoint:cp,checkpointSha256:hash(cp),sourceRequestSha256,contextSha256};
 const calls=[],task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{async call(operation,input){calls.push({operation,input});assert.equal(operation,'selected/prepare');return {sessionId:id(915),binding,requestSha256:hash(request),selection:f.selection,checkedAtMs:c.now(),expiresAtMs:c.now()+5000};}}});
 return {task,calls,selected,args:{binding,versions:c.versions,request,scopes:c.scopes,continuation,sourceRequest},expectedSessionId:mode==='fork'?continuation.targetSessionId:cp.sessionId};
}
for(const skill of ['quick_skill.commitments_audit','quick_skill.relationship_brief','quick_skill.client_changes'])for(const mode of ['resume','fork'])for(const kind of ['checkpoint','native-session'])test(`${skill} ${kind} ${mode} preserves the existing continuation and source-read session`,async()=>{
 const x=fixture(skill,mode,kind);
 try{
  const runtime=await x.task.prepare(x.args);
  if(!selectedOutputCompiler(x.selected)){assert.equal(runtime,null);assert.equal(x.calls.length,0);return;}
  assert.equal(x.calls.length,1);assert.deepEqual(x.calls[0].input,{binding:x.args.binding,requestSha256:hash(x.args.request)});
  const hook=runtime.sdkOptions.hooks.PreToolUse[0].hooks[0],input={hook_event_name:'PreToolUse',tool_name:runtime.sdkOptions.allowedTools[0],tool_use_id:'synthetic_tool_use',tool_input:{arguments:{}}};
  const refused=await hook({...input,session_id:id(999)},undefined,{});assert.equal(refused.hookSpecificOutput.permissionDecision,'deny');
  const allowed=await hook({...input,session_id:x.expectedSessionId},undefined,{});assert.equal(typeof allowed.hookSpecificOutput.updatedInput._meriInvocation,'string');
  await runtime.close();
 }finally{await x.task.close();}
});
for(const kind of ['checkpoint','native-session'])test(`${kind} selected continuation refuses changed context before any source RPC`,async()=>{
 const x=fixture('quick_skill.commitments_audit','resume',kind);
 try{await assert.rejects(x.task.prepare({...x.args,continuation:{...x.args.continuation,contextSha256:'0'.repeat(64)}}),/CONTINUATION_PIN_REFUSED/);assert.equal(x.calls.length,0);}finally{await x.task.close();}
});
