/** Memory recall as the model experiences it: the real MCP server, worker HTTP, control composer and gateway signed
 * adapter over scripted Core pages and eligibility receipts. Recall is grounded and attributed, an empty page is not
 * absence, denied scope and ineligible items are refusals, and nothing here ever claims a memory was saved. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mountReads} from './fixture.mjs';
import {memoryReadFixture} from './memory-fixture.mjs';
import {canonicalInputSchema,isNarrowerOrEqual} from '../schema.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
const text=r=>r.content[0].text;
const corePaths=f=>f.calls.filter(p=>p.startsWith('/api/clio/tools/'));

test('search_memory is listed with its recall guidance and an argument schema no wider than canonical',async()=>{
 const f=await memoryReadFixture(),m=await mountReads(f);
 try{const {tools}=await m.client.listTools();assert.deepEqual(tools.map(t=>t.name),['search_memory']);
  const [t]=tools,d=resolveOperationContract({id:'search_memory',version:'0.2.0'}).descriptor;
  assert.ok(t.description.startsWith(`${d.displayName}. ${d.whenToUse}`));
  assert.match(t.description,/Recall of approved governed memory: what the user, the firm or Meri previously saved and a reviewer approved/);
  assert.match(t.description,/never say a memory was saved or remembered/);
  assert.doesNotMatch(t.description,/adapter assertion|Local validation does not qualify|Pending private contract/);
  assert.ok(isNarrowerOrEqual(t.inputSchema.properties.arguments,canonicalInputSchema(d.inputSchema)));
 }finally{await m.close();}
});

test('General: personal recall returns the canonical page, one attribution notice and one receipt after the eligibility receipt',async()=>{
 const f=await memoryReadFixture(),m=await mountReads(f);
 try{const r=await m.call('search_memory',{query:'approved allocation'},{toolUseId:'toolu_memory'});
  assert.equal(r.isError,undefined,JSON.stringify(r));assert.equal(r.content.length,2);
  const envelope=JSON.parse(text(r));assert.deepEqual(envelope.result,f.scene.page(f.scene.input({query:'approved allocation'})));
  assert.equal(envelope.result.records[0].payload.scope,'firm');assert.equal(envelope.result.records[0].payload.governance.status,'active');
  assert.match(r.content[1].text,/^Notice: 1 approved memory item\(s\) returned \(at most 3 per page\); contentStatus available\. Attribute each item as saved memory by its title, scope and approvedAt from records\[\]\.payload; it records what was approved, not a fact verified now, and nothing here saves or changes memory\./);
  assert.match(r.content[1].text,/Content is partial: read an item's complete text with memoryItemId and the contentCursor from content\.nextRead/);
  assert.deepEqual(corePaths(f),['/api/clio/tools/search_memory','/api/clio/tools/search_memory_eligibility']);
  const [receipt,...rest]=m.runtime.receipts();assert.equal(rest.length,0);assert.equal(receipt.operation.id,'search_memory');
 }finally{await m.close();}
});

test('selected client: recall takes that client\'s UUID, and omitting it is a denied scope that never reaches Core',async()=>{
 const f=await memoryReadFixture({client:true}),m=await mountReads(f);
 try{const ok=await m.call('search_memory',{query:'approved allocation',clientId:f.clientId});
  assert.equal(ok.isError,undefined,JSON.stringify(ok));assert.equal(JSON.parse(text(ok)).result.results.length,1);
  assert.equal(corePaths(f).length,2);
  const denied=await m.call('search_memory',{query:'approved allocation'});
  assert.equal(denied.isError,true);assert.match(text(denied),/^ACCESS_DENIED: mcp__meri_reads__search_memory is not permitted/);
  assert.match(text(denied),/in a selected-client conversation clientId must be that client's UUID, in General it must be null/);
  assert.equal(corePaths(f).length,2,'the denied call made no Core request');assert.equal(m.runtime.receipts().length,1);
 }finally{await m.close();}
});

test('an item Core no longer deems eligible fails the whole call as ACCESS_DENIED with no receipt',async()=>{
 const f=await memoryReadFixture(),m=await mountReads(f);f.eligible(false);
 try{const r=await m.call('search_memory',{query:'approved allocation'});
  assert.equal(r.isError,true);assert.match(text(r),/^ACCESS_DENIED: /);assert.match(text(r),/every returned item must pass Core's current eligibility check/);
  assert.deepEqual(corePaths(f),['/api/clio/tools/search_memory','/api/clio/tools/search_memory_eligibility']);assert.deepEqual(m.runtime.receipts(),[]);
 }finally{await m.close();}
});

test('an empty recall page says no approved memory matched and that this is not proof nothing was saved',async()=>{
 const f=await memoryReadFixture(),m=await mountReads(f);
 const empty=f.scene.page(f.scene.input({query:'nothing like this'}));
 f.page({...empty,results:[],records:[],contentStatus:'empty',contentTruncated:false,summary:'No eligible memory was returned. Coverage distinguishes an empty result from unavailable recall.',
  coverage:{...empty.coverage,recordsEvaluated:0,recordsReturned:0,sources:[{...empty.coverage.sources[0],returned:0,recordsEvaluated:0}]}});
 try{const r=await m.call('search_memory',{query:'nothing like this'});
  assert.equal(r.isError,undefined,JSON.stringify(r));
  assert.match(r.content[1].text,/^Notice: 0 approved memory item\(s\) returned \(at most 3 per page\); contentStatus empty\. Pending proposals and retired items are never recall, so this is not proof that nothing was saved or proposed: say that no approved memory matched\.$/);
  assert.equal(corePaths(f).length,2,'an empty page still carries an eligibility receipt');
 }finally{await m.close();}
});

test('Core\'s argument error page tells the model to supply query text',async()=>{
 const f=await memoryReadFixture(),m=await mountReads(f);f.page({error:'Provide a search query.'});
 try{const r=await m.call('search_memory',{query:null});
  assert.equal(r.isError,undefined,JSON.stringify(r));
  assert.equal(r.content[1].text,'Notice: search_memory refused the arguments: Provide a search query. Pass the topic or client as query text; clientId only in a selected-client conversation.');
 }finally{await m.close();}
});

test('disabled recall is UNAVAILABLE with the memory hint, never an empty success',async()=>{
 const f=await memoryReadFixture(),m=await mountReads(f);f.enabled(false);
 try{const r=await m.call('search_memory',{query:'approved allocation'});
  assert.equal(r.isError,true);assert.match(text(r),/^UNAVAILABLE: mcp__meri_reads__search_memory /);
  assert.match(text(r),/Governed memory recall is not served in this conversation .* say nothing about what is or is not saved\. No evidence, absence or completeness is established\.$/);
  assert.deepEqual(corePaths(f),[]);
 }finally{await m.close();}
});
