/** The terminal `run.status` names the fault when the worker can: a selected skill the worker cannot run, a required source no
 * mounted read covers, the model's turn or spend budget, and the output limit. Everything else stays EXECUTION_FAILED, and the
 * activity's own throw keeps the generic code the runner settles on. Scripted SDK and reads port; no provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import catalog from '../../../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {RUN_REASON_CODES} from '../../../../packages/contracts/conversation-application/protocol.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {createConversationActivity} from '../activity.mjs';
import {terminalReasonCode,NAMED_FAULT_CODES} from '../terminal-reason.mjs';
import {applicationFixture,binding,scopes,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
import {sep} from 'node:path';
import {plugin,preparedWorkspace} from './capability-fixture.mjs';
const cwd=`/workspace/conversations/${binding.conversationId}`;
// The plugin runs need an existing workspace beside the materialized plugin image; the fixed Bedrock workspace path need not exist.
const pluginRuntime={cwd:preparedWorkspace(binding.conversationId).split(sep).join('/').replace(/^[A-Za-z]:/u,''),skillPluginDirectory:plugin};
const runtime=()=>({binding,versions,cwd,model:'us.anthropic.claude-sonnet-4-6',region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+2000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024});
const frames=[{type:'stream_event',parent_tool_use_id:null,event:{type:'message_start',message:{id:'msg_1'}}},{type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'Hello'}}},{type:'assistant',parent_tool_use_id:null,message:{id:'msg_1',content:[{type:'text',text:'Hello'}]}},{type:'result',subtype:'success',is_error:false}];
const mail=selectSkill('quick_skill.mail_history','1.0.1'),skillInput={requestId:id(6),prompt:'Summarize the last three email threads',skill:{skillId:mail.pin.skillId,skillVersion:mail.pin.skillVersion},windowRequest:{basis:'explicit',startInclusive:'2026-10-01T00:00:00Z',endExclusive:'2026-10-24T00:00:00Z',timezone:'UTC'}};
/** A trusted general-read port whose snapshot installs and grants exactly `operations`. */
const readPort=operations=>({async readAvailability(){const at=Date.now();return {installation:{installationId:id(80),baseCatalogSha256:canonicalSha256(catalog),executionCatalogSha256:'e'.repeat(64),operations,checkedAtMs:at-1000,expiresAtMs:at+600000},discovery:{binding,policyRevision:scopes[0].policyRevision,operations,checkedAtMs:at-1000,expiresAtMs:at+600000}};},async execute(){throw Error('not called');}});
const POLICY={skillPlugin:true,generalReads:true,readFamilies:['mail','entity-candidates','tenant-contacts'],activeReadOperations:mail.manifest.allowedOperations};
async function setup({input,sdk=frames,capabilities,selectedSkills,generalReads,runtimeFacts={}}={}){
 const f=await applicationFixture({initialInput:true}),request=input??f.input;await f.service.allocateInput({credential:f.credential,input:request});await f.service.submit({credential:f.credential,input:request});
 let n=200,calls=0;const runOwner={load:async a=>{const saved=await f.runOwner.load(a);return capabilities===undefined?saved:{...saved,capabilities};},append:a=>f.runOwner.append(a)};
 const query=()=>{calls++;return {async *[Symbol.asyncIterator](){for(const frame of sdk)yield frame;},close(){}};};
 const execute=createConversationActivity({runOwner,prepareRuntime:async()=>({...runtime(),...runtimeFacts}),query,newId:()=>id(n++),...(selectedSkills?{selectedSkills}:{}),...(generalReads?{generalReads}:{})});
 const terminal=async()=>{const h=await f.service.history({credential:f.credential});return {state:h.run.state,reasonCode:h.events.findLast(e=>e.type==='run.status').data.reasonCode};};
 return {...f,execute,terminal,calls:()=>calls};
}
test('the named fault map is closed over the public vocabulary and everything else is EXECUTION_FAILED',()=>{
 for(const code of NAMED_FAULT_CODES)assert.ok(RUN_REASON_CODES.includes(terminalReasonCode({code})),code);
 for(const unknown of [{code:'SDK_EXECUTION_FAILED'},{code:'SESSION_PERSISTENCE_FAILED'},Error('PRIVATE'),undefined,null,{code:'OUTPUT_LIMIT ',message:'OUTPUT_LIMIT'}])assert.equal(terminalReasonCode(unknown),'EXECUTION_FAILED');
 assert.deepEqual(NAMED_FAULT_CODES,['SKILL_RUNTIME_REFUSED','SKILL_SOURCES_UNAVAILABLE','MODEL_TURNS_EXHAUSTED','MODEL_BUDGET_EXHAUSTED','OUTPUT_LIMIT']);
});
for(const [subtype,reasonCode] of [['error_max_turns','MODEL_TURNS_EXHAUSTED'],['error_max_budget_usd','MODEL_BUDGET_EXHAUSTED'],['error_during_execution','EXECUTION_FAILED']])test(`an SDK ${subtype} result settles the run failed with ${reasonCode} and no answer`,async()=>{
 const f=await setup({sdk:[frames[0],frames[1],frames[2],{type:'result',subtype,is_error:true,errors:['PRIVATE']}]});
 try{await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);assert.deepEqual(await f.terminal(),{state:'failed',reasonCode});assert.equal(f.calls(),1);
  assert.equal(JSON.stringify(await f.service.history({credential:f.credential})).includes('PRIVATE'),false);}finally{f.close();}
});
test('an answer over the output limit settles the run failed with OUTPUT_LIMIT',async()=>{
 const f=await setup({runtimeFacts:{maxOutputBytes:2}});
 try{await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);assert.deepEqual(await f.terminal(),{state:'failed',reasonCode:'OUTPUT_LIMIT'});}finally{f.close();}
});
test('a selected plugin skill on a worker without mounted reads or policy fails with SKILL_RUNTIME_REFUSED before any model query (the live Mail History run)',async()=>{
 const f=await setup({input:skillInput,selectedSkills:{prepare:async()=>null}});
 try{await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);assert.deepEqual(await f.terminal(),{state:'failed',reasonCode:'SKILL_RUNTIME_REFUSED'});assert.equal(f.calls(),0);}finally{f.close();}
});
test('a selected plugin skill whose required source no mounted read covers fails with SKILL_SOURCES_UNAVAILABLE before any model query',async()=>{
 const f=await setup({input:skillInput,selectedSkills:{prepare:async()=>null},capabilities:POLICY,runtimeFacts:pluginRuntime,generalReads:readPort(mail.manifest.allowedOperations.filter(op=>!op.id.startsWith('mail.')))});
 try{await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);assert.deepEqual(await f.terminal(),{state:'failed',reasonCode:'SKILL_SOURCES_UNAVAILABLE'});assert.equal(f.calls(),0);}finally{f.close();}
});
test('the same selected plugin skill runs once every required source has an available read',async()=>{
 const f=await setup({input:skillInput,selectedSkills:{prepare:async()=>null},capabilities:POLICY,runtimeFacts:pluginRuntime,generalReads:readPort(mail.manifest.allowedOperations.filter(op=>op.id!=='mail.list_messages'))});
 try{assert.deepEqual(await f.execute({binding}),{state:'completed'});assert.deepEqual(await f.terminal(),{state:'completed',reasonCode:null});assert.equal(f.calls(),1);}finally{f.close();}
});
