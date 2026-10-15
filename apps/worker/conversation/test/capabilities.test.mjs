/** Capability policy, per-capability option output, hook publication and secrecy; no SDK process or provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {assertCapabilityPolicy,readCapabilityPolicy,SUBAGENT_TYPES,WORKSPACE_TOOLS} from '../capabilities/policy.mjs';
import {createWorkspaceTools,withinWorkspace,BUILTIN_TOOL_NAMES} from '../capabilities/workspace-tools.mjs';
import {createSubagents,admitAgentInput} from '../capabilities/subagents.mjs';
import {createAuditHooks,createCompactionHooks,createSubagentLifecycleHooks} from '../capabilities/hooks.mjs';
import {createSkillPlugin} from '../capabilities/skill-plugin.mjs';
import {createProgressProjector} from '../capabilities/progress.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';
import {describeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
import {binding,id} from '../../../control/conversations/test/application-fixture.mjs';
const cwd=`/workspace/conversations/${binding.conversationId}`,plugin='/opt/meri/image/skill-plugin',sha=v=>createHash('sha256').update(canonicalize(v),'utf8').digest('hex');
const SECRET='PRIVATE-TOKEN-9f8e',CONTENT='PRIVATE FILE CONTENT';
const hookOptions={signal:new AbortController().signal},base={session_id:id(40),transcript_path:'/tmp/t.jsonl',cwd};
const scripted=()=>{const events=[];return {events,runOwner:{append:async({binding:b,event})=>{assert.deepEqual(b,binding);events.push(event);}}};};
const all={subagents:true,auditHooks:true,compactionHooks:true,skillPlugin:true,workspaceTools:true,subagentProgress:true};
const facts=(owner,extra={})=>({runOwner:owner,binding,cwd,now:()=>1760000000000,newId:(()=>{let n=300;return ()=>id(n++);})(),...extra});

test('policy defaults every capability off and bounds every allowlist',()=>{
 const p=assertCapabilityPolicy({});assert.deepEqual(p,{subagents:false,auditHooks:false,compactionHooks:false,skillPlugin:false,workspaceTools:false,subagentProgress:false,subagentTypes:[...SUBAGENT_TYPES],maxParallelSubagents:2,workspaceToolNames:[...WORKSPACE_TOOLS],skillNames:null});assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.subagentTypes));
 assert.deepEqual(assertCapabilityPolicy({subagents:true,subagentTypes:['verification'],maxParallelSubagents:4,workspaceToolNames:['Read'],skillNames:['meri-research-company']}).subagentTypes,['verification']);
 for(const bad of [{unknown:true},{subagents:'yes'},{subagentTypes:[]},{subagentTypes:['research','research']},{subagentTypes:['general-purpose']},{maxParallelSubagents:0},{maxParallelSubagents:5},{workspaceToolNames:['WebFetch']},{skillNames:['Bad Name']},{skillNames:Array.from({length:33},(_,i)=>`s${i}`)},{subagentProgress:true},null,[],'x'])assert.throws(()=>assertCapabilityPolicy(bad),/CAPABILITY_POLICY_REFUSED|INVALID_COMMAND/,JSON.stringify(bad));
 assert.equal(readCapabilityPolicy({run:{},request:{}}),undefined);assert.equal(readCapabilityPolicy(null),undefined);assert.equal(readCapabilityPolicy({capabilities:undefined}),undefined);
 assert.equal(readCapabilityPolicy({capabilities:{auditHooks:true}}).auditHooks,true);for(const raw of [{},{subagents:true,subagentProgress:true,skillNames:['meri-meeting-prep']}])assert.deepEqual(assertCapabilityPolicy(assertCapabilityPolicy(raw)),assertCapabilityPolicy(raw),'validation is idempotent');assert.throws(()=>readCapabilityPolicy({capabilities:{nope:1}}),/INVALID_COMMAND/);
});

test('workspace tools stay inside the conversation workspace through both the permission callback and the gate hook',async()=>{
 const w=createWorkspaceTools(assertCapabilityPolicy({workspaceTools:true,workspaceToolNames:['Bash','Grep','Glob','Read']}),{cwd});
 assert.deepEqual(w.tools,['Read','Glob','Grep','Bash']);assert.deepEqual(w.allowedTools,['Read','Glob','Grep','Bash']);assert.equal(w.hooks.PreToolUse[0].matcher,'^(Read|Glob|Grep|Bash)$');
 const inside=[['Read',{file_path:`${cwd}/notes.md`}],['Grep',{pattern:'x'}],['Grep',{pattern:'x',path:cwd}],['Bash',{command:`ls ${cwd}/out 2>/dev/null | head`}],['Bash',{command:'cat ./a.txt'}],['Bash',{command:'cd out && ls'}],['Glob',{pattern:'**/*.md'}],['Grep',{pattern:'/etc',glob:'*.md'}]];
 const outside=[['Read',{file_path:'/etc/passwd'}],['Read',{file_path:`${cwd}2/x`}],['Read',{file_path:`${cwd}/../other`}],['Read',{file_path:'relative.md'}],['Grep',{pattern:'x',path:'/workspace'}],['Bash',{command:'cat ~/.ssh/id_rsa'}],['Bash',{command:'cat ../secret'}],['Bash',{command:'echo $HOME'}],['Bash',{command:'cat `which node`'}],['Bash',{command:'ls /'}],['Bash',{command:'cd && cat .ssh/id_rsa'}],['Bash',{command:'cd -; ls'}],['Glob',{pattern:'/etc/*'}],['Glob',{pattern:'../*'}],['Grep',{pattern:'x',glob:'/etc/**'}],['Bash',{command:`cp ${cwd}/a /tmp/b`}],['Bash',{command:'x'.repeat(4097)}],['Agent',{prompt:'x'}],['Read','string'],['Read',null]];
 assert.equal(withinWorkspace('Write',{file_path:`${cwd}/x`},cwd),true);assert.equal((await w.canUseTool('Write',{file_path:`${cwd}/x`},hookOptions)).behavior,'deny','Write is inside the workspace but not enabled by this policy');assert.equal((await w.hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'Write',tool_input:{file_path:`${cwd}/x`},tool_use_id:'t1'},'t1',hookOptions)).hookSpecificOutput.permissionDecision,'deny');
 for(const [tool,input] of inside){assert.equal(withinWorkspace(tool,input,cwd),true,JSON.stringify(input));assert.equal((await w.canUseTool(tool,input,hookOptions)).behavior,'allow');assert.deepEqual(await w.hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:tool,tool_input:input,tool_use_id:'t1'},'t1',hookOptions),{});}
 for(const [tool,input] of outside){assert.equal(withinWorkspace(tool,input,cwd),false,JSON.stringify(input));assert.equal((await w.canUseTool(tool,input,hookOptions)).behavior,'deny');assert.equal((await w.hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:tool,tool_input:input,tool_use_id:'t1'},'t1',hookOptions)).hookSpecificOutput.permissionDecision,'deny');}
 assert.throws(()=>createWorkspaceTools(assertCapabilityPolicy({workspaceTools:true}),{cwd:'relative/path'}),/WORKSPACE_ROOT_REFUSED/);
});

test('subagent definitions use declared SDK fields and the Agent gate bounds type, options and parallelism',async()=>{
 const s=createSubagents(assertCapabilityPolicy({subagents:true,workspaceTools:true,workspaceToolNames:['Read','Write'],maxParallelSubagents:1}));
 assert.deepEqual(Object.keys(s.agents),[...SUBAGENT_TYPES]);
 for(const d of Object.values(s.agents))assert.deepEqual(Object.keys(d).sort(),['description','disallowedTools','maxTurns','model','omitClaudeMd','prompt','tools']);
 assert.deepEqual(s.agents.research.tools,['Read']);assert.deepEqual(s.agents.artifact_production.tools,['Read','Write']);assert.ok(s.agents.verification.disallowedTools.includes('Agent')&&s.agents.verification.disallowedTools.includes('Bash'));assert.equal(s.agents.analysis.model,'inherit');
 const off=createSubagents(assertCapabilityPolicy({subagents:true}));assert.deepEqual(off.agents.artifact_production.tools,[]);
 assert.deepEqual(admitAgentInput({description:'d',prompt:'p',subagent_type:'research',run_in_background:true,name:'x'},SUBAGENT_TYPES),{description:'d',prompt:'p',subagent_type:'research',run_in_background:false});
 for(const bad of [{description:'d',prompt:'p'},{description:'d',prompt:'p',subagent_type:'general-purpose'},{description:'d',prompt:'p',subagent_type:'fork'},{description:'d',prompt:'p',subagent_type:'research',model:'opus'},{description:'d',prompt:'p',subagent_type:'research',isolation:'remote'},{description:'d',prompt:'p',subagent_type:'research',effort:'max'},{description:'d',prompt:'p',subagent_type:'research',extra:1},'x'])assert.equal(admitAgentInput(bad,SUBAGENT_TYPES),null,JSON.stringify(bad));
 const admit=s.hooks.PreToolUse[0].hooks[0],release=s.hooks.PostToolUse[0].hooks[0],call=(tool_use_id,tool_input)=>admit({...base,hook_event_name:'PreToolUse',tool_name:'Agent',tool_input,tool_use_id},tool_use_id,hookOptions);
 const first=await call('a1',{description:'d',prompt:'p',subagent_type:'analysis',run_in_background:true});assert.equal(first.hookSpecificOutput.permissionDecision,'allow');assert.equal(first.hookSpecificOutput.updatedInput.run_in_background,false);
 assert.equal((await call('a2',{description:'d',prompt:'p',subagent_type:'analysis'})).hookSpecificOutput.permissionDecision,'deny');
 await release({...base,hook_event_name:'PostToolUse',tool_name:'Agent',tool_input:{},tool_response:{},tool_use_id:'a1'},'a1',hookOptions);
 assert.equal((await call('a2',{description:'d',prompt:'p',subagent_type:'analysis'})).hookSpecificOutput.permissionDecision,'allow');
 assert.equal((await call('a3',{description:'d',prompt:'p',subagent_type:'verification',model:'haiku'})).hookSpecificOutput.permissionDecision,'deny');
 assert.equal((await s.canUseTool('Agent',{description:'d',prompt:'p',subagent_type:'research'},hookOptions)).behavior,'allow');assert.equal((await s.canUseTool('Agent',{description:'d',prompt:'p',subagent_type:'Explore'},hookOptions)).behavior,'deny');assert.equal((await s.canUseTool('Bash',{command:'ls'},hookOptions)).behavior,'deny');
});

test('audit, compaction and subagent hooks publish hashes and names only, never raw input, output, errors or summaries',async()=>{
 const published=[];const publish=async(type,data,signal)=>{assert.ok(signal instanceof AbortSignal);published.push({type,data});};
 const audit=createAuditHooks({publish}),compaction=createCompactionHooks({publish}),lifecycle=createSubagentLifecycleHooks({publish});
 const toolInput={command:`curl -H 'Authorization: ${SECRET}' https://x.invalid`},response={stdout:CONTENT};
 assert.deepEqual(await audit.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:toolInput,tool_use_id:'t1',agent_id:'ag1',agent_type:'research'},'t1',hookOptions),{});
 assert.deepEqual(await audit.PostToolUse[0].hooks[0]({...base,hook_event_name:'PostToolUse',tool_name:'Bash',tool_input:toolInput,tool_response:response,tool_use_id:'t1',duration_ms:12},'t1',hookOptions),{});
 assert.deepEqual(await audit.PostToolUseFailure[0].hooks[0]({...base,hook_event_name:'PostToolUseFailure',tool_name:'Read',tool_input:{file_path:`${cwd}/${SECRET}`},tool_use_id:'t2',error:`ENOENT ${CONTENT}`,is_interrupt:false},'t2',hookOptions),{});
 assert.deepEqual(await compaction.PreCompact[0].hooks[0]({...base,hook_event_name:'PreCompact',trigger:'auto',custom_instructions:null},undefined,hookOptions),{});
 assert.deepEqual(await compaction.PostCompact[0].hooks[0]({...base,hook_event_name:'PostCompact',trigger:'manual',compact_summary:`Summary with ${SECRET} and ${CONTENT}`},undefined,hookOptions),{});
 assert.deepEqual(await lifecycle.SubagentStart[0].hooks[0]({...base,hook_event_name:'SubagentStart',agent_id:'ag1',agent_type:'research'},undefined,hookOptions),{});
 assert.deepEqual(await lifecycle.SubagentStop[0].hooks[0]({...base,hook_event_name:'SubagentStop',stop_hook_active:false,agent_id:'ag1',agent_transcript_path:'/tmp/x',agent_type:'research',last_assistant_message:CONTENT},undefined,hookOptions),{});
 assert.deepEqual(published.map(e=>e.type),['tool.audit','tool.audit','tool.audit','compaction.boundary','compaction.boundary','subagent.lifecycle','subagent.lifecycle']);
 assert.deepEqual(published[0].data,{phase:'requested',toolUseId:'t1',tool:'Bash',inputSha256:sha(toolInput),agentId:'ag1',agentType:'research'});
 assert.deepEqual(published[1].data,{phase:'completed',toolUseId:'t1',tool:'Bash',inputSha256:sha(toolInput),agentId:null,agentType:null,responseSha256:sha(response),durationMs:12});
 assert.deepEqual(published[2].data,{phase:'failed',toolUseId:'t2',tool:'Read',inputSha256:sha({file_path:`${cwd}/${SECRET}`}),agentId:null,agentType:null,errorSha256:sha(`ENOENT ${CONTENT}`),interrupted:false,durationMs:null});
 assert.deepEqual(published[3].data,{phase:'pre',trigger:'auto',agentId:null,agentType:null});
 assert.deepEqual(published[4].data,{phase:'post',trigger:'manual',summarySha256:sha(`Summary with ${SECRET} and ${CONTENT}`),summaryBytes:Buffer.byteLength(`Summary with ${SECRET} and ${CONTENT}`),agentId:null,agentType:null});
 assert.deepEqual(published[5].data,{phase:'started',agentId:'ag1',agentType:'research'});assert.deepEqual(published[6].data,{phase:'stopped',agentId:'ag1',agentType:'research'});
 const serialized=JSON.stringify(published);assert.ok(!serialized.includes(SECRET)&&!serialized.includes(CONTENT)&&!serialized.includes('curl')&&!serialized.includes('/tmp/x'));
 // Malformed hook input and a refused publication fail closed.
 const refused=async()=>{throw Error('EVENT_TYPE_REFUSED');},failing=createAuditHooks({publish:refused}),failingCompaction=createCompactionHooks({publish:refused});
 assert.equal((await failing.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:{},tool_use_id:'t1'},'t1',hookOptions)).hookSpecificOutput.permissionDecision,'deny');
 assert.deepEqual(await failing.PostToolUse[0].hooks[0]({...base,hook_event_name:'PostToolUse',tool_name:'Bash',tool_input:{},tool_response:{},tool_use_id:'t1'},'t1',hookOptions),{continue:false,stopReason:'AUDIT_UNAVAILABLE'});
 assert.deepEqual(await failingCompaction.PreCompact[0].hooks[0]({...base,hook_event_name:'PreCompact',trigger:'auto',custom_instructions:null},undefined,hookOptions),{continue:false,stopReason:'AUDIT_UNAVAILABLE'});
 assert.equal((await audit.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'',tool_input:{},tool_use_id:'t9'},'t9',hookOptions)).hookSpecificOutput.permissionDecision,'deny');
 assert.deepEqual(await compaction.PostCompact[0].hooks[0]({...base,hook_event_name:'PostCompact',trigger:'other',compact_summary:''},undefined,hookOptions),{continue:false,stopReason:'AUDIT_UNAVAILABLE'});
 assert.equal(published.length,7);
});

test('skill plugin binds the immutable image path and the original names; cwd discovery is refused',async()=>{
 const described=describeSkillPlugin();assert.equal(described.skills.length,13);assert.deepEqual(described.excluded,[{skillId:'quick_skill.bill_watch',skillVersion:'1.0.0',reason:'NO_SDK_FRONTMATTER'}]);
 const s=createSkillPlugin(assertCapabilityPolicy({skillPlugin:true}),{skillPluginDirectory:plugin,cwd});
 assert.deepEqual(s.plugins,[{type:'local',path:plugin,skipMcpDiscovery:true}]);assert.deepEqual(s.skills,described.skills.map(k=>`meri-original-skills:${k.name}`));assert.deepEqual(s.tools,['Skill']);assert.deepEqual(s.allowedTools,[],'Skill is enabled through the skills option, never the deprecated allowedTools entry');
 assert.deepEqual(createSkillPlugin(assertCapabilityPolicy({skillPlugin:true,skillNames:['meri-meeting-prep']}),{skillPluginDirectory:plugin,cwd}).skills,['meri-original-skills:meri-meeting-prep']);
 assert.throws(()=>createSkillPlugin(assertCapabilityPolicy({skillPlugin:true,skillNames:['meri-unknown']}),{skillPluginDirectory:plugin,cwd}),/SKILL_PLUGIN_NAME_REFUSED/);
 for(const bad of [cwd,`${cwd}/plugin`,'/workspace','relative',`${plugin}/`,`${plugin}/../x`,undefined])assert.throws(()=>createSkillPlugin(assertCapabilityPolicy({skillPlugin:true}),{skillPluginDirectory:bad,cwd}),/SKILL_PLUGIN_DIRECTORY_REFUSED/,String(bad));
 assert.equal((await s.canUseTool('Skill',{skill:'meri-original-skills:meri-meeting-prep'},hookOptions)).behavior,'allow');assert.equal((await s.canUseTool('Skill',{skill:'meri-meeting-prep'},hookOptions)).behavior,'allow');assert.equal((await s.canUseTool('Skill',{skill:'pdf'},hookOptions)).behavior,'deny');assert.equal((await s.canUseTool('Skill',{skill:'other-plugin:meri-meeting-prep'},hookOptions)).behavior,'deny','a foreign plugin prefix is not the original plugin');assert.equal((await s.canUseTool('Read',{skill:'meri-meeting-prep'},hookOptions)).behavior,'deny');
});

test('progress projector displays only admitted one-line summaries',()=>{
 const off=createProgressProjector({policy:undefined,newId:()=>id(1)});assert.deepEqual(off({type:'system',subtype:'task_progress',task_id:'t',summary:'x'}),[]);
 const on=createProgressProjector({policy:assertCapabilityPolicy({subagents:true,subagentProgress:true}),newId:()=>id(2)});
 assert.deepEqual(on({type:'system',subtype:'task_progress',task_id:'t',subagent_type:'research',summary:' Reading sources ',description:CONTENT}),[{messageId:id(2),text:'research: Reading sources'}]);
 assert.deepEqual(on({type:'system',subtype:'task_progress',task_id:'t',subagent_type:'Explore',summary:'x'}),[{messageId:id(2),text:'subagent: x'}]);
 assert.deepEqual(on({type:'system',subtype:'task_progress',task_id:'t',usage:{}}),[]);assert.deepEqual(on({type:'system',subtype:'task_progress',task_id:'t',summary:'  '}),[]);
 assert.deepEqual(on({type:'assistant',parent_tool_use_id:'x',message:{content:[{type:'text',text:CONTENT}]}}),[]);
 assert.throws(()=>on({type:'system',subtype:'task_progress',task_id:'t',summary:'x'.repeat(2049)}),/SDK_PROGRESS_REFUSED/);
});

test('composition yields an all-off empty fragment and per-capability additive fragments that only use declared option names',async()=>{
 const {runOwner,events}=scripted();
 assert.deepEqual(createSdkCapabilities({},facts(runOwner)).options,{});
 const workspace=createSdkCapabilities({workspaceTools:true,workspaceToolNames:['Read']},facts(runOwner)).options;
 assert.deepEqual(Object.keys(workspace).sort(),['allowedTools','canUseTool','disallowedTools','hooks','tools']);assert.deepEqual(workspace.tools,['Read']);assert.deepEqual(workspace.disallowedTools,BUILTIN_TOOL_NAMES.filter(n=>n!=='Read'));assert.deepEqual(Object.keys(workspace.hooks),['PreToolUse']);
 const audit=createSdkCapabilities({auditHooks:true,compactionHooks:true},facts(runOwner)).options;assert.deepEqual(Object.keys(audit),['hooks']);assert.deepEqual(Object.keys(audit.hooks),['PreToolUse','PostToolUse','PostToolUseFailure','PreCompact','PostCompact']);
 const subagents=createSdkCapabilities({subagents:true,subagentProgress:true},facts(runOwner)).options;assert.deepEqual(Object.keys(subagents).sort(),['agentProgressSummaries','agents','allowedTools','canUseTool','disallowedTools','hooks','tools']);assert.deepEqual(subagents.tools,['Agent']);assert.equal(subagents.agentProgressSummaries,true);assert.deepEqual(Object.keys(subagents.hooks),['PreToolUse','PostToolUse','PostToolUseFailure','SubagentStart','SubagentStop']);
 assert.equal(createSdkCapabilities({subagents:true},facts(runOwner)).options.agentProgressSummaries,undefined);
 const skill=createSdkCapabilities({skillPlugin:true},facts(runOwner,{skillPluginDirectory:plugin})).options;assert.deepEqual(Object.keys(skill).sort(),['allowedTools','canUseTool','disallowedTools','plugins','skills','tools']);
 assert.throws(()=>createSdkCapabilities({skillPlugin:true},facts(runOwner)),/SKILL_PLUGIN_DIRECTORY_REQUIRED/);
 const full=createSdkCapabilities(all,facts(runOwner,{skillPluginDirectory:plugin}));assert.deepEqual(full.options.tools,['Read','Write','Edit','Glob','Grep','Bash','Agent','Skill']);assert.equal(full.options.hooks.PreToolUse.length,3);assert.equal(full.options.forwardSubagentText,undefined);
 assert.equal((await full.options.canUseTool('Read',{file_path:`${cwd}/a`},hookOptions)).behavior,'allow');assert.equal((await full.options.canUseTool('Agent',{description:'d',prompt:'p',subagent_type:'research'},hookOptions)).behavior,'allow');assert.equal((await full.options.canUseTool('WebFetch',{url:'https://x'},hookOptions)).behavior,'deny');assert.equal((await full.options.canUseTool('Read',{file_path:'/etc/hosts'},hookOptions)).behavior,'deny');
 await full.options.hooks.PreToolUse[2].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'Read',tool_input:{file_path:`${cwd}/a`},tool_use_id:'t1'},'t1',hookOptions);
 assert.deepEqual(events.map(e=>[e.eventId,e.createdAt,e.type]),[[id(300),'2025-10-09T08:53:20.000Z','tool.audit']]);full.check();
 for(const bad of [{runOwner:{},binding,cwd,now:Date.now,newId:()=>'x'},{runOwner,binding:{...binding,tenantId:''},cwd,now:Date.now,newId:()=>'x'},{runOwner,binding,cwd:'/x/',now:Date.now,newId:()=>'x'},{runOwner,binding,cwd,now:Date.now,newId:()=>'x',extra:1}])assert.throws(()=>createSdkCapabilities(all,bad));
});

test('a refused capability event is remembered and fails the run after the loop',async()=>{
 let calls=0;const refusing={append:async()=>{calls++;throw Error('EVENT_TYPE_REFUSED');}};
 const c=createSdkCapabilities({auditHooks:true},facts(refusing));c.check();
 assert.equal((await c.options.hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'Read',tool_input:{file_path:`${cwd}/a`},tool_use_id:'t1'},'t1',hookOptions)).hookSpecificOutput.permissionDecision,'deny');
 assert.throws(()=>c.check(),/CAPABILITY_EVENT_REFUSED/);
 assert.deepEqual(await c.options.hooks.PostToolUse[0].hooks[0]({...base,hook_event_name:'PostToolUse',tool_name:'Read',tool_input:{},tool_response:{},tool_use_id:'t1'},'t1',hookOptions),{continue:false,stopReason:'AUDIT_UNAVAILABLE'});
 assert.equal(calls,1,'after the first refusal no further publication is attempted');
});
