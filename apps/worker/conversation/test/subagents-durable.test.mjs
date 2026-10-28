/** The Agent gate is the durable child crossing: the assignment is persisted through the run owner before the SDK admits
 * the child, and the result receipt before the parent is acknowledged. A re-issued tool-use id is refused instead of
 * dispatching a second child, and a child result the durable owner refused stops the run.
 * Scripted hooks and a scripted run-owner port exercise the native protocol locally; no SDK process, model, provider or
 * store is started, so this is source proof of the crossing, not live model-workflow acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assertCapabilityPolicy,SUBAGENT_TYPES} from '../capabilities/policy.mjs';
import {createSubagents,admitAgentInput,AGENT_TOOL} from '../capabilities/subagents.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {binding,id} from '../../../control/conversations/test/application-fixture.mjs';
const cwd=`/workspace/conversations/${binding.conversationId}`,base={session_id:id(41),transcript_path:'/tmp/t.jsonl',cwd},signal=()=>({signal:new AbortController().signal});
const policy=extra=>assertCapabilityPolicy({subagents:true,subagentTypes:['research','verification'],workspaceTools:true,workspaceToolNames:['Read','Grep'],maxParallelSubagents:2,...extra});
/** A scripted run owner child port: it records the crossing and answers in the shape the real port validates. */
const port=(over={})=>{const calls={dispatch:[],settle:[]};return {calls,
 async dispatch(input){calls.dispatch.push(input);if(over.dispatch)throw over.dispatch;return {replayed:over.replayed===true,effect:over.effect??'none',
  assignment:{assignmentId:'3f1c2d4e-5a6b-8c7d-9e0f-1a2b3c4d5e6f',toolUseId:input.toolUseId,role:input.role,revision:{requestSha256:'a'.repeat(64),steer:null},dispatchedAtMs:1760000000000}};},
 async settle(input){calls.settle.push(input);if(over.settle)throw over.settle;return {replayed:over.replayed===true,
  receipt:{assignmentId:'3f1c2d4e-5a6b-8c7d-9e0f-1a2b3c4d5e6f',toolUseId:input.toolUseId,outcome:input.outcome,resultSha256:input.resultSha256,resultBytes:input.resultBytes,
   custody:{sessionId:input.sessionId??null,agentId:input.agentId??null},revision:{requestSha256:'a'.repeat(64),steer:null},settledAtMs:1760000000000}};}};};
const gate=(children,over={})=>{const latched=[];const s=createSubagents(policy(over.policy),{latch:error=>latched.push(error.code),children});
 const admit=(tool_use_id,tool_input)=>s.hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:AGENT_TOOL,tool_input,tool_use_id},tool_use_id,signal());
 const release=(tool_use_id,tool_response,hook_event_name='PostToolUse')=>s.hooks.PostToolUse[0].hooks[0]({...base,hook_event_name,tool_name:AGENT_TOOL,tool_use_id,tool_response},tool_use_id,signal());
 return {latched,s,admit,release};};
const agentInput=(type='research')=>({description:'d',prompt:'p',subagent_type:type});
const admitted=admitAgentInput(agentInput(),policy().subagentTypes),childResult={content:[{type:'text',text:'child result'}]};

test('the assignment is persisted through the run owner before the SDK admits the child, and the result receipt before the parent is acknowledged',async()=>{
 const children=port(),{latched,admit,release,s}=gate(children);
 const decision=await admit('toolu_child',agentInput());
 assert.equal(decision.hookSpecificOutput.permissionDecision,'allow');
 assert.deepEqual(decision.hookSpecificOutput.updatedInput,admitted);
 assert.equal(children.calls.dispatch.length,1,'the assignment crossed the run owner before the call was admitted');
 assert.deepEqual(children.calls.dispatch[0],{toolUseId:'toolu_child',role:'research',inputSha256:canonicalSha256(admitted),
  narrowing:{tools:s.agents.research.tools,maxTurns:s.agents.research.maxTurns,disallowedTools:s.agents.research.disallowedTools}});
 assert.equal(JSON.stringify(children.calls.dispatch[0]).includes('"prompt"'),false,'only the delegated input digest crosses the durable owner, never its content');
 assert.deepEqual(latched,[]);
 const released=await release('toolu_child',childResult);
 assert.deepEqual(released,{},'the parent is acknowledged only after the receipt is persisted');
 assert.deepEqual(children.calls.settle[0],{toolUseId:'toolu_child',outcome:'completed',resultSha256:canonicalSha256(childResult),resultBytes:Buffer.byteLength(JSON.stringify(childResult)),sessionId:id(41)});
 assert.deepEqual(latched,[]);
});

test('a replacement worker that re-issues an already assigned tool-use id is refused without dispatching a second child',async()=>{
 for(const effect of ['unknown','committed']){
  const children=port({replayed:true,effect}),{latched,admit}=gate(children);
  const decision=await admit('toolu_child',agentInput());
  assert.equal(decision.hookSpecificOutput.permissionDecision,'deny',effect);
  assert.match(decision.hookSpecificOutput.permissionDecisionReason,new RegExp(effect),'the model is told the durable effect');
  assert.equal(children.calls.dispatch.length,1,'the persisted assignment is read, never a second dispatch');
  assert.deepEqual(latched,[],'a recovered duplicate is a capacity denial, not a latched run failure');
 }
});

test('a child assignment the durable owner refuses denies the Agent call and latches; no child runs while the turn is held',async()=>{
 for(const code of ['CHILD_HOLD_REFUSED','CHILD_STATE_REFUSED','CHILD_ASSIGNMENT_REFUSED','STORE_COMMIT_UNKNOWN']){
  const children=port({dispatch:Object.assign(Error(code),{code})}),{latched,admit}=gate(children);
  const decision=await admit('toolu_child',agentInput());
  assert.equal(decision.hookSpecificOutput.permissionDecision,'deny',code);
  assert.deepEqual(latched,[code],'the durable refusal is an integrity failure: the run cannot complete after it');
  assert.equal(children.calls.dispatch.length,1);assert.equal(children.calls.settle.length,0,'a refused assignment settles nothing and performs no child work');
 }
});

test('a child result the durable owner refuses stops the run instead of acknowledging it: stale revision and revoked authority',async()=>{
 for(const code of ['CHILD_REVISION_STALE','CHILD_STATE_REFUSED','CHILD_ASSIGNMENT_UNKNOWN','STORE_COMMIT_UNKNOWN']){
  const children=port({settle:Object.assign(Error(code),{code})}),{latched,admit,release}=gate(children);
  await admit('toolu_child',agentInput());
  const released=await release('toolu_child',{content:[]});
  assert.deepEqual(released,{continue:false,stopReason:code},code);
  assert.deepEqual(latched,[code]);
 }
});

test('a replayed result receipt is acknowledged without a second receipt and without stopping the run',async()=>{
 const children=port({replayed:true}),{latched,admit,release}=gate(children);
 await admit('toolu_child',agentInput());
 assert.deepEqual(await release('toolu_child',{content:[]}),{});
 assert.equal(children.calls.settle.length,1);assert.deepEqual(latched,[]);
});

test('a failed child result is bound and retained as a failure, and the outcome is never invented as success',async()=>{
 const children=port(),{admit,release}=gate(children);
 await admit('toolu_child',agentInput());
 assert.deepEqual(await release('toolu_child',{error:'child failed'},'PostToolUseFailure'),{});
 assert.equal(children.calls.settle[0].outcome,'failed');
 assert.equal(children.calls.settle[0].resultSha256,canonicalSha256({error:'child failed'}));
});

test('malformed hook input latches before any crossing, and an absent child result is bound as null rather than as an unretained value',async()=>{
 const children=port(),{latched,admit,release}=gate(children);
 assert.equal((await admit('',agentInput())).hookSpecificOutput.permissionDecision,'deny');
 assert.deepEqual(latched,['SUBAGENT_HOOK_INPUT_REFUSED']);assert.equal(children.calls.dispatch.length,0);
 await admit('toolu_child',agentInput());
 assert.deepEqual(await release('toolu_child',undefined),{});
 assert.equal(children.calls.settle[0].resultSha256,canonicalSha256(null));
 assert.equal(children.calls.settle[0].resultBytes,4,'the bound result is the literal null payload, not an absent value');
});

test('the Agent gate is the only durable crossing: no parallel Agent call admits a child without an assignment, and the admitted input is the SDK input',async()=>{
 const children=port(),{admit,release,s}=gate(children);
 const first=await admit('toolu_1',agentInput()),second=await admit('toolu_2',agentInput('verification'));
 assert.deepEqual([first.hookSpecificOutput.permissionDecision,second.hookSpecificOutput.permissionDecision],['allow','allow']);
 assert.equal(children.calls.dispatch.length,2,'each admitted call has its own persisted assignment');
 assert.deepEqual(children.calls.dispatch.map(c=>c.toolUseId),['toolu_1','toolu_2']);
 const bounded=await admit('toolu_3',agentInput());
 assert.equal(bounded.hookSpecificOutput.permissionDecision,'deny','the parallelism bound still applies to durable children');
 assert.equal(children.calls.dispatch.length,2,'a bounded call never reaches the durable owner');
 assert.equal(s.agents.verification.disallowedTools.includes(AGENT_TOOL),true,'a child never gets the Agent tool');
 await release('toolu_1',{});await release('toolu_2',{});
 assert.equal((await admit('toolu_3',agentInput())).hookSpecificOutput.permissionDecision,'allow','a released child frees the bound');
 assert.equal(children.calls.dispatch.length,3);
});
