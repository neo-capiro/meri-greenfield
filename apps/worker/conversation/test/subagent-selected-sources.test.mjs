import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubagents} from '../capabilities/subagents.mjs';
import {assertCapabilityPolicy,WORKSPACE_TOOLS} from '../capabilities/policy.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';

test('the production capability composer includes snapshot capture and research admission in the SDK options',()=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const binding={tenantId:'tenant-selected',actorId:'actor-selected',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const result=createSdkCapabilities({subagents:true,workspaceTools:true},{binding,cwd:'/workspace/'+binding.conversationId,
  runOwner:{async append(){}},childAssignments:{async dispatch(){return {replayed:false};},async settle(){}},now:Date.now,newId:()=>id(5)});
 assert.deepEqual(result.options.agents.research.tools,[]);
 assert.ok(result.options.hooks.PostToolUse.some(group=>group.matcher==='^Read$'));
 assert.ok(result.options.hooks.PreToolUse.some(group=>!group.matcher));
 assert.equal(result.options.settings.permissions.allow[0],`Read(//workspace/${binding.conversationId}/**)`);
 result.check();
});

function fixture({dispatch}={}){
 const assignments=[],settlements=[],latched=[];
 const child=createSubagents(assertCapabilityPolicy({subagents:true,workspaceTools:true}),{
  latch:e=>latched.push(e.code),children:{async dispatch(value){assignments.push(structuredClone(value));return dispatch?dispatch(value):{replayed:false};},async settle(value){settlements.push(value);}},
 });
 const signal=new AbortController().signal;
 const hooks=async(event,tool,input={},extra={},options={signal})=>{
  const results=[];
  for(const group of child.hooks[event]??[])if(!group.matcher||new RegExp(group.matcher).test(tool))
   for(const hook of group.hooks)results.push(await hook({hook_event_name:event,tool_name:tool,tool_input:input,tool_use_id:'delegate-1',...extra},extra.tool_use_id??'delegate-1',options));
  return results;
 };
 const read=(file_path,tool_response,extra={})=>hooks('PostToolUse','Read',{file_path,offset:10,limit:20},{tool_response,tool_use_id:'read-'+file_path,...extra});
 const delegate=(files,extra={},options)=>hooks('PreToolUse','Agent',{description:'Check selected evidence',subagent_type:'research',prompt:JSON.stringify({task:'Compare the selected evidence',files})},extra,options);
 return {child,hooks,read,delegate,assignments,settlements,latched};
}
const decision=results=>results.find(r=>r.hookSpecificOutput?.permissionDecision)?.hookSpecificOutput;

test('the actual child hook selects only requested SDK snapshots and durably binds the expanded input before admission',async()=>{
 const f=fixture(),first={type:'text',text:'Selected source: 12'},unselected={type:'text',text:'UNSELECTED SECRET'};
 await f.read('/workspace/chosen.txt',first);await f.read('/workspace/other.txt',unselected);
 first.text='mutated caller object';
 const admitted=decision(await f.delegate(['/workspace/chosen.txt']));
 assert.equal(admitted.permissionDecision,'allow');
 assert.match(admitted.updatedInput.prompt,/Selected source: 12/);assert.doesNotMatch(admitted.updatedInput.prompt,/UNSELECTED SECRET|mutated caller object/);
 const payload=JSON.parse(admitted.updatedInput.prompt.split('\n').at(-1)),source=payload.sources[0];
 assert.equal(source.filePath,'/workspace/chosen.txt');assert.equal(source.readInput.offset,10);assert.equal(source.readInput.limit,20);
 const {sha256,...bound}=source;assert.equal(sha256,canonicalSha256(bound));
 assert.equal(f.assignments[0].inputSha256,canonicalSha256(admitted.updatedInput));
 assert.deepEqual(f.assignments[0].narrowing.tools,[]);
 for(const tool of [...WORKSPACE_TOOLS,'Bash','Agent'])assert.ok(f.assignments[0].narrowing.disallowedTools.includes(tool));
 await f.hooks('PostToolUse','Agent',{}, {tool_response:{answer:'The selected source reports 12.'}});
 assert.equal(f.settlements[0].outcome,'completed');assert.deepEqual(f.latched,[]);
});

test('unread, aliased, child-read and failed-reread files cannot be selected and no child is dispatched',async()=>{
 for(const scenario of ['unread','alias','child','failed','oversized']){
  const f=fixture();
  if(scenario!=='unread')await f.read('/workspace/a.txt',{text:scenario==='oversized'?'x'.repeat(50000):'old'},scenario==='child'?{agent_id:'child',agent_type:'analysis'}:{});
  if(scenario==='failed')await f.hooks('PostToolUseFailure','Read',{file_path:'/workspace/a.txt'});
  const path=scenario==='alias'?'/workspace/x/../a.txt':'/workspace/a.txt';
  assert.equal(decision(await f.delegate([path])).permissionDecision,'deny',scenario);
  assert.equal(f.assignments.length,0,scenario);
 }
});

test('a new run cannot reuse the prior query source cache, and structured malformed selection never falls back to prose',async()=>{
 const f=fixture();await f.read('/workspace/a.txt',{text:'retained only in this query'});
 assert.equal(decision(await fixture().delegate(['/workspace/a.txt'])).permissionDecision,'deny');
 for(const prompt of ['{bad',JSON.stringify({task:'x',files:['/workspace/a.txt','/workspace/a.txt']}),JSON.stringify({task:'x',files:[],cwd:'/etc'})]){
  const result=decision(await f.hooks('PreToolUse','Agent',{description:'x',subagent_type:'research',prompt}));
  assert.equal(result.permissionDecision,'deny');
 }
 assert.equal(f.assignments.length,0);
});

test('research tool calls and every nested Agent call are denied even if an outer permission would allow them',async()=>{
 const f=fixture();assert.deepEqual(f.child.agents.research.tools,[]);
 for(const tool of ['Read','Glob','Grep','Bash','Skill','mcp__meri_reads__query']){
  assert.equal(decision(await f.hooks('PreToolUse',tool,{}, {agent_id:'research-child',agent_type:'research'})).permissionDecision,'deny');
 }
 const nested=await f.hooks('PreToolUse','Agent',{description:'x',subagent_type:'analysis',prompt:'x'},{agent_id:'other-child',agent_type:'analysis'});
 assert.equal(decision(nested).permissionDecision,'deny');assert.equal(f.assignments.length,0);
});

test('revoked assignment, cancellation, and replay do not dispatch selected evidence',async()=>{
 const controller=new AbortController();controller.abort();const cancelled=fixture();
 assert.equal(decision(await cancelled.delegate([],{}, {signal:controller.signal})).permissionDecision,'deny');assert.equal(cancelled.assignments.length,0);
 for(const dispatch of [async()=>{throw Object.assign(Error('revoked'),{code:'CURRENT_ACCESS_REFUSED'});},async()=>({replayed:true,effect:'unknown'})]){
  const f=fixture({dispatch});await f.read('/workspace/a.txt',{text:'evidence'});
  assert.equal(decision(await f.delegate(['/workspace/a.txt'])).permissionDecision,'deny');
  assert.equal(f.assignments.length,1);
 }
 const late=new AbortController(),f=fixture({dispatch:async()=>{late.abort();return {replayed:false};}});
 assert.equal(decision(await f.delegate([],{}, {signal:late.signal})).permissionDecision,'deny');
});
