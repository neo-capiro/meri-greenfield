/** Native installation/discovery gates through the real runtime/MCP server, over synthetic producers and scripted SQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {retainedCase} from '../../../../gateway/general-reads/test/retained-cases.mjs';
import {durableFamilyFixture} from '../../../../gateway/general-reads/test/durable-fixture.mjs';
import {createGeneralReadRuntime} from '../runtime.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
const IDS=['get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project'];
const policy=assertCapabilityPolicy({generalReads:true});
const runtimeFor=(f,changes={})=>createGeneralReadRuntime({binding:f.binding,scopes:f.scopes,policy,port:f.mount(),now:f.now,deadlineMs:f.deadlineMs,...changes});
async function connected(f){const runtime=await runtimeFor(f),client=new Client({name:'synthetic-admission',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 await runtime.sdkOptions.mcpServers.meri_reads.instance.connect(a);await client.connect(b);
 return {runtime,client,async call(){const decision=await runtime.sdkOptions.hooks.PreToolUse[0].hooks[0]({hook_event_name:'PreToolUse',
  session_id:'71000000-0000-4000-8000-000000000091',tool_name:`mcp__meri_reads__${f.operation.id}`,tool_use_id:'admission',tool_input:{arguments:f.arguments}},undefined,{});
  return client.callTool({name:f.operation.id,arguments:decision.hookSpecificOutput.updatedInput});},
  async close(){await client.close();await runtime.close();}};
}
for(const id of IDS){
 test(`synthetic ${id}: missing installation/discovery and disabled source create no server`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id));f.state.installRevoked=true;assert.equal(await runtimeFor(f),null);
  f.state.installRevoked=false;f.state.discoveryMutator=r=>{r.operations=[];};assert.equal(await runtimeFor(f),null);
  assert.equal(await runtimeFor(f,{port:f.mount({sourceEnabled:false})}),null);assert.equal(f.wire.length,0);assert.equal(f.state.produced.size,0);
 });
 test(`synthetic ${id}: foreign/stale discovery never creates a server`,async()=>{
  for(const mutate of [r=>{r.binding={...r.binding,writerFence:2};},r=>{r.policyRevision='other';},r=>{r.expiresAtMs=0;},
   r=>{r.checkedAtMs=Number.MAX_SAFE_INTEGER;},r=>{r.operations.push({...r.operations[0]});}]){
   const f=await durableFamilyFixture(retainedCase(id));f.state.discoveryMutator=mutate;
   assert.equal(await runtimeFor(f),null);assert.equal(f.wire.length,0);assert.equal(f.state.produced.size,0);}
 });
 test(`synthetic ${id}: discovery revocation after listing refuses before gateway invocation`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id)),m=await connected(f);
  try{assert.deepEqual((await m.client.listTools()).tools.map(t=>t.name),[id]);
   f.state.discoveryMutator=r=>{r.operations=[];};const result=await m.call();
   assert.equal(result.isError,true);assert.match(result.content[0].text,/^UNAVAILABLE:/);assert.deepEqual(m.runtime.receipts(),[]);
   assert.equal(f.wire.length,0);assert.equal(f.state.produced.size,0);
  }finally{await m.close();}
 });
 test(`synthetic ${id}: a narrower selected allocation and captured installation digest are preserved`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id));
  assert.equal(await runtimeFor(f,{skill:{allowedOperations:[],budgets:{maxToolCalls:1,maxOutputBytes:65536}}}),null);
  const current=await f.mount().readAvailability(),m=await connected(f);
  try{const result=await m.call();assert.equal(result.isError,undefined);
   const receipt=m.runtime.receipts()[0];assert.equal(receipt.executionCatalogSha256,current.installation.executionCatalogSha256);
   assert.deepEqual(receipt.operation,f.operation);assert.equal(f.wire.length,1);assert.equal(f.state.produced.size,1);
  }finally{await m.close();}
 });
}
