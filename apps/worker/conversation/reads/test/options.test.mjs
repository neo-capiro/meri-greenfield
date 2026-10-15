/** Options composition for `meri_reads` and the activity mount decision. Scripted SDK query, synthetic ports, no provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {buildConversationOptions} from '../../options.mjs';
import {createConversationActivity} from '../../activity.mjs';
import {createSdkCapabilities} from '../../capabilities/index.mjs';
import {applicationFixture,binding,versions,id} from '../../../../control/conversations/test/application-fixture.mjs';
import {preparedWorkspace} from '../../test/capability-fixture.mjs';
import {generalReadFixture,mountReads} from './fixture.mjs';
const cwd=preparedWorkspace(binding.conversationId),DEFAULT_SENTENCE='No institutional source tool is enabled for this activity.';
const runtime=()=>({binding,versions,cwd,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024});
const skillOptions=name=>({mcpServers:{meri_original_reads:{type:'sdk',name:'meri_original_reads',instance:{close(){}}}},allowedTools:[`mcp__meri_original_reads__${name}`],canUseTool:async n=>n===`mcp__meri_original_reads__${name}`?{behavior:'allow',updatedInput:{}}:{behavior:'deny',message:'Tool unavailable'},hooks:{PreToolUse:[{matcher:'mcp__meri_original_reads__.*',hooks:[async()=>({})]}]}});
async function reads(){const f=await generalReadFixture();return {f,m:await mountReads(f)};}

test('without general reads the default prompt sentence and options are unchanged',()=>{
 const o=buildConversationOptions(runtime(),new AbortController());assert.ok(o.systemPrompt.includes(DEFAULT_SENTENCE));assert.equal(o.mcpServers,undefined);
 assert.equal(JSON.stringify(Object.keys(buildConversationOptions(runtime(),new AbortController(),undefined,undefined,undefined,undefined))),JSON.stringify(Object.keys(o)));
});

test('mounted reads add one server, exact pre-approved names, the correlation hook and a chained permission callback',async()=>{
 const {m}=await reads();
 try{const fragment=createSdkCapabilities({auditHooks:true,workspaceTools:true,workspaceToolNames:['Read']},{runOwner:{append:async()=>{}},binding,cwd,now:Date.now,newId:()=>id(1)}).options;
  const o=buildConversationOptions(runtime(),new AbortController(),undefined,undefined,fragment,m.runtime.sdkOptions);
  assert.deepEqual(Object.keys(o.mcpServers),['meri_reads']);assert.equal(o.systemPrompt.includes(DEFAULT_SENTENCE),false);assert.match(o.systemPrompt,/Only the read-only institutional source tools listed for this activity are enabled/u);
  for(const name of m.runtime.sdkOptions.allowedTools){assert.ok(o.allowedTools.includes(name));assert.equal((await o.canUseTool(name,{},{})).behavior,'allow');}
  assert.deepEqual(o.settings.permissions.allow,[`Read(/${cwd}/**)`],'workspace rules still merge');
  for(const name of ['Bash','mcp__meri_reads__send_email','mcp__meri_reads__query_global_data','mcp__meri_original_reads__mail_search_messages'])assert.equal((await o.canUseTool(name,{},{})).behavior,'deny',name);
  assert.deepEqual(o.hooks.PreToolUse.map(h=>h.matcher??null),['mcp__meri_reads__.*',null],'the correlation hook and the audit hook both run');
  assert.equal(o.permissionMode,'default');assert.deepEqual(o.tools,['Read']);
 }finally{await m.close();}
});

test('the skill and general servers may never expose the same operation; malformed read options are refused',async()=>{
 const {m}=await reads();
 try{assert.throws(()=>buildConversationOptions(runtime(),new AbortController(),undefined,skillOptions('mail_search_messages'),undefined,m.runtime.sdkOptions),/RUNTIME_CONFIGURATION/);
  const both=buildConversationOptions(runtime(),new AbortController(),undefined,skillOptions('query_tasks'),undefined,m.runtime.sdkOptions);
  assert.deepEqual(Object.keys(both.mcpServers).sort(),['meri_original_reads','meri_reads']);assert.equal((await both.canUseTool('mcp__meri_original_reads__query_tasks',{},{})).behavior,'allow');assert.equal((await both.canUseTool('mcp__meri_reads__mail_read_thread',{},{})).behavior,'allow');
  const s=m.runtime.sdkOptions;
  for(const bad of [{...s,extra:1},{...s,allowedTools:[]},{...s,allowedTools:['mcp__other__x']},{...s,allowedTools:['Read']},{...s,mcpServers:{meri_reads:{...s.mcpServers.meri_reads,name:'other'}}},{...s,mcpServers:{...s.mcpServers,other:s.mcpServers.meri_reads}},{...s,hooks:{PreToolUse:[{matcher:'.*',hooks:s.hooks.PreToolUse[0].hooks}]}},{...s,canUseTool:undefined}])
   assert.throws(()=>buildConversationOptions(runtime(),new AbortController(),undefined,undefined,undefined,bad),/RUNTIME_CONFIGURATION|INVALID_COMMAND/);
 }finally{await m.close();}
});

/** Activity with a scripted query and a synthetic general-read port answering for the saved run. */
async function activity({capabilities,installed=true,skill}={}){
 const f=await applicationFixture();await f.service.submit({credential:f.credential,input:f.input});let n=300,seen,asked=0;
 const runOwner={load:async a=>{const saved=await f.runOwner.load(a);return {...saved,...(capabilities?{capabilities}:{}),...(skill?{request:{...saved.request,skill}}:{})};},append:a=>f.runOwner.append(a)};
 const ops=catalog.operations.filter(d=>d.operation.id.startsWith('mail.')).map(d=>d.operation);
 const generalReads={async readAvailability(){asked++;const saved=await f.runOwner.load({binding});const at=Date.now();
   return {installation:{installationId:id(80),baseCatalogSha256:canonicalSha256(catalog),executionCatalogSha256:'e'.repeat(64),operations:installed?ops:[],checkedAtMs:at,expiresAtMs:at+60000},
    discovery:{binding,policyRevision:saved.run.scopes[0].policyRevision,operations:ops,checkedAtMs:at,expiresAtMs:at+60000}};},async execute(){throw Error('not called');}};
 const query=args=>{seen=args.options;return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false,result:'ok'};},close(){}};};
 const execute=createConversationActivity({runOwner,prepareRuntime:async()=>runtime(),query,newId:()=>id(n++),generalReads});
 return {f,run:()=>execute({binding}),options:()=>seen,asked:()=>asked};
}

test('the activity mounts meri_reads only when policy enables general reads and a read is available',async()=>{
 const on=await activity({capabilities:{generalReads:true}});
 try{assert.deepEqual(await on.run(),{state:'completed'});const o=on.options();assert.deepEqual(Object.keys(o.mcpServers),['meri_reads']);assert.equal(o.allowedTools.filter(t=>t.startsWith('mcp__meri_reads__')).length,3);assert.equal(o.systemPrompt.includes(DEFAULT_SENTENCE),false);}finally{on.f.close();}
 const none=await activity({capabilities:{generalReads:true},installed:false});
 try{await none.run();assert.equal(none.asked(),1);assert.equal(none.options().mcpServers,undefined);assert.ok(none.options().systemPrompt.includes(DEFAULT_SENTENCE),'no installation receipt: no server, default sentence stays true');}finally{none.f.close();}
 const off=await activity({capabilities:{auditHooks:true}});
 try{await off.run();assert.equal(off.asked(),0,'policy off: the port is never asked');assert.equal(off.options().mcpServers,undefined);}finally{off.f.close();}
 const absent=await activity();
 try{await absent.run();assert.equal(absent.asked(),0);assert.equal(absent.options().mcpServers,undefined);}finally{absent.f.close();}
});

test('the activity refuses a malformed general-read port before any run state changes',()=>{
 assert.throws(()=>createConversationActivity({runOwner:{load(){},append(){}},prepareRuntime(){},generalReads:{readAvailability(){}}}),/READ_ACTIVITY_CONFIGURATION/);
});
