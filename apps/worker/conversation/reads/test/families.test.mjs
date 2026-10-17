/** Synthetic schema/policy and in-memory MCP checks. No SDK query or model/provider traffic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments,canonicalInputSchema,isNarrowerOrEqual,convertCanonicalArguments} from '../schema.mjs';
import {createGeneralReadRuntime} from '../runtime.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
import {CASES,familyCase} from '../../../../gateway/general-reads/test/family-cases.mjs';
import {durableFamilyFixture} from '../../../../gateway/general-reads/test/durable-fixture.mjs';
const operations=familyReads().map(r=>r.operation),policy=assertCapabilityPolicy({generalReads:true});
test('all thirty-five constructible families remain unavailable without installation or discovery',()=>{
 assert.equal(READ_FAMILY_IDS.length,35);assert.equal(operations.length,58);
 for(const [installation,discovery] of [[[],operations],[operations,[]],[[],[]]])
  assert.deepEqual(resolveAvailableReads({policy,installation:{operations:installation},discovery:{operations:discovery},scopes:[{kind:'client'}]}).available,[]);
 const all=resolveAvailableReads({policy,installation:{operations},discovery:{operations},scopes:[{kind:'client'}]});
 assert.equal(all.available.length,58);assert.deepEqual(all.unavailable,[]);
 for(const id of ['get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project'])assert.ok(operations.some(o=>o.id===id));
});
test('per-operation client prefilter preserves personal meetings/tasks while withholding required-client reads',()=>{
 const result=resolveAvailableReads({policy,installation:{operations},discovery:{operations},scopes:[{kind:'private-user'}]}),ids=result.available.map(r=>r.operation.id);
 for(const id of ['meeting.list_upcoming_meetings','meeting.query_debriefs','query_tasks','search_memory'])assert.ok(ids.includes(id),id);
 for(const id of ['meeting.read_client_meetings','query_action_items','actions.query','get_client_context','read_client_documents','read_monday_client_boards',
  'get_representation','get_district_nexus_context','get_district_nexus_changes'])assert.ok(!ids.includes(id),id);
});
for(const row of familyReads())test(`synthetic ${row.operation.id}: advertised arguments retain canonical constraints`,()=>{
 const schema=advertisedArguments(row.descriptor.inputSchema);assert.equal(schema.mode,'canonical');
 assert.ok(isNarrowerOrEqual(z.toJSONSchema(schema.arguments,{io:'input'}),canonicalInputSchema(row.descriptor.inputSchema)));
 assert.equal(schema.arguments.safeParse({tenantId:'forged'}).success,false);
});
test('unconvertible/widened schemas fail configuration; union, required and array constraints are checked',()=>{
 assert.throws(()=>convertCanonicalArguments({type:'object',unevaluatedProperties:false}),/READ_SCHEMA_CONFIGURATION/);
 assert.throws(()=>convertCanonicalArguments({type:'array',items:{type:'string'},unevaluatedItems:false}),/READ_SCHEMA_CONFIGURATION/);
 assert.equal(isNarrowerOrEqual({type:'array',items:{type:'number'}},{type:'array',items:{type:'string'}}),false);
 assert.equal(isNarrowerOrEqual({type:'string'},{type:['string','null'],maxLength:2}),false);
 assert.equal(isNarrowerOrEqual({type:'string'},{type:['string','null'],maxLength:2,unevaluatedProperties:false}),false);
});
test('contacts canonical bytes and receipt hashes are preserved with a separate deferred-tool notice',async()=>{
 const f=await durableFamilyFixture(familyCase('tenant-contacts','find_contacts'));
 const runtime=await createGeneralReadRuntime({binding:f.binding,scopes:f.scopes,policy,port:f.mount(),now:f.now,deadlineMs:f.deadlineMs});
 const client=new Client({name:'synthetic',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 try{
  await runtime.sdkOptions.mcpServers.meri_reads.instance.connect(a);await client.connect(b);
  const hook=runtime.sdkOptions.hooks.PreToolUse[0].hooks[0],decision=await hook({hook_event_name:'PreToolUse',session_id:'71000000-0000-4000-8000-000000000091',
   tool_name:'mcp__meri_reads__find_contacts',tool_use_id:'contacts',tool_input:{arguments:f.arguments}},undefined,{});
  const result=await client.callTool({name:'find_contacts',arguments:decision.hookSpecificOutput.updatedInput});
  assert.equal(result.isError,undefined);assert.equal(result.content.length,2);
  const source=result.content[0].text;assert.match(source,/update_client_profile people\[\]/);
  assert.equal(result.content[1].text,'Notice: update_client_profile is not available in Meri. Do not propose or claim a client profile change. You may offer a governed task proposal instead.');
  assert.equal(runtime.receipts()[0].resultSha256,canonicalSha256(JSON.parse(source)));
  assert.deepEqual(JSON.parse(source).result.contacts[0].name,'Example correspondent');
  assert.deepEqual((await client.listTools()).tools.map(t=>t.name),['find_contacts']);
 }finally{await client.close();await runtime.close();}
});
test('contacts guidance counts toward the complete model-visible output limit',async()=>{
 const measurement=await durableFamilyFixture(familyCase('tenant-contacts','find_contacts'));
 const canonical=await measurement.execute('synthetic:measure-canonical');
 // Measuring must not spend or alter the tested run's durable allocation.
 const f=await durableFamilyFixture(familyCase('tenant-contacts','find_contacts'));
 const runtime=await createGeneralReadRuntime({binding:f.binding,scopes:f.scopes,policy,port:f.mount(),now:f.now,deadlineMs:f.deadlineMs,
  skill:{allowedOperations:[f.operation],budgets:{maxToolCalls:24,maxOutputBytes:Buffer.byteLength(canonical)}}});
 const client=new Client({name:'synthetic-output-bound',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 try{
  await runtime.sdkOptions.mcpServers.meri_reads.instance.connect(a);await client.connect(b);
  const decision=await runtime.sdkOptions.hooks.PreToolUse[0].hooks[0]({hook_event_name:'PreToolUse',session_id:'71000000-0000-4000-8000-000000000091',
   tool_name:'mcp__meri_reads__find_contacts',tool_use_id:'bounded-contacts',tool_input:{arguments:f.arguments}},undefined,{});
  const result=await client.callTool({name:'find_contacts',arguments:decision.hookSpecificOutput.updatedInput});
  assert.equal(result.isError,true);assert.match(result.content[0].text,/^RESOURCE_LIMIT:/);
  assert.equal(result.content.length,1);assert.deepEqual(runtime.receipts(),[]);
 }finally{await client.close();await runtime.close();}
});
