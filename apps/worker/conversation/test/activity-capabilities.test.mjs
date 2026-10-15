/** The activity builds SDK capabilities only from a declared policy; the default first-chat query is unchanged. Scripted SDK, no provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {applicationFixture,binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
const cwd=`/workspace/conversations/${binding.conversationId}`,SECRET='PRIVATE-TOKEN-9f8e',CONTENT='PRIVATE FILE CONTENT';
const runtime=()=>({binding,versions,cwd,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024});
const DEFAULT_KEYS=['cwd','abortController','settingSources','settings','skills','allowedTools','tools','permissionMode','canUseTool','includePartialMessages','systemPrompt','model','maxTurns','maxBudgetUsd','sessionStore','sessionStoreFlush','env'];
const progress={type:'system',subtype:'task_progress',task_id:'task_1',subagent_type:'research',description:CONTENT,usage:{total_tokens:1,tool_uses:0,duration_ms:1},summary:'Reading sources'};
const frames=[{type:'stream_event',parent_tool_use_id:null,event:{type:'message_start',message:{id:'msg_1'}}},{type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'Hello'}}},progress,{type:'assistant',parent_tool_use_id:'toolu_agent',message:{id:'msg_sub',content:[{type:'text',text:CONTENT}]}},{type:'assistant',parent_tool_use_id:null,message:{id:'msg_1',content:[{type:'text',text:'Hello'}]}},{type:'result',subtype:'success',is_error:false}];
const toolInput={command:`curl -H 'Authorization: ${SECRET}' https://x.invalid`},hookInput={session_id:id(40),transcript_path:'/tmp/t.jsonl',cwd,hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:toolInput,tool_use_id:'toolu_1'};
/** @param {{capabilities?:unknown,append?:(event:any,forward:()=>Promise<unknown>)=>Promise<unknown>,during?:(options:any)=>Promise<void>,duringAt?:number,runtimeFacts?:Record<string,unknown>}} c */
async function setup(c={}){
 const f=await applicationFixture();await f.service.submit({credential:f.credential,input:f.input});let n=200,calls=0;const seen={};
 const runOwner={load:async a=>{const saved=await f.runOwner.load(a);return 'capabilities' in c?{...saved,capabilities:c.capabilities}:saved;},append:a=>c.append?c.append(a.event,()=>f.runOwner.append(a)):f.runOwner.append(a)};
 const query=args=>{calls++;seen.options=args.options;return {async *[Symbol.asyncIterator](){for(const [index,frame] of frames.entries()){if(index===(c.duringAt??frames.length-1))await c.during?.(args.options);yield frame;}},close(){}};};
 const execute=createConversationActivity({runOwner,prepareRuntime:async()=>({...runtime(),...c.runtimeFacts}),query,newId:()=>id(n++)});
 return {...f,execute,seen,calls:()=>calls,history:()=>f.service.history({credential:f.credential})};
}
const texts=h=>h.events.filter(e=>e.type==='message.delta').map(e=>e.data.text);

test('without a declared policy the SDK query receives exactly the default first-chat options and no progress is displayed',async()=>{
 const f=await setup();try{assert.deepEqual(await f.execute({binding}),{state:'completed'});assert.deepEqual(Object.keys(f.seen.options),DEFAULT_KEYS);assert.deepEqual(f.seen.options.tools,[]);
  for(const key of ['agents','hooks','plugins','disallowedTools','agentProgressSummaries'])assert.equal(Object.hasOwn(f.seen.options,key),false,key);
  const h=await f.history();assert.deepEqual(texts(h),['Hello']);assert.equal(JSON.stringify(h).includes('PRIVATE'),false);}finally{f.close();}
});

test('a declared subagent policy configures SDK agents and displays only the admitted progress summary',async()=>{
 const f=await setup({capabilities:{subagents:true,subagentProgress:true,subagentTypes:['research','verification']}});try{
  assert.deepEqual(await f.execute({binding}),{state:'completed'});const o=f.seen.options;
  assert.deepEqual(Object.keys(o.agents),['research','verification']);assert.equal(o.agentProgressSummaries,true);assert.deepEqual(o.tools,['Agent']);assert.deepEqual(o.settingSources,[]);assert.equal(o.permissionMode,'default');
  const h=await f.history();assert.deepEqual(texts(h),['Hello','research: Reading sources']);assert.equal(JSON.stringify(h).includes('PRIVATE'),false,'subagent content and task descriptions are never displayed');}finally{f.close();}
});

test('audit hooks publish only hashes through the run owner append port during the activity',async()=>{
 const audits=[];let decision;
 const f=await setup({capabilities:{auditHooks:true},append:async(event,forward)=>{if(event.type==='tool.audit'){audits.push(event);return {};}return forward();},during:async options=>{decision=await options.hooks.PreToolUse[0].hooks[0](hookInput,'toolu_1',{signal:new AbortController().signal});}});
 try{assert.deepEqual(await f.execute({binding}),{state:'completed'});assert.deepEqual(decision,{});assert.equal(audits.length,1);
  assert.deepEqual(Object.keys(audits[0].data),['phase','toolUseId','tool','inputSha256','agentId','agentType']);assert.equal(audits[0].data.tool,'Bash');assert.match(audits[0].data.inputSha256,/^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(audits).includes(SECRET)||JSON.stringify(audits).includes('curl'),false);}finally{f.close();}
});

test('a run owner that refuses capability events denies the tool and fails the run instead of completing unaudited',async()=>{
 let decision;const f=await setup({capabilities:{auditHooks:true},during:async options=>{decision=await options.hooks.PreToolUse[0].hooks[0](hookInput,'toolu_1',{signal:new AbortController().signal});}});
 try{await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);assert.equal(decision.hookSpecificOutput.permissionDecision,'deny');const h=await f.history();assert.equal(h.run.state,'failed');assert.equal(h.events.some(e=>e.type==='tool.audit'),false);assert.equal(JSON.stringify(h).includes(SECRET),false);}finally{f.close();}
});

test('an invalid declared policy is refused before claim and before any SDK query',async()=>{
 const f=await setup({capabilities:{subagents:true,permissionMode:'bypassPermissions'}});try{await assert.rejects(f.execute({binding}));assert.equal(f.calls(),0);assert.equal((await f.history()).run.state,'queued');}finally{f.close();}
});

const signal=()=>({signal:new AbortController().signal});
test('a malformed hook input latches: the tool is denied, no later output is published and the run fails instead of completing',async()=>{
 let decision;const f=await setup({capabilities:{auditHooks:true},duringAt:1,append:async(event,forward)=>event.type==='tool.audit'?{}:forward(),during:async options=>{decision=await options.hooks.PreToolUse[0].hooks[0]({...hookInput,tool_use_id:''},'x',signal());}});
 try{await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);assert.equal(decision.hookSpecificOutput.permissionDecision,'deny');const h=await f.history();assert.equal(h.run.state,'failed');assert.deepEqual(texts(h),[],'no message.delta after the latched failure');assert.equal(h.events.some(e=>e.type==='run.status'&&e.data.state==='completed'),false);}finally{f.close();}
});

test('a latched failure after the last output still prevents completion; post-tool, compaction and subagent hook paths each latch',async()=>{
 const paths=[
  [{auditHooks:true},o=>o.hooks.PostToolUse[0].hooks[0]({...hookInput,hook_event_name:'PostToolUse',tool_name:''},'x',signal())],
  [{auditHooks:true},o=>o.hooks.PostToolUseFailure[0].hooks[0]({...hookInput,hook_event_name:'PostToolUseFailure',tool_use_id:undefined},'x',signal())],
  [{compactionHooks:true},o=>o.hooks.PreCompact[0].hooks[0]({...hookInput,hook_event_name:'PreCompact',trigger:'sometimes'},undefined,signal())],
  [{compactionHooks:true},o=>o.hooks.PostCompact[0].hooks[0]({...hookInput,hook_event_name:'PostCompact',trigger:'auto',compact_summary:'s'},undefined,signal()),true],
  [{subagents:true},o=>o.hooks.SubagentStart[0].hooks[0]({...hookInput,hook_event_name:'SubagentStart'},undefined,signal())],
  [{subagents:true},o=>o.hooks.PreToolUse[0].hooks[0]({...hookInput,tool_name:'Agent',tool_input:{description:'d',prompt:'p',subagent_type:'general-purpose'}},'toolu_1',signal())],
  [{subagents:true},o=>o.hooks.PostToolUse[0].hooks[0]({hook_event_name:'PostToolUse',tool_name:'Agent'},undefined,signal())]];
 for(const [capabilities,fire,refuseEvent] of paths){
  const f=await setup({capabilities,append:async(event,forward)=>['tool.audit','compaction.boundary','subagent.lifecycle'].includes(event.type)?(refuseEvent?Promise.reject(Error('EVENT_TYPE_REFUSED')):{}):forward(),during:async options=>{await fire(options);}});
  try{await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/,JSON.stringify(capabilities));const h=await f.history();assert.equal(h.run.state,'failed');assert.equal(h.events.some(e=>e.type==='run.status'&&e.data.state==='completed'),false);}finally{f.close();}
 }
});

test('Bash reaches the SDK only with explicit policy eligibility and the trusted sandbox attestation from runtime preparation',async()=>{
 const attested={available:true,sdk:'0.3.295',cli:'2.1.295',weakerNestedSandbox:false,outerIsolationBoundary:true};
 for(const [capabilities,runtimeFacts,admitted] of [[{workspaceTools:true},{bashSandbox:attested},false],[{bash:true},{},false],[{bash:true},{bashSandbox:{...attested,available:false}},false],[{bash:true,sandboxNetworkDomains:['pypi.org']},{bashSandbox:attested},true]]){
  const f=await setup({capabilities,runtimeFacts});try{assert.deepEqual(await f.execute({binding}),{state:'completed'});const o=f.seen.options;
   assert.equal(o.tools.includes('Bash'),admitted,JSON.stringify([capabilities,runtimeFacts]));if(o.disallowedTools!==undefined)assert.equal(o.disallowedTools.includes('Bash'),!admitted);assert.equal(o.sandbox!==undefined,admitted);
   if(admitted){assert.deepEqual(o.sandbox.network.allowedDomains,['pypi.org']);assert.equal(o.sandbox.failIfUnavailable,true);assert.equal(o.sandbox.allowUnsandboxedCommands,false);assert.equal(o.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB,'1');assert.equal(o.env.ANTHROPIC_AUTH_TOKEN,'synthetic-task-capability');assert.equal(o.managedSettings.sandbox.failIfUnavailable,true);assert.ok(o.sandbox.credentials.envVars.some(e=>e.name==='ANTHROPIC_AUTH_TOKEN'&&e.mode==='deny'));}
   else assert.equal(o.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB,undefined);}finally{f.close();}
 }
 const f=await setup({capabilities:{bash:true},runtimeFacts:{bashSandbox:{...attested,weakerNestedSandbox:true,outerIsolationBoundary:false}}});try{await assert.rejects(f.execute({binding}),/EXECUTION_FAILED|BASH_SANDBOX_ATTESTATION_REFUSED/);assert.equal(f.calls(),0);}finally{f.close();}
});
