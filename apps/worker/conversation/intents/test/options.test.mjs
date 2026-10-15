/** Options composition for `meri_intents` and the activity mount decision. Scripted SDK query, synthetic ports, no provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {buildConversationOptions} from '../../options.mjs';
import {createConversationActivity} from '../../activity.mjs';
import {applicationFixture,binding,versions,id} from '../../../../control/conversations/test/application-fixture.mjs';
import {preparedWorkspace} from '../../test/capability-fixture.mjs';
import {generalReadFixture,mountReads} from '../../reads/test/fixture.mjs';
import {intentFixture,mountIntents} from './fixture.mjs';
import {DEFERRED_ORIGINALS} from '../../reads/availability.mjs';
const cwd=preparedWorkspace(binding.conversationId),SENTENCE=/Write requests may only be prepared with the listed write-request tools/u;
const runtime=()=>({binding,versions,cwd,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024});

test('without intents the options and prompt are unchanged',()=>{
 const o=buildConversationOptions(runtime(),new AbortController());assert.doesNotMatch(o.systemPrompt,SENTENCE);
 const same=buildConversationOptions(runtime(),new AbortController(),undefined,undefined,undefined,undefined,undefined);
 assert.deepEqual(Object.keys(same),Object.keys(o));assert.equal(same.systemPrompt,o.systemPrompt);assert.equal(same.mcpServers,undefined);assert.deepEqual(same.allowedTools,[]);
});

test('mounted intents merge beside general reads: one server each, exact names, both hooks, chained permissions',async()=>{
 const rf=await generalReadFixture(),reads=await mountReads(rf),f=intentFixture(),intents=await mountIntents(f);
 try{const o=buildConversationOptions(runtime(),new AbortController(),undefined,undefined,undefined,reads.runtime.sdkOptions,intents.runtime.sdkOptions);
  assert.deepEqual(Object.keys(o.mcpServers),['meri_reads','meri_intents']);assert.match(o.systemPrompt,SENTENCE);
  assert.deepEqual(o.hooks.PreToolUse.map(h=>h.matcher),['mcp__meri_reads__.*','mcp__meri_intents__.*']);
  for(const name of [...reads.runtime.sdkOptions.allowedTools,'mcp__meri_intents__propose_task'])assert.equal((await o.canUseTool(name,{},{})).behavior,'allow',name);
  for(const name of ['mcp__meri_intents__propose_memory',...DEFERRED_ORIGINALS.map(n=>`mcp__meri_intents__${n}`),'mcp__meri_reads__propose_task','Bash'])assert.equal((await o.canUseTool(name,{},{})).behavior,'deny',name);
  const s=intents.runtime.sdkOptions;
  for(const bad of [{...s,extra:1},{...s,allowedTools:[]},{...s,allowedTools:[`mcp__meri_intents__${DEFERRED_ORIGINALS[0]}`]},{...s,allowedTools:['mcp__meri_reads__mail_read_thread']},{...s,mcpServers:{meri_intents:{...s.mcpServers.meri_intents,name:'other'}}},{...s,hooks:{PreToolUse:[{matcher:'.*',hooks:s.hooks.PreToolUse[0].hooks}]}},{...s,canUseTool:undefined}])
   assert.throws(()=>buildConversationOptions(runtime(),new AbortController(),undefined,undefined,undefined,undefined,bad),/RUNTIME_CONFIGURATION|INVALID_COMMAND/);
 }finally{await reads.close();await intents.close();}
});

/** Activity with a scripted query and a synthetic intent port answering for the saved run. */
async function activity({capabilities,offered=true}={}){
 const f=await applicationFixture();await f.service.submit({credential:f.credential,input:f.input});let n=300,seen,asked=0;
 const runOwner={load:async a=>{const saved=await f.runOwner.load(a);return {...saved,...(capabilities?{capabilities}:{})};},append:a=>f.runOwner.append(a)};
 const governedIntents={async readAvailability(){asked++;const at=Date.now();return {binding,operations:offered?[{id:'create_task',version:'0.2.0'}]:[],checkedAtMs:at,expiresAtMs:at+60000};},async prepare(){throw Error('not called');}};
 const query=args=>{seen=args.options;return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false,result:'ok'};},close(){}};};
 const execute=createConversationActivity({runOwner,prepareRuntime:async()=>runtime(),query,newId:()=>id(n++),governedIntents});
 return {f,run:()=>execute({binding}),options:()=>seen,asked:()=>asked};
}
test('the activity mounts meri_intents only when policy enables governed intents and an owner can prepare one',async()=>{
 const on=await activity({capabilities:{governedIntents:true}});
 try{assert.deepEqual(await on.run(),{state:'completed'});const o=on.options();assert.deepEqual(Object.keys(o.mcpServers),['meri_intents']);assert.deepEqual(o.allowedTools,['mcp__meri_intents__propose_task']);assert.match(o.systemPrompt,SENTENCE);}finally{on.f.close();}
 const none=await activity({capabilities:{governedIntents:true},offered:false});
 try{await none.run();assert.equal(none.asked(),1);assert.equal(none.options().mcpServers,undefined);assert.doesNotMatch(none.options().systemPrompt,SENTENCE);}finally{none.f.close();}
 const off=await activity({capabilities:{generalReads:false}});
 try{await off.run();assert.equal(off.asked(),0,'policy off: the port is never asked');assert.equal(off.options().mcpServers,undefined);}finally{off.f.close();}
 assert.throws(()=>createConversationActivity({runOwner:{load(){},append(){}},prepareRuntime(){},governedIntents:{readAvailability(){}}}),/INTENT_ACTIVITY_CONFIGURATION/);
});
