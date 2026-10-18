/** G3: the profile MCP mounts (capabilities/mounts.mjs) are availability-invariant. Whatever a run's availability (every, some or no read
 * and intent offered; a failing or absent port) the same servers carry the same tool lists, and a mounted tool this run does not expose
 * answers a typed UNAVAILABLE through the server's own hook and handler without reaching the port. Synthetic ports, real MCP servers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {projectNativeSdkOptions} from '../../../runtime/native-authority/sdk-option-projection.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM,createConfiguredRunCapabilityPolicy} from '../../../runtime/product-ports/capability-policy.mjs';
import {createProfileMounts,UNAVAILABLE_READ_PORT,UNAVAILABLE_INTENT_PORT} from '../capabilities/mounts.mjs';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {profileReads,resolveAvailableReads} from '../reads/availability.mjs';
import {createGeneralReadRuntime} from '../reads/runtime.mjs';
import {createIntentRuntime} from '../intents/runtime.mjs';
import {defineReadTool} from '../reads/tools.mjs';
import {z} from 'zod';
import {binding,scopes,id} from '../../../control/conversations/test/store-fixture.mjs';
const PROFILE=createConfiguredRunCapabilityPolicy({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}).profile;
const PORTABLE={...PROFILE,skillPlugin:false,skillNames:null,workspaceTools:false};
const quiet=()=>{const original=process.emitWarning;process.emitWarning=(warning,...rest)=>{if(String(warning).includes('canUseTool will not be invoked'))return;return original.call(process,warning,...rest);};return ()=>{process.emitWarning=original;};};
/** A trusted general-read port whose snapshot installs and grants exactly `operations` (synthetic availability facts). */
const readPort=(operations,{fail=false}={})=>({async readAvailability(){if(fail)throw Error('down');const at=Date.now();
 return {installation:{installationId:id(80),baseCatalogSha256:canonicalSha256(catalog),executionCatalogSha256:'e'.repeat(64),operations,checkedAtMs:at-1000,expiresAtMs:at+600000},
  discovery:{binding,policyRevision:scopes[0].policyRevision,operations,checkedAtMs:at-1000,expiresAtMs:at+600000}};},async execute(){throw Error('not called');}});
const intentPort=operations=>({async readAvailability(){const at=Date.now();return {binding,operations,checkedAtMs:at-1000,expiresAtMs:at+600000};},async prepare(){throw Error('not called');}});

test('profile mounts are availability-invariant: the same tools whether every read/intent, some or none is available',async()=>{
 const restore=quiet();try{
  const policy=assertCapabilityPolicy(PORTABLE),rows=profileReads({policy}),some=rows.slice(0,3).map(r=>r.operation);
  const build=ports=>createProfileMounts({policy,binding,scopes,now:Date.now,deadlineMs:Date.now()+60000,...ports});
  const a=await build({generalReads:readPort(some),governedIntents:intentPort([{id:'create_word',version:'0.2.0'}])}),b=await build({generalReads:readPort([],{fail:true})}),c=await build({});
  try{
   assert.deepEqual(a.reads.available,some,'run A exposes three reads');assert.deepEqual(b.reads.available,[]);assert.deepEqual(c.reads.available,[]);
   assert.deepEqual(a.intents.available,[{id:'create_word',version:'0.2.0'}]);assert.deepEqual(b.intents.available,[]);
   for(const x of [b,c]){assert.deepEqual(x.reads.sdkOptions.allowedTools,a.reads.sdkOptions.allowedTools);assert.deepEqual(x.intents.sdkOptions.allowedTools,a.intents.sdkOptions.allowedTools);
    assert.deepEqual(projectNativeSdkOptions({mcpServers:{...x.reads.sdkOptions.mcpServers,...x.intents.sdkOptions.mcpServers}}),projectNativeSdkOptions({mcpServers:{...a.reads.sdkOptions.mcpServers,...a.intents.sdkOptions.mcpServers}}));}
   assert.equal(a.reads.sdkOptions.allowedTools.length,rows.length,'every profile read is mounted');assert.ok(rows.length>24);
   assert.deepEqual(a.intents.sdkOptions.allowedTools,['mcp__meri_intents__request_document','mcp__meri_intents__propose_schedule','mcp__meri_intents__propose_schedule_change','mcp__meri_intents__propose_task','mcp__meri_intents__propose_task_update']);
   // A mounted tool this run does not expose answers a typed UNAVAILABLE through the server's own hook and handler (real MCP client);
   // the port is never asked to execute or prepare (both synthetic ports throw if they are).
   const session='71000000-0000-4000-8000-000000000091',signal=new AbortController().signal;
   const call=async(runtime,server,name,input,toolUseId)=>{const client=new Client({name:'g3',version:'1'}),[x,y]=InMemoryTransport.createLinkedPair();
    await runtime.sdkOptions.mcpServers[server].instance.connect(x);await client.connect(y);
    try{const decision=await runtime.sdkOptions.hooks.PreToolUse[0].hooks[0]({hook_event_name:'PreToolUse',session_id:session,tool_name:`mcp__${server}__${name}`,tool_use_id:toolUseId,tool_input:input},undefined,{signal});
     assert.equal(decision.hookSpecificOutput.permissionDecision,undefined,'correlated, not denied');return await client.callTool({name,arguments:decision.hookSpecificOutput.updatedInput});}
    finally{await client.close();}};
   const toolOf=index=>a.reads.sdkOptions.allowedTools[index].slice('mcp__meri_reads__'.length);
   // Reads whose advertised arguments accept {} (schema validation precedes the handler); one exposed only in run A, one in neither.
   const empty=rows.flatMap((row,index)=>z.object(defineReadTool(row,async()=>({}),false).shape).safeParse({arguments:{}}).success?[index]:[]);
   assert.ok(empty.some(i=>i>=3),'a read accepting empty arguments outside the exposure of run A');
   for(const [runtime,index] of [[b.reads,empty[0]],[a.reads,empty.find(i=>i>=3)]]){const result=await call(runtime,'meri_reads',toolOf(index),{arguments:{}},`toolu_r_${index}`);assert.equal(result.isError,true);assert.match(result.content[0].text,/^UNAVAILABLE:/u);}
   const intent=await call(b.intents,'meri_intents','request_document',{operation:'create_word',arguments:{}},'toolu_i_1');assert.equal(intent.isError,true);assert.match(intent.content[0].text,/UNAVAILABLE/u);
   const notOffered=await call(a.intents,'meri_intents','request_document',{operation:'create_excel',arguments:{}},'toolu_i_2');assert.equal(notOffered.isError,true);assert.match(notOffered.content[0].text,/UNAVAILABLE/u);
  }finally{for(const x of [a,b,c]){await x.reads?.close();await x.intents?.close();}}
 }finally{restore();}
});


test('every read the gates can expose is among the profile reads; a disabled profile or an empty narrowing mounts nothing',async()=>{
 const policy=assertCapabilityPolicy(PORTABLE),rows=profileReads({policy}),all=rows.map(r=>r.operation),keys=new Set(rows.map(r=>canonicalSha256(r.operation)));
 const open=resolveAvailableReads({policy,installation:{operations:all},discovery:{operations:all},scopes});
 assert.equal(open.available.length,rows.length);assert.ok(open.available.every(r=>keys.has(canonicalSha256(r.operation))));
 assert.equal(profileReads({policy:assertCapabilityPolicy({...PORTABLE,generalReads:false})}).length,0);
 const shared={binding,scopes,now:Date.now,deadlineMs:Date.now()+60000,mount:'profile'};
 assert.equal(await createGeneralReadRuntime({...shared,policy,port:UNAVAILABLE_READ_PORT,skill:{allowedOperations:[],budgets:{maxToolCalls:1,maxOutputBytes:65536}}}),null);
 assert.equal(await createGeneralReadRuntime({...shared,policy:assertCapabilityPolicy({governedIntents:true}),port:UNAVAILABLE_READ_PORT}),null);
 assert.equal(await createIntentRuntime({...shared,policy:assertCapabilityPolicy({generalReads:true}),port:UNAVAILABLE_INTENT_PORT}),null);
 await assert.rejects(createGeneralReadRuntime({...shared,mount:'other',policy,port:UNAVAILABLE_READ_PORT}),{code:'READ_CONFIGURATION'});
 await assert.rejects(createIntentRuntime({...shared,mount:'other',policy,port:UNAVAILABLE_INTENT_PORT}),{code:'INTENT_CONFIGURATION'});
});
