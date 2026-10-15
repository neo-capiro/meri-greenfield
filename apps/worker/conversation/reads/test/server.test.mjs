/** Synthetic: the actual `meri_reads` server → actual gateway general-read mount → actual current authority, durable
 * dispatch (scripted SQL) and mail HTTP adapter (fake Fetch). Real SDK → gateway → backend qualification is UNRUN. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {generalReadFixture,mountReads,MAIL_OPERATIONS,SESSION,NOW} from './fixture.mjs';
import {canonicalInputSchema,isNarrowerOrEqual} from '../schema.mjs';
const NAMES=['mail_list_messages','mail_search_messages','mail_read_thread'];
const text=r=>r.content[0].text;
const closed=(r,code)=>{assert.equal(r.isError,true);assert.equal(r.content.length,1);assert.match(text(r),new RegExp(`^${code}: mcp__meri_reads__mail_search_messages `,'u'));assert.match(text(r),/No evidence, absence or completeness is established\.$/u);assert.equal(text(r).includes('PRIVATE'),false);};

test('lists exactly the available mail reads, derived from descriptors, with schemas no wider than canonical',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f);
 try{const list=await m.client.listTools();
  assert.deepEqual(list.tools.map(t=>t.name).sort(),[...NAMES].sort(),'no tool was dropped and no legacy alias is a name');
  assert.deepEqual([...m.runtime.sdkOptions.allowedTools].sort(),NAMES.map(n=>`mcp__meri_reads__${n}`).sort());
  for(const t of list.tools){const op=MAIL_OPERATIONS.find(o=>o.id.replace('.','_')===t.name),d=resolveOperationContract(op).descriptor;
   assert.equal(t.annotations.readOnlyHint,true);assert.equal(t.annotations.destructiveHint,false);assert.ok(t.description.startsWith(`${d.displayName}. ${d.whenToUse}`));assert.ok(t.description.includes(d.inputSchema.sha256));
   assert.ok(t.description.includes('Supply literal arguments only; credentials and scope authority remain with the gateway.'));for(const alias of d.aliases)assert.equal(t.name.includes(alias),false);
   assert.deepEqual(t.inputSchema.required,['arguments']);
   assert.ok(isNarrowerOrEqual(t.inputSchema.properties.arguments,canonicalInputSchema(d.inputSchema)),`${t.name}: advertised arguments are equal to or narrower than ${d.inputSchema.id}`);}
 }finally{await m.close();}
});

test('an authorized read returns the canonical page unmodified and one receipt bound to the durable delivery',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f);
 try{const r=await m.call('mail_search_messages',f.search,{toolUseId:'toolu_receipt'});assert.equal(r.isError,undefined);assert.equal(r.content.length,1);
  const page=JSON.parse(text(r));assert.deepEqual(page.operation,MAIL_OPERATIONS[1]);assert.deepEqual(page.binding,f.binding);
  const [receipt,...rest]=m.runtime.receipts();assert.equal(rest.length,0);
  assert.equal(receipt.deliveryId,'sdk:'+canonicalSha256({binding:f.binding,sessionId:SESSION,toolUseId:'toolu_receipt'}));
  assert.equal(receipt.argumentsSha256,canonicalSha256(f.search));assert.equal(receipt.resultSha256,canonicalSha256(page));assert.equal(receipt.decisionId,f.subject.authorizationDecisionId);assert.equal(receipt.policyRevision,f.policy);
  assert.equal(receipt.executionCatalogSha256,(await f.mount().readAvailability()).installation.executionCatalogSha256);
  assert.equal(f.wire.length,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
 }finally{await m.close();}
});

test('availability gates: no installation receipt, policy off, or no eligible operation mounts no server',async()=>{
 const f=await generalReadFixture();let reads=0;const port=f.mount(),counting={readAvailability:v=>{reads++;return port.readAvailability(v);},execute:v=>port.execute(v)};
 assert.equal(await mountReads(f,{policy:{},port:counting}),null);assert.equal(reads,0,'policy off: the port is never asked');
 f.state.installRevoked=true;assert.equal(await mountReads(f),null,'no current native installation receipt: no server');
 f.state.installRevoked=false;f.state.installed=[];assert.equal(await mountReads(f),null);
 f.state.installed=[...MAIL_OPERATIONS];f.state.discovery=[];assert.equal(await mountReads(f),null,'actor eligible for nothing');
 assert.equal(f.wire.length,0);
});

test('an operation the actor is not granted is absent from the list',async()=>{
 const f=await generalReadFixture();f.state.discovery=[MAIL_OPERATIONS[0],MAIL_OPERATIONS[2]];const m=await mountReads(f);
 try{assert.deepEqual((await m.client.listTools()).tools.map(t=>t.name).sort(),['mail_list_messages','mail_read_thread']);
  assert.match((await m.call('mail_search_messages',f.search)).denied,/correlation unavailable/u,'an unlisted read is denied at the hook');
  const forced=await m.client.callTool({name:'mail_search_messages',arguments:{arguments:f.search}});assert.equal(forced.isError,true);assert.equal(f.wire.length,0);
 }finally{await m.close();}
});

test('called anyway after revocation: explicit UNAVAILABLE or ACCESS_DENIED, never an empty success',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f);
 try{f.state.installRevoked=true;closed(await m.call('mail_search_messages',f.search),'UNAVAILABLE');
  f.state.installRevoked=false;f.state.discovery=[MAIL_OPERATIONS[0]];closed(await m.call('mail_search_messages',f.search),'UNAVAILABLE');
  f.state.discovery=[...MAIL_OPERATIONS];f.state.revoked=true;closed(await m.call('mail_search_messages',f.search),'ACCESS_DENIED');
  f.state.revoked=false;closed(await m.call('mail_search_messages',{...f.search,subject:{kind:'client',entityId:'71000000-0000-4000-8000-000000000999'}}),'ACCESS_DENIED');
  assert.equal(f.wire.length,0);assert.deepEqual(m.runtime.receipts(),[]);
 }finally{await m.close();}
});

test('argument-borne authority and forged correlation never reach the gateway',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f),calls=[];
 try{const extra=await m.call('mail_search_messages',{...f.search,tenantId:'other-tenant'});assert.equal(extra.isError,true,'the advertised canonical schema refuses unknown keys');
  const noHook=await m.client.callTool({name:'mail_search_messages',arguments:{arguments:f.search}});closed(noHook,'ACCESS_DENIED');
  const forged=await m.client.callTool({name:'mail_search_messages',arguments:{arguments:f.search,_meriInvocation:'71000000-0000-4000-8000-000000000999'}});closed(forged,'ACCESS_DENIED');
  const decision=await m.hook({hook_event_name:'PreToolUse',session_id:SESSION,tool_name:'mcp__meri_reads__mail_search_messages',tool_use_id:'toolu_swap',tool_input:{arguments:f.search,_meriInvocation:'model-chosen'}},undefined,{});
  assert.notEqual(decision.hookSpecificOutput.updatedInput._meriInvocation,'model-chosen','a model-supplied token is replaced');
  closed(await m.client.callTool({name:'mail_search_messages',arguments:{...decision.hookSpecificOutput.updatedInput,arguments:{...f.search,limit:2}}}),'ACCESS_DENIED');
  assert.equal(f.wire.length,0);
  const port=f.mount(),spy=await mountReads(f,{port:{readAvailability:v=>port.readAvailability(v),async execute(v){calls.push(v);return port.execute(v);}}});
  try{const nested=await spy.call('mail_search_messages',{...f.search,query:'binding'});assert.equal(nested.isError,undefined,'authority words inside literal values are data');assert.equal(calls.length,1);assert.deepEqual(Object.keys(calls[0]).sort(),['arguments','deliveryId','operation','signal']);}finally{await spy.close();}
 }finally{await m.close();}
});

test('the per-run call ceiling refuses at the hook before any further gateway effect',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f,{skill:{allowedOperations:[...MAIL_OPERATIONS],budgets:{maxToolCalls:2,maxOutputBytes:1048576}}});
 try{for(const n of [1,2])assert.equal((await m.call('mail_search_messages',{...f.search,limit:n})).isError,undefined);
  const third=await m.call('mail_search_messages',{...f.search,limit:3});assert.match(third.denied,/^RESOURCE_LIMIT: /u);assert.equal(f.wire.length,2);assert.equal(m.runtime.receipts().length,2);
 }finally{await m.close();}
});

const parked=f=>{const seen={aborts:[],reached:null};f.state.parkFetch=signal=>{seen.reached?.();return new Promise((_,reject)=>signal.addEventListener('abort',()=>{seen.aborts.push(signal.reason);reject(signal.reason);},{once:true}));};return seen;};
test('the per-call deadline ends the call with no receipt and leaves the durable outcome UNKNOWN, which blocks further dispatch',async()=>{
 const f=await generalReadFixture(),seen=parked(f),m=await mountReads(f,{deadlineMs:NOW+80});
 try{closed(await m.call('mail_search_messages',f.search),'DEADLINE');assert.equal(seen.aborts.length,1,'the source request was aborted');
  assert.deepEqual(m.runtime.receipts(),[]);assert.deepEqual([...f.state.reservations.values()].map(r=>r.state),['UNKNOWN'],'UNKNOWN is retained, never settled');
  f.state.parkFetch=null;closed(await m.call('mail_search_messages',{...f.search,limit:2}),'BUDGET_UNCERTAIN');assert.equal(f.wire.length,1,'UNKNOWN never licenses another dispatch');
 }finally{await m.close();}
});

test('SDK cancellation reaches the source request and records nothing',async()=>{
 const f=await generalReadFixture(),seen=parked(f),m=await mountReads(f),controller=new AbortController();
 try{const atSource=new Promise(resolve=>{seen.reached=resolve;}),pending=m.call('mail_search_messages',f.search,{signal:controller.signal});
  await atSource;controller.abort();await assert.rejects(pending,/AbortError/u);
  for(let n=0;n<100&&!seen.aborts.length;n++)await new Promise(r=>setTimeout(r,10));
  assert.equal(seen.aborts.length,1);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);assert.equal(f.state.budget.consumed_micro_usd,0);
 }finally{await m.close();}
});

test('a duplicate delivery yields one receipt and one source call, including after a restart',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f);
 try{assert.equal((await m.call('mail_search_messages',f.search,{toolUseId:'toolu_dup'})).isError,undefined);
  assert.match((await m.call('mail_search_messages',f.search,{toolUseId:'toolu_dup'})).denied,/correlation unavailable/u);
  assert.equal(m.runtime.receipts().length,1);
 }finally{await m.close();}
 const restarted=await mountReads(f);
 try{const replay=await restarted.call('mail_search_messages',f.search,{toolUseId:'toolu_dup'});assert.equal(replay.isError,true);assert.match(text(replay),/^BUDGET_UNCERTAIN: .*do not repeat this call\./u);
  assert.deepEqual(restarted.runtime.receipts(),[]);assert.equal(f.wire.length,1);assert.equal(f.state.budget.consumed_micro_usd,1);
 }finally{await restarted.close();}
});

test('the session is pinned on continuation and a closed server correlates nothing',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f,{expectedSessionId:'71000000-0000-4000-8000-000000000092'});
 try{assert.match((await m.call('mail_search_messages',f.search)).denied,/correlation unavailable/u);
  assert.equal((await m.call('mail_search_messages',f.search,{sessionId:'71000000-0000-4000-8000-000000000092'})).isError,undefined);
 }finally{await m.close();}
 assert.match((await m.call('mail_search_messages',f.search,{sessionId:'71000000-0000-4000-8000-000000000092'}).catch(()=>({denied:'closed'}))).denied,/closed|correlation unavailable/u);
 assert.equal(f.wire.length,1);
});

test('a selected skill narrows the list; operations another server exposes are excluded',async()=>{
 const f=await generalReadFixture();
 const narrowed=await mountReads(f,{skill:{allowedOperations:[MAIL_OPERATIONS[1]],budgets:{maxToolCalls:24,maxOutputBytes:1048576}}});
 try{assert.deepEqual((await narrowed.client.listTools()).tools.map(t=>t.name),['mail_search_messages']);}finally{await narrowed.close();}
 assert.equal(await mountReads(f,{exclude:[...MAIL_OPERATIONS]}),null,'nothing left once the skill server exposes every operation');
});
