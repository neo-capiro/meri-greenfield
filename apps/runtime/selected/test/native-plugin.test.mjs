/** Actual admission/store, plugin projection and SDK options; scripted model and unavailable data transport. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {describeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {createOriginalSkillAdmissionOwner} from '../../../control/conversations/skills/admission.mjs';
import {applicationFixture,binding,scopes,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
import {createConversationActivity} from '../../../worker/conversation/activity.mjs';
import {plugin,preparedWorkspace} from '../../../worker/conversation/test/capability-fixture.mjs';
import {createTaskSelectedSkills} from '../task.mjs';
import {selectedOutputCompiler} from '../output-format.mjs';
import {familyReads} from '../../../worker/conversation/reads/availability.mjs';
import {mkdtemp,readFile,readdir,chmod,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareRunSkillPlugin,sdkSkillPluginDirectory} from '../../../worker/conversation/capabilities/skill-plugin.mjs';

const windowRequest={basis:'explicit',startInclusive:'2026-10-01T00:00:00Z',endExclusive:'2026-10-24T00:00:00Z',timezone:'UTC'};
const unused=()=>assert.fail('not a source of admission authority');
async function fixture(skill,{general,capabilities,versionedPlugin=false}={}){
 const selected=selectSkill(skill.skillId,skill.skillVersion);
 general??=!selected.manifest.subjectKinds.includes('client');
 const activeScopes=general?[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:scopes[0].policyRevision}]:scopes;
 const selectedClientId=general?null:id(5);
 const selectedSkillAdmission={admitSelection:input=>createOriginalSkillAdmissionOwner({binding:input.binding,now:Date.now,loadConversation:unused,readCurrentContext:unused,
  readSelection:({request,scopes,selectedClientId})=>({subject:{kind:'client',entityType:'client',entityIds:[selectedClientId],tenantId:binding.tenantId,actorId:binding.actorId,policyRevision:scopes[0].policyRevision,scopes,rosterVersionId:null},window:request.window,mondayBoardIds:[]})}).admitSelection(input)};
 const f=await applicationFixture({initialInput:true,scopes:activeScopes,selectedClientId,serviceOptions:{selectedSkillAdmission}});
 const input={...f.input,prompt:'Run the reviewed original skill',skill:{skillId:skill.skillId,skillVersion:skill.skillVersion},windowRequest};
 const task=createTaskSelectedSkills({sourceEnabled:true,native:{call:unused}});let queryCalls=0,seen,n=800;const failures=[];
 const root=versionedPlugin?await mkdtemp(join(tmpdir(),'meri-selected-version-')):null;let selectedPlugin=plugin;
 const reads={async readAvailability(){throw Error('synthetic source unavailable');},execute:unused};
 const activeReadOperations=familyReads().filter(row=>selected.manifest.allowedOperations.some(op=>op.id===row.operation.id&&op.version===row.operation.version)).map(row=>row.operation);
 const runOwner={...f.runOwner,async load(args){return {...await f.runOwner.load(args),capabilities:capabilities??{skillPlugin:true,generalReads:true,skillNames:[skill.name],activeReadOperations}};}};
 const execute=createConversationActivity({runOwner,selectedSkills:task,generalReads:reads,newId:()=>id(n++),diagnostics:{failure:error=>failures.push(error)},
  prepareRuntime:async({request})=>{if(root){assert.deepEqual(request.skill,selected.pin);selectedPlugin=sdkSkillPluginDirectory(root,request.skill);await prepareRunSkillPlugin(selectedPlugin,{selection:request.skill});}const directory=preparedWorkspace(binding.conversationId),cwd=root&&process.platform==='win32'?directory.replaceAll('\\','/').replace(/^[A-Za-z]:/u,''):directory;return {binding,versions,cwd,skillPluginDirectory:selectedPlugin,
   model:'us.anthropic.claude-sonnet-4-6',region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+5000,maxTurns:50,maxCostMicroUSD:1000000,maxOutputBytes:262144};},
  query({options}){queryCalls++;seen=options;return {async *[Symbol.asyncIterator](){yield {type:'assistant',parent_tool_use_id:null,message:{id:'synthetic',content:[{type:'text',text:'Source coverage is unavailable in this fixture.'}]}};yield {type:'result',subtype:'success',is_error:false};},close(){}};}});
 return {...f,selected,input,execute,failures,queryCalls:()=>queryCalls,options:()=>seen,async close(){await task.close();f.close();if(root){const unseal=async d=>{await chmod(d,0o700);for(const e of await readdir(d,{withFileTypes:true})){const p=join(d,e.name);if(e.isDirectory())await unseal(p);else await chmod(p,0o600);}};await unseal(root);await rm(root,{recursive:true,force:true});}}};
}

for(const skillVersion of ['1.0.0','1.1.0'])test(`Q04 selected ${skillVersion}: saved pin reaches runtime materialization and exact MCP narrowing`,async()=>{
 const f=await fixture({skillId:'quick_skill.pe_deep_dive',skillVersion,name:'meri-pe-deep-dive'},{versionedPlugin:true});
 try{await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
  assert.deepEqual(await f.execute({binding}).catch(e=>{throw f.failures[0]??e;}),{state:'completed'});
  const o=f.options();assert.equal(await readFile(join(o.plugins[0].path,'skills','meri-pe-deep-dive','SKILL.md'),'utf8'),f.selected.prose);
  assert.equal(o.allowedTools.includes('mcp__meri_reads__query_capiro_data'),skillVersion==='1.1.0');
  assert.ok(o.systemPrompt.append.includes(f.selected.prose));assert.deepEqual((await f.service.history({credential:f.credential})).request.skill,f.selected.pin);
 }finally{await f.close();}
});

for(const skill of describeSkillPlugin().skills)test(`${skill.skillId}: canonical selection persists and uses its existing execution owner`,async()=>{
 const f=await fixture(skill);
 try{
  await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
  const accepted=await f.service.history({credential:f.credential});assert.deepEqual(accepted.request.skill,f.selected.pin);assert.deepEqual(accepted.request.windowRequest,windowRequest);
  if(selectedOutputCompiler(f.selected))return; // Actual compiler/MCP/publication is covered by composition.test.mjs.
  const result=await f.execute({binding}).catch(error=>{throw f.failures[0]??error;});assert.deepEqual(result,{state:'completed'});assert.equal(f.queryCalls(),1);
  const options=f.options();assert.ok(options.systemPrompt.append.includes(f.selected.prose));assert.ok(options.mcpServers.meri_reads);assert.equal(options.mcpServers.meri_original_reads,undefined);
  assert.equal(options.skills,'all');assert.deepEqual(options.plugins,[{type:'local',path:plugin,skipMcpDiscovery:true}]);assert.equal(options.outputFormat,undefined);
  assert.equal(options.maxTurns,Math.min(50,f.selected.manifest.budgets.maxTurns));assert.equal(options.maxBudgetUsd,Math.min(1,f.selected.manifest.budgets.maxCostMicroUSD/1000000));
  const after=await f.service.history({credential:f.credential});assert.equal(after.run.state,'completed');assert.deepEqual(after.request,accepted.request);
 }finally{await f.close();}
});

for(const [skillId,general] of [['quick_skill.client_changes',true],['quick_skill.portfolio_changes',false]])test(`${skillId}: wrong conversation scope refuses before allocation`,async()=>{
 const f=await fixture(describeSkillPlugin().skills.find(s=>s.skillId===skillId),{general});
 try{await assert.rejects(f.service.allocateInput({credential:f.credential,input:f.input}));assert.equal(f.state.runs.size,0);assert.equal(f.queryCalls(),0);}finally{await f.close();}
});
for(const capabilities of [{skillPlugin:false,generalReads:true},{skillPlugin:true,generalReads:false},{skillPlugin:true,generalReads:true,skillNames:['meri-mail-history']}])test('native selected skill cannot exceed the configured plugin/read capability',async()=>{
 const f=await fixture(describeSkillPlugin().skills.find(s=>s.skillId==='quick_skill.client_changes'),{capabilities});
 try{await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});await assert.rejects(f.execute({binding}));assert.equal(f.queryCalls(),0);}finally{await f.close();}
});
