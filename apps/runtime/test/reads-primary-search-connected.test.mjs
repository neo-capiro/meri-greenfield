/** The real native read composition (composer -> reads HTTP -> reads client -> dispatch -> public-web family ->
 * managed search producer) driven through the actual reads client, with an injected paid boundary. No AWS,
 * network, credential or DB is reached: the fixture supplies the provider credential port and answers the
 * gateway URL itself. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './reads-native-fixture.mjs';

const ENDPOINT='https://meri-preview-web-search-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp';
const ENV={MERI_WEB_SEARCH_GATEWAY_ENDPOINT:ENDPOINT,MERI_WEB_SEARCH_TOOL:'WebSearch-tool-abc123',MERI_WEB_SEARCH_REGION:'us-east-1'};
const CREDS=async()=>({accessKeyId:'AKIAFIXTURE',secretAccessKey:'fixture-secret'});
const withEnv=async(env,run)=>{
 const saved={};
 for(const key of Object.keys(ENV)){saved[key]=process.env[key];delete process.env[key];}
 Object.assign(process.env,env);
 try{return await run();}
 finally{for(const key of Object.keys(ENV)){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
};
const request=f=>({operation:f.operation,arguments:{query:'current release notes',limit:3},deliveryId:'synthetic'});

test('the configured primary serves discovery through the actual reads client and records its own boundary',async()=>{
 await withEnv(ENV,async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls});
  const delivered=await f.port.execute(request(f));
  const result=JSON.parse(delivered).result;
  assert.equal(result.provider,'agentcore-web-search');
  assert.equal(result.results[0].url,'https://public.example.invalid/managed');
  assert.equal(gatewayCalls.length,1,'one submitted attempt by default');
  assert.equal(gatewayCalls[0].body.method,'tools/call');
  assert.equal(gatewayCalls[0].body.params.name,'WebSearch-tool-abc123');
  assert.equal(gatewayCalls[0].headers['mcp-protocol-version'],'2026-07-28');
  assert.match(gatewayCalls[0].headers.authorization,/^AWS4-HMAC-SHA256 Credential=AKIAFIXTURE\//u);
  assert.deepEqual(f.calls.filter(path=>path==='/api/clio/tools/search_public_web'),[],
   'the managed provider replaces the Core discovery route when configured');
  const facts=f.port.externalUsage();
  assert.equal(facts.provider,'agentcore-web-search');
  assert.equal(facts.attempts,1);
  assert.equal(facts.estimateMicroUsd,7005);
  assert.equal(facts.billedMicroUsd,null,'no billed cost is invented');
  assert.equal(facts.outcome,'completed');
  assert.equal(facts.truncated,false);
  assert.equal(facts.calls.length,1);
  assert.equal(JSON.stringify(facts).includes('current release notes'),false,'facts carry no query or result content');
 });
});

test('a submitted-but-unobserved attempt reaches the client as unknown facts and is not resent',async()=>{
 await withEnv(ENV,async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls,
   managedSearchResponse:()=>new Response('upstream unavailable',{status:503})});
  await assert.rejects(()=>f.port.execute(request(f)));
  assert.equal(gatewayCalls.length,1,'the single attempt is not retried blindly after an unobserved submission');
  const facts=f.port.externalUsage();
  assert.equal(facts.attempts,1,'the submitted attempt is still counted');
  assert.equal(facts.outcome,'unknown','an unobserved outcome is unknown, never success or free');
  assert.equal(facts.estimateMicroUsd,7005);
  assert.equal(facts.billedMicroUsd,null);
 });
});

test('a refused credential is not a submitted billable call',async()=>{
 await withEnv(ENV,async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{gatewayCalls,
   primaryCredentials:async()=>{throw Object.assign(Error('no credential'),{code:'UNAVAILABLE'});}});
  await assert.rejects(()=>f.port.execute(request(f)));
  assert.equal(gatewayCalls.length,0,'no provider request without a credential');
  assert.equal(f.port.externalUsage(),undefined,'nothing submitted means no external usage facts');
 });
});

test('without a configured target the existing Core/DDG route is unchanged',async()=>{
 await withEnv({},async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls});
  const delivered=await f.port.execute({operation:f.operation,arguments:{query:'public research'},deliveryId:'synthetic'});
  const result=JSON.parse(delivered).result;
  assert.notEqual(result.provider,'agentcore-web-search');
  assert.equal(gatewayCalls.length,0,'no managed gateway call without a configured target');
  assert.ok(f.calls.includes('/api/clio/tools/search_public_web'),'Core owns discovery when unconfigured');
  assert.equal(f.port.externalUsage(),undefined,'the Core route reports no external provider facts');
 });
});

test('two distinct searches aggregate into one run total instead of replacing each other',async()=>{
 await withEnv(ENV,async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls});
  const first=await f.port.execute({operation:f.operation,arguments:{query:'first look',limit:3},deliveryId:'synthetic-a'});
  const second=await f.port.execute({operation:f.operation,arguments:{query:'second look',limit:3},deliveryId:'synthetic-b'});
  assert.equal(gatewayCalls.length,2);
  assert.ok(JSON.parse(first)&&JSON.parse(second));
  const facts=f.port.externalUsage();
  assert.equal(facts.calls.length,2,'both invocations are kept');
  assert.equal(facts.attempts,2,'the run total is the sum, not the last response');
  assert.equal(facts.estimateMicroUsd,14010);
  assert.equal(facts.outcome,'completed');
  assert.equal(facts.incomplete,false);
  assert.deepEqual(facts.unobserved,[]);
 });
});

test('concurrent completions cannot double count one delivery',async()=>{
 await withEnv(ENV,async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls});
  const call=deliveryId=>f.port.execute({operation:f.operation,arguments:{query:'parallel look',limit:2},deliveryId});
  await Promise.all([call('synthetic-p'),call('synthetic-q')]);
  const facts=f.port.externalUsage();
  assert.equal(gatewayCalls.length,2);
  assert.equal(facts.calls.length,2);
  assert.equal(facts.attempts,2);
  // A replayed delivery for an already-counted call adds nothing.
  await call('synthetic-p');
  assert.equal(f.port.externalUsage().calls.length,2,'one delivery is counted once');
 });
});

test('a lost response marks the run incomplete without inventing attempts',async()=>{
 await withEnv(ENV,async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls,dropExecuteResponseOnce:true});
  await assert.rejects(()=>f.port.execute({operation:f.operation,arguments:{query:'lost look',limit:3},deliveryId:'synthetic-lost'}));
  assert.equal(gatewayCalls.length,1,'the provider call still happened');
  const facts=f.port.externalUsage();
  assert.equal(facts.incomplete,true,'the run knows a response was never observed');
  assert.deepEqual(facts.unobserved,['synthetic-lost']);
  assert.equal(facts.attempts,0,'no attempt is invented from an unobserved response');
  assert.equal(facts.estimateMicroUsd,0,'no cost is invented either');
  assert.equal(facts.outcome,'unknown');
  assert.equal(facts.billedMicroUsd,null);
 });
});

test('a canonical ACCESS_DENIED refusal is failed, not unknown',async()=>{
 await withEnv(ENV,async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls,
   managedSearchResponse:()=>new Response('forbidden',{status:403})});
  await assert.rejects(()=>f.port.execute({operation:f.operation,arguments:{query:'denied look',limit:3},deliveryId:'synthetic-denied'}));
  assert.equal(gatewayCalls.length,1);
  const facts=f.port.externalUsage();
  assert.equal(facts.outcome,'failed','the GatewayDenied code is read from its canonical message');
  assert.equal(facts.attempts,1,'the submitted attempt is still counted');
  assert.equal(facts.incomplete,false);
 });
});
