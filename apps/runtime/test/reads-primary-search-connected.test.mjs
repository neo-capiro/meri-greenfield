/** The real native read composition (composer -> reads HTTP -> reads client -> dispatch -> public-web family ->
 * managed search producer) with an injected paid boundary. No AWS, network, credential or DB is reached:
 * the fixture supplies the provider credential port and answers the gateway URL itself. */
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

test('the configured primary serves discovery through the real composition and its own boundary',async()=>{
 await withEnv(ENV,async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls});
  const response=await f.execute({query:'current release notes',limit:3});
  assert.equal(response.status,200,await response.clone().text());
  const body=await response.json(),result=JSON.parse(body.resultJson).result;
  assert.equal(result.provider,'agentcore-web-search');
  assert.equal(result.results[0].url,'https://public.example.invalid/managed');
  assert.equal(gatewayCalls.length,1,'one submitted attempt by default');
  assert.equal(gatewayCalls[0].method,'POST');
  assert.equal(gatewayCalls[0].body.method,'tools/call');
  assert.equal(gatewayCalls[0].body.params.name,'WebSearch-tool-abc123');
  assert.equal(gatewayCalls[0].headers['mcp-protocol-version'],'2026-07-28');
  assert.match(gatewayCalls[0].headers.authorization,/^AWS4-HMAC-SHA256 Credential=AKIAFIXTURE\//u);
  assert.deepEqual(f.calls.filter(path=>path==='/api/clio/tools/search_public_web'),[],
   'the managed provider replaces the Core discovery route when configured');
 });
});

test('a submitted-but-unobserved attempt is not resent and does not become a success',async()=>{
 await withEnv(ENV,async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls,
   managedSearchResponse:()=>new Response('upstream unavailable',{status:503})});
  const response=await f.execute({query:'current release notes',limit:3});
  const body=await response.json();
  assert.equal(gatewayCalls.length,1,'the default single attempt is not retried blindly');
  assert.equal(body.resultJson,undefined,'an unobserved submission yields no result envelope');
  assert.equal(JSON.stringify(body).includes('Fixture managed result'),false,'no fabricated rows from a failed call');
 });
});

test('without a configured target the existing Core/DDG route is unchanged',async()=>{
 await withEnv({},async()=>{
  const gatewayCalls=[];
  const f=await fixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls});
  const response=await f.execute({query:'public research'});
  assert.equal(response.status,200,await response.clone().text());
  const body=await response.json(),result=JSON.parse(body.resultJson).result;
  assert.notEqual(result.provider,'agentcore-web-search');
  assert.ok(f.calls.includes('/api/clio/tools/search_public_web'),'Core owns discovery when unconfigured');
  assert.equal(gatewayCalls.length,0,'no managed gateway call without a configured target');
  assert.ok(f.calls.includes('/api/clio/tools/search_public_web'),'Core owns discovery when unconfigured');
 });
});
