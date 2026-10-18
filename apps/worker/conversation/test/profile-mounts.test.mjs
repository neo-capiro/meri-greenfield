/** G3: a measured profile registers only its fixed active read operations. Per-run availability may narrow execution but never add
 * another SDK tool, and a listed read that loses current authority answers UNAVAILABLE. Synthetic ports, real MCP servers. */
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
import {resolveCapabilityPolicy} from '../capabilities/policy-resolution.mjs';
import {familyReads,profileReads,resolveAvailableReads} from '../reads/availability.mjs';
import {createGeneralReadRuntime} from '../reads/runtime.mjs';
import {createIntentRuntime} from '../intents/runtime.mjs';
import {defineReadTool} from '../reads/tools.mjs';
import {z} from 'zod';
import {binding,scopes,id} from '../../../control/conversations/test/store-fixture.mjs';
const PROFILE=createConfiguredRunCapabilityPolicy({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}).profile;
const ACTIVE_ROWS=familyReads().filter(row=>z.object(defineReadTool(row,async()=>({}),false).shape).safeParse({arguments:{}}).success).slice(0,3);
const ACTIVE=ACTIVE_ROWS.map(row=>row.operation);
const PORTABLE={...PROFILE,skillPlugin:false,skillNames:null,workspaceTools:false,activeReadOperations:ACTIVE};
const quiet=()=>{const original=process.emitWarning;process.emitWarning=(warning,...rest)=>{if(String(warning).includes('canUseTool will not be invoked'))return;return original.call(process,warning,...rest);};return ()=>{process.emitWarning=original;};};
/** A trusted general-read port whose snapshot installs and grants exactly `operations` (synthetic availability facts). */
const readPort=(operations,{fail=false}={})=>({async readAvailability(){if(fail)throw Error('down');const at=Date.now();
 return {installation:{installationId:id(80),baseCatalogSha256:canonicalSha256(catalog),executionCatalogSha256:'e'.repeat(64),operations,checkedAtMs:at-1000,expiresAtMs:at+600000},
  discovery:{binding,policyRevision:scopes[0].policyRevision,operations,checkedAtMs:at-1000,expiresAtMs:at+600000}};},async execute(){throw Error('not called');}});
const intentPort=operations=>({async readAvailability(){const at=Date.now();return {binding,operations,checkedAtMs:at-1000,expiresAtMs:at+600000};},async prepare(){throw Error('not called');}});

test('profile mounts only exact active reads, with a stable list across changing run availability',async()=>{
 const restore=quiet();try{
  assert.equal(ACTIVE_ROWS.length,3,'fixture has three canonical reads accepting empty input');
  const policy=assertCapabilityPolicy(PORTABLE),rows=profileReads({policy}),some=rows.slice(0,2).map(r=>r.operation);
  const build=ports=>createProfileMounts({policy,binding,scopes,now:Date.now,deadlineMs:Date.now()+60000,...ports});
  const a=await build({generalReads:readPort(some),governedIntents:intentPort([{id:'create_word',version:'0.2.0'}])}),b=await build({generalReads:readPort([],{fail:true})}),c=await build({});
  try{
   assert.deepEqual(a.reads.available,some,'run A exposes two active reads');assert.deepEqual(b.reads.available,[]);assert.deepEqual(c.reads.available,[]);
   assert.deepEqual(a.intents.available,[{id:'create_word',version:'0.2.0'}]);assert.deepEqual(b.intents.available,[]);
   for(const x of [b,c]){assert.deepEqual(x.reads.sdkOptions.allowedTools,a.reads.sdkOptions.allowedTools);assert.deepEqual(x.intents.sdkOptions.allowedTools,a.intents.sdkOptions.allowedTools);
    assert.deepEqual(projectNativeSdkOptions({mcpServers:{...x.reads.sdkOptions.mcpServers,...x.intents.sdkOptions.mcpServers}}),projectNativeSdkOptions({mcpServers:{...a.reads.sdkOptions.mcpServers,...a.intents.sdkOptions.mcpServers}}));}
   assert.equal(a.reads.sdkOptions.allowedTools.length,ACTIVE.length,'only measured active reads are mounted');
   const listing=new Client({name:'g3-list',version:'1'}),[left,right]=InMemoryTransport.createLinkedPair();
   await a.reads.sdkOptions.mcpServers.meri_reads.instance.connect(left);await listing.connect(right);
   try{assert.deepEqual((await listing.listTools()).tools.map(t=>t.name).sort(),ACTIVE.map(op=>op.id.replaceAll('.','_')).sort());}finally{await listing.close();}
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
   for(const [runtime,index] of [[b.reads,0],[a.reads,2]]){const result=await call(runtime,'meri_reads',toolOf(index),{arguments:{}},`toolu_r_${index}`);assert.equal(result.isError,true);assert.match(result.content[0].text,/^UNAVAILABLE:/u);}
   const intent=await call(b.intents,'meri_intents','request_document',{operation:'create_word',arguments:{}},'toolu_i_1');assert.equal(intent.isError,true);assert.match(intent.content[0].text,/UNAVAILABLE/u);
   const notOffered=await call(a.intents,'meri_intents','request_document',{operation:'create_excel',arguments:{}},'toolu_i_2');assert.equal(notOffered.isError,true);assert.match(notOffered.content[0].text,/UNAVAILABLE/u);
  }finally{for(const x of [a,b,c]){await x.reads?.close();await x.intents?.close();}}
 }finally{restore();}
});


test('profile availability is capped by exact active operations; disabled or empty active profiles mount nothing',async()=>{
 const policy=assertCapabilityPolicy(PORTABLE),rows=profileReads({policy}),all=familyReads().map(r=>r.operation),keys=new Set(rows.map(r=>canonicalSha256(r.operation)));
 const open=resolveAvailableReads({policy,installation:{operations:all},discovery:{operations:all},scopes});
 assert.ok(open.available.length>rows.length,'the per-run gate alone can see more catalog reads than the fixed profile');
 const shared={binding,scopes,now:Date.now,deadlineMs:Date.now()+60000,mount:'profile'};
 const runtime=await createGeneralReadRuntime({...shared,policy,port:readPort(all)});
 try{assert.deepEqual(runtime.available,ACTIVE);assert.ok(runtime.available.every(op=>keys.has(canonicalSha256(op))));assert.equal(runtime.sdkOptions.allowedTools.length,ACTIVE.length);}finally{await runtime.close();}
 assert.equal(profileReads({policy:assertCapabilityPolicy({...PORTABLE,generalReads:false})}).length,0);
 assert.equal(await createGeneralReadRuntime({...shared,policy:assertCapabilityPolicy({...PORTABLE,activeReadOperations:[]}),port:readPort(all)}),null);
 assert.equal(await createGeneralReadRuntime({...shared,policy,port:UNAVAILABLE_READ_PORT,skill:{allowedOperations:[],budgets:{maxToolCalls:1,maxOutputBytes:65536}}}),null);
 assert.equal(await createGeneralReadRuntime({...shared,policy:assertCapabilityPolicy({governedIntents:true}),port:UNAVAILABLE_READ_PORT}),null);
 assert.equal(await createIntentRuntime({...shared,policy:assertCapabilityPolicy({generalReads:true}),port:UNAVAILABLE_INTENT_PORT}),null);
 await assert.rejects(createGeneralReadRuntime({...shared,mount:'other',policy,port:UNAVAILABLE_READ_PORT}),{code:'READ_CONFIGURATION'});
 await assert.rejects(createIntentRuntime({...shared,mount:'other',policy,port:UNAVAILABLE_INTENT_PORT}),{code:'INTENT_CONFIGURATION'});
});

test('G2 carries an exact, immutable active operation set and rejects unqualified or widened refs',async()=>{
 const [first,second]=ACTIVE,all=[...ACTIVE];
 const platform={maximum:{generalReads:true,activeReadOperations:all},defaults:{generalReads:true,activeReadOperations:[first,second]},
  roleCeilings:{standard_user:{generalReads:true,activeReadOperations:all},user_admin:{generalReads:true,activeReadOperations:[first]}}};
 const producer=createConfiguredRunCapabilityPolicy({capabilityPlatform:platform});
 assert.deepEqual(producer.profile.activeReadOperations,[first]);
 assert.deepEqual((await producer.forRun({tenantId:'tenant',actorId:'actor',conversationId:id(91)})).activeReadOperations,[first]);
 assert.ok(Object.isFrozen(producer.profile.activeReadOperations)&&Object.isFrozen(producer.profile.activeReadOperations[0]));
 for(const activeReadOperations of [null,[first,first],[{...first,extra:true}],[{...first,version:'9.9.9'}],[{id:'create_word',version:'0.2.0'}]])
  assert.throws(()=>assertCapabilityPolicy({generalReads:true,activeReadOperations}),/CAPABILITY_POLICY_REFUSED/u);
 const other=familyReads().find(row=>row.family!==ACTIVE_ROWS[0].family),family=ACTIVE_ROWS[0].family;
 assert.throws(()=>assertCapabilityPolicy({generalReads:true,readFamilies:[other.family],activeReadOperations:[first]}),/CAPABILITY_POLICY_REFUSED/u,
  'an active read outside the enabled family must not be silently omitted from the measured tool list');
 const narrowedPlatform={maximum:{generalReads:true,readFamilies:[family,other.family],activeReadOperations:[first,other.operation]},
  defaults:{generalReads:true,readFamilies:[family,other.family],activeReadOperations:[first,other.operation]},
  roleCeilings:{standard_user:{generalReads:true,readFamilies:[family,other.family],activeReadOperations:[first,other.operation]}}};
 const narrowed=resolveCapabilityPolicy({platform:narrowedPlatform,tenant:{capabilities:{readFamilies:[family]}},role:'standard_user'});
 assert.deepEqual(narrowed.activeReadOperations,[first],'a tenant family narrowing also narrows inherited active operations');
 const beyond=familyReads().find(row=>!all.some(op=>canonicalSha256(op)===canonicalSha256(row.operation))).operation;
 const widened={...platform,defaults:{generalReads:true,activeReadOperations:[...all,beyond]}};
 assert.throws(()=>createConfiguredRunCapabilityPolicy({capabilityPlatform:widened}),/CAPABILITY_PLATFORM_CONFIGURATION/u);
});
