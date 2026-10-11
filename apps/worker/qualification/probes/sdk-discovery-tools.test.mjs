import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createDiscoveryServer } from './sdk-discovery-tools.mjs';
import { DISCOVERY_FIXTURE } from './sdk-discovery-options.mjs';

const context = () => ({ contractVersion: '0.1.0',
  sessionId: '55555555-5555-4555-8555-555555555555', runBinding: {
    tenantId: 'synthetic-tenant', actorId: 'synthetic-actor',
    conversationId: '11111111-1111-4111-8111-111111111111',
    runId: '22222222-2222-4222-8222-222222222222',
    attemptId: '33333333-3333-4333-8333-333333333333',
    workerId: '44444444-4444-4444-8444-444444444444', writerFence: 7,
  } });
const args = [{ messageId: 'fixture-message-7' }, { subject: 'orchard meeting' }];
const success = { content: [{ type: 'text', text: 'synthetic result' }] };

function fixture(gateway = { authorize: async () => true, execute: async () => success }, ctx = context()) {
  const calls = [];
  let configuration;
  const server = { type: 'sdk', name: 'wire', instance: {} };
  const input = { z, gateway, context: ctx,
    sdkTool: (...values) => { calls.push(values); return { name: values[0], handler: values[3] }; },
    createSdkMcpServer: (value) => { configuration = value; return server; } };
  const built = createDiscoveryServer(input);
  return { calls, configuration, server, built, input,
    run: (index, value = args[index]) => calls[index][3](value) };
}

test('exact two deferred descriptors and 5000ms borrowed SDK server factory', () => {
  const f = fixture();
  assert.equal(f.built, f.server);
  assert.deepEqual(Object.keys(f.configuration).sort(), ['alwaysLoad','name','timeout','tools','version']);
  assert.equal(f.configuration.name, 'wire');
  assert.equal(f.configuration.version, '1.0.0');
  assert.equal(f.configuration.alwaysLoad, false);
  assert.equal(f.configuration.timeout, 5000);
  assert.deepEqual(f.calls.map((row) => row[0]), ['lookup_message','lookup_messages']);
  for (let i = 0; i < 2; i++) {
    assert.equal(f.calls[i][1], DISCOVERY_FIXTURE.tools[i].description);
    assert.deepEqual(f.calls[i][4], { searchHint: DISCOVERY_FIXTURE.tools[i].searchHint, alwaysLoad: false });
  }
  assert.equal(f.calls.some(([name]) => name === 'lookup_message_attachment'), false);
});

test('similar-name and paraphrase tools send distinct literal operations and full context', async () => {
  const observations = [];
  const gateway = { authorize: async (r) => { observations.push(['authorize',r]); return true; },
    execute: async (r) => { observations.push(['execute',r]); return success; } };
  const f = fixture(gateway);
  assert.equal(await f.run(0), success);
  assert.equal(await f.run(1), success);
  assert.deepEqual(observations.map(([stage,r]) => [stage,r.operation]), [
    ['authorize','lookup_message'],['execute','lookup_message'],
    ['authorize','lookup_messages'],['execute','lookup_messages'],
  ]);
  for (let i=0;i<4;i++) {
    const request = observations[i][1];
    assert.deepEqual(request.runBinding, context().runBinding);
    assert.equal(request.contractVersion, '0.1.0');
    assert.equal(request.sessionId, context().sessionId);
    assert.deepEqual(request.arguments, args[Math.floor(i/2)]);
    assert.equal(Object.isFrozen(request), true);
    assert.equal(Object.isFrozen(request.runBinding), true);
    assert.equal(Object.isFrozen(request.arguments), true);
  }
  assert.equal(observations[0][1], observations[1][1]);
});

test('strict schemas reject extra, wrong-case, missing, foreign and cross-tool inputs before gateway', async () => {
  let gatewayCalls=0;
  const f=fixture({ authorize: async()=>{gatewayCalls++;return true;},execute:async()=>{gatewayCalls++;return success;} });
  const bad = [null, [], {}, {messageId:'foreign'}, {MessageId:'fixture-message-7'},
    {messageId:'fixture-message-7',tenantId:'other'}, {messageId:'fixture-message-7',operation:'lookup_message_attachment'},
    {subject:'orchard meeting'}, {messageId:7}, Object.assign(Object.create(null),args[0])];
  for (const value of bad) assert.equal((await f.run(0,value)).isError,true);
  assert.equal((await f.run(1,{subject:'orchard meetings'})).isError,true);
  assert.equal(gatewayCalls,0);
});

test('input accessors, symbols and hidden fields refuse without reading or authorizing', async () => {
  let reads=0, calls=0;
  const f=fixture({ authorize:async()=>{calls++;return true;},execute:async()=>success });
  const accessor={}; Object.defineProperty(accessor,'messageId',{enumerable:true,get(){reads++;return 'fixture-message-7';}});
  const hidden={...args[0]}; Object.defineProperty(hidden,'hidden',{value:true});
  for(const value of [accessor,hidden,{...args[0],[Symbol('x')]:1}]) assert.equal((await f.run(0,value)).isError,true);
  assert.equal(reads,0);assert.equal(calls,0);
});

test('revoked after discovery or prior permission allow denies without execution', async () => {
  let active=true, effects=0, authorizations=0;
  const f=fixture({ authorize:async()=>{authorizations++;return active;},execute:async()=>{effects++;return success;} });
  // The earlier allow is external and deliberately is not an adapter input.
  assert.equal(await f.run(0),success);
  active=false;
  assert.equal((await f.run(0)).isError,true);
  assert.equal(authorizations,2);assert.equal(effects,1);
});

test('only literal gateway true permits execution; denial and exceptions are content-free', async () => {
  const secret='must-never-reach-model';
  for(const decision of [false,undefined,null,0,1,'true',{}, {behavior:'allow'}]) {
    let effects=0;
    const f=fixture({authorize:async()=>decision,execute:async()=>{effects++;return success;}});
    const result=await f.run(0);assert.equal(result.isError,true);assert.equal(effects,0);
    assert.equal(JSON.stringify(result).includes('synthetic-tenant'),false);
  }
  const f=fixture({authorize:async()=>{throw new Error(secret);},execute:async()=>{throw new Error('unreachable');}});
  assert.equal(JSON.stringify(await f.run(0)).includes(secret),false);
});

test('gateway execution owns final recheck after authorization and failure stays private', async () => {
  let active=true,effects=0;
  const f=fixture({authorize:async()=>{active=false;return true;},execute:async()=>{
    if(!active)throw new Error('private revocation detail');effects++;return success;
  }});
  const result=await f.run(0);assert.equal(result.isError,true);assert.equal(effects,0);
  assert.equal(JSON.stringify(result).includes('private'),false);
});

test('context and callback snapshots resist later caller substitution without freezing borrowed owners', async () => {
  const ctx=context();let request;
  const gateway={authorize:async(r)=>{request=r;return true;},execute:async()=>success};
  const f=fixture(gateway,ctx);
  ctx.runBinding.tenantId='different';ctx.runBinding.writerFence=999;ctx.sessionId='changed';
  gateway.authorize=async()=>{throw new Error('substituted callback');};
  gateway.execute=async()=>{throw new Error('substituted callback');};
  assert.equal(await f.run(0),success);
  assert.deepEqual(request.runBinding,context().runBinding);assert.equal(request.sessionId,context().sessionId);
  assert.equal(Object.isFrozen(gateway),false);assert.equal(Object.isFrozen(ctx),false);
  assert.equal(Object.isFrozen(f.server),false);assert.equal(Object.isFrozen(f.server.instance),false);
});

test('arguments are copied before await and immutable during the authorization/execution gap', async () => {
  let release,observed;
  const wait=new Promise(resolve=>{release=resolve;});
  const f=fixture({authorize:async(r)=>{observed=r;await wait;return true;},execute:async(r)=>{
    assert.equal(r.arguments.messageId,'fixture-message-7');return success;
  }});
  const input={...args[0]};const pending=f.run(0,input);input.messageId='foreign';
  assert.throws(()=>{observed.arguments.messageId='foreign';},TypeError);
  release();assert.equal(await pending,success);
});

test('canonical scope/version/fence defects fail before constructing any SDK tool', () => {
  const mutations=[c=>{c.contractVersion='0.2.0';},c=>{c.runBinding.writerFence=0;},
    c=>{c.runBinding.tenantId='';},c=>{delete c.runBinding.workerId;},
    c=>{c.runBinding.extra=true;},c=>{c.sessionId='not-a-uuid';}];
  for(const mutate of mutations){let constructs=0;const c=context();mutate(c);
    assert.throws(()=>createDiscoveryServer({context:c,z,gateway:{authorize:async()=>true,execute:async()=>success},
      sdkTool:()=>{constructs++;},createSdkMcpServer:()=>{constructs++;}}));
    assert.equal(constructs,0);
  }
});

test('well-shaped foreign scope or stale fence is passed to the canonical gateway and denied', async () => {
  for(const mutate of [c=>{c.runBinding.tenantId='foreign-tenant';},c=>{c.runBinding.writerFence=6;}]){
    const c=context();mutate(c);let effects=0,seen;
    const f=fixture({authorize:async(r)=>{seen=r;return r.runBinding.tenantId==='synthetic-tenant'&&r.runBinding.writerFence===7;},
      execute:async()=>{effects++;return success;}},c);
    assert.equal((await f.run(0)).isError,true);assert.equal(effects,0);assert.deepEqual(seen.runBinding,c.runBinding);
  }
});

test('context hazards and missing gateway callbacks fail before SDK registration', () => {
  for(const make of [()=>({...context(),extra:true}),()=>({...context(),[Symbol('x')]:true}),()=>{
    const c=context();Object.defineProperty(c.runBinding,'writerFence',{enumerable:true,get(){throw new Error('must not read');}});return c;
  }])assert.throws(()=>fixture(undefined,make()));
  assert.throws(()=>fixture({authorize:async()=>true}));
});
