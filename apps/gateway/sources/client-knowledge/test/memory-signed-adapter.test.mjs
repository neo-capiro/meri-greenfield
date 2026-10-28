import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createSignedMemoryHttpAdapter} from '../memory-signed-http-adapter.mjs';
import {createClientKnowledgeReadHandler} from '../handler.mjs';
import {createClientKnowledgeFixture,NOW} from './fixtures.mjs';

const pagePath='/api/clio/tools/search_memory';
const helperPath='/api/clio/tools/search_memory_eligibility';
const origin='https://synthetic-core.example.invalid';
const invocationId='synthetic_memory_call_1';
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const response=(body,headers={})=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json',...headers}});

/** Current execution-boundary call context: assertReadContext owns this exact shape, with no claims/decision projection. */
const authority=(f,maxOutputBytes=1048576)=>({binding:f.binding,subject:f.subject,executionSha256:'c'.repeat(64),
  policyRevision:f.subject.policyRevision,scopes:f.subject.scopes,sourceIds:f.authority.sourceIds,deadlineMs:NOW+10000,maxOutputBytes});

function scene({client=true,maxOutputBytes=1048576}={}) {
  const f=createClientKnowledgeFixture('search_memory',{client}),wire=[],credentialRequests=[],limits=[];
  // One ordinary user/service identity per call: the page and the eligibility helper each request their own
  // narrowly bound Bearer credential for their own target. There is no separate eligibility credential port.
  const config={endpoints:{search_memory:`${origin}${pagePath}`},now:()=>f.state.now,maxRequestMs:1000,maxResponseBytes:1048576,
    async getCredentials(request){credentialRequests.push(request);return {...f.credentials(request),
      invocationId:request.invocationId,authorizationScheme:'Bearer',target:request.target,correlationSha256:request.correlationSha256,
      ...(credentialRequests.length>1?{bearerToken:'SYNTHETIC_ELIGIBILITY_TOKEN'}:{})};},
    async fetchImpl(url,options){wire.push({url,options});
      if(url.endsWith(pagePath))return response(f.page(JSON.parse(options.body).input));
      if(url.endsWith(helperPath))return response(f.eligibility(JSON.parse(options.body)));
      throw Error('unexpected route');}};
  const call=(changes={})=>({input:f.input(),request:f.args,authority:authority(f,maxOutputBytes),
    normalizationContext:f.normalizationContext,argumentsSha256:f.contract.normalizeInput(f.args,f.normalizationContext).argumentsSha256,
    invocationId,limitReleaseDeadline:expiry=>limits.push(expiry),...changes});
  const execute=(changes={},selection=call())=>createClientKnowledgeReadHandler({operation:f.operation,
    adapter:createSignedMemoryHttpAdapter({...config,...changes}),now:()=>f.state.now})(selection);
  return {f,wire,credentialRequests,limits,config,call,execute};
}

test('selected-client memory uses one ordinary Bearer page and one eligibility call bound to that page request',async()=>{
  const s=scene(),out=JSON.parse(await s.execute());
  assert.deepEqual(out.result,s.f.page());assert.equal(s.wire.length,2);
  assert.deepEqual(s.wire.map(row=>new URL(row.url).pathname),[pagePath,helperPath]);
  const page=s.wire[0].options,helper=s.wire[1].options;
  assert.equal(page.headers.authorization,'Bearer SYNTHETIC_KNOWLEDGE_TOKEN');
  assert.equal(helper.headers.authorization,'Bearer SYNTHETIC_ELIGIBILITY_TOKEN');
  assert.equal(page.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE_SECRET');
  assert.equal(helper.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE_SECRET');
  assert.equal(page.headers['x-meri-read-correlation'],helper.headers['x-meri-read-correlation']);
  const correlation=Buffer.from(page.headers['x-meri-read-correlation'],'base64url').toString('utf8');
  assert.equal(correlation,canonicalize({binding:s.f.binding,subject:s.f.subject,
    policyRevision:s.f.subject.policyRevision,normalizationContext:s.f.normalizationContext}));
  const pageBody=JSON.parse(page.body),helperBody=JSON.parse(helper.body),pagePins=s.credentialRequests[0],helperPins=s.credentialRequests[1];
  assert.deepEqual(pageBody,{input:s.f.input(),metadata:s.f.normalized().metadata});
  assert.equal(pagePins.invocationId,invocationId);assert.equal(helperPins.invocationId,invocationId);
  assert.equal(pagePins.argumentsSha256,canonicalSha256(pageBody.input));
  assert.equal(pagePins.requestSha256,canonicalSha256(pageBody));
  assert.deepEqual(pagePins.target,{method:'POST',path:pagePath,bodySha256:sha(page.body)});
  assert.equal(pagePins.correlationSha256,sha(correlation));
  assert.deepEqual(pagePins.input,helperPins.input);assert.equal(helperPins.argumentsSha256,pagePins.argumentsSha256);
  assert.equal(helperPins.requestSha256,pagePins.requestSha256);assert.equal(helperPins.policyRevision,pagePins.policyRevision);
  assert.equal(pagePins.deadlineMs,NOW+1000);assert.equal(helperPins.deadlineMs,NOW+1000);
  assert.deepEqual(helperPins.target,{method:'POST',path:helperPath,bodySha256:sha(helper.body)});
  assert.equal(helperBody.resultSha256,canonicalSha256(out.result));
  assert.deepEqual(helperBody.records,[{memoryItemId:out.result.records[0].recordId,
    recordSha256:canonicalSha256(out.result.records[0])}]);
  assert.deepEqual(s.limits,[NOW+1000]);
  for(const secret of ['SYNTHETIC_KNOWLEDGE_TOKEN','SYNTHETIC_ELIGIBILITY_TOKEN','SYNTHETIC_SERVICE_SECRET'])
    assert.equal(JSON.stringify(out).includes(secret),false);
});

test('memory admits the General personal scope and refuses a subject/input scope mismatch before credential or HTTP',async()=>{
  const general=scene({client:false}),out=JSON.parse(await general.execute());
  assert.deepEqual(out.result,general.f.page());assert.equal(general.credentialRequests.length,2);
  assert.deepEqual(general.wire.map(row=>new URL(row.url).pathname),[pagePath,helperPath]);
  const clientOnly=scene({client:true}),personalOnly=createClientKnowledgeFixture('search_memory',{client:false});
  await assert.rejects(clientOnly.execute({},clientOnly.call({authority:authority(personalOnly)})),/ACCESS_DENIED/);
  const personalCall=scene({client:false});
  await assert.rejects(personalCall.execute({},personalCall.call({authority:authority(clientOnly.f)})),/ACCESS_DENIED/);
  for(const denied of [clientOnly,personalCall]){
    assert.equal(denied.credentialRequests.length,0);assert.equal(denied.wire.length,0);assert.deepEqual(denied.limits,[]);}
});

test('memory refuses missing dispatcher invocation provenance before any credential request',async()=>{
  for(const change of [{invocationId:undefined},{limitReleaseDeadline:undefined}]){
    const s=scene();await assert.rejects(s.execute({},s.call(change)),/ACCESS_DENIED/);
    assert.equal(s.credentialRequests.length,0);assert.equal(s.wire.length,0);assert.deepEqual(s.limits,[]);}
});

test('over-budget memory page refuses before the eligibility helper is requested',async()=>{
  const s=scene({maxOutputBytes:512});
  await assert.rejects(s.execute(),/RESOURCE_LIMIT/);
  assert.equal(s.credentialRequests.length,1);assert.equal(s.wire.length,1);assert.deepEqual(s.limits,[]);
});

for(const [name,change] of Object.entries({
  scheme:r=>{r.authorizationScheme='CapiroMeriRead';},
  target:r=>{r.target={...r.target,path:'/api/clio/tools/other'};},
  body:r=>{r.target={...r.target,bodySha256:'a'.repeat(64)};},
  invocation:r=>{r.invocationId='different';},
  correlation:r=>{r.correlationSha256='a'.repeat(64);},
  emptyToken:r=>{r.bearerToken='';},
  matchingSecret:r=>{r.serviceSecret=r.bearerToken;},
  expired:r=>{r.expiresAtMs=NOW;},
  beyondDeadline:r=>{r.expiresAtMs=NOW+10001;},
}))test(`memory page ${name} credential refuses before HTTP`,async()=>{
  const s=scene();await assert.rejects(s.execute({getCredentials:async pins=>{
    const r=await s.config.getCredentials(pins);change(r);return r;
  }}),/ACCESS_DENIED/);assert.equal(s.credentialRequests.length,1);assert.equal(s.wire.length,0);assert.deepEqual(s.limits,[]);
});

for(const [name,change] of Object.entries({
  scheme:r=>{r.authorizationScheme='CapiroMeriRead';},
  target:r=>{r.target={...r.target,path:pagePath};},
  body:r=>{r.target={...r.target,bodySha256:'a'.repeat(64)};},
  request:r=>{r.requestSha256='a'.repeat(64);},
  correlation:r=>{r.correlationSha256='a'.repeat(64);},
  emptySecret:r=>{r.serviceSecret='';},
  matchingSecret:r=>{r.serviceSecret=r.bearerToken;},
  expired:r=>{r.expiresAtMs=NOW;},
  beyondDeadline:r=>{r.expiresAtMs=NOW+10001;},
}))test(`memory helper ${name} credential refuses before second HTTP`,async()=>{
  const s=scene();await assert.rejects(s.execute({getCredentials:async pins=>{
    const r=await s.config.getCredentials(pins);if(s.credentialRequests.length>1)change(r);return r;
  }}),/ACCESS_DENIED/);assert.equal(s.credentialRequests.length,2);assert.equal(s.wire.length,1);assert.deepEqual(s.limits,[]);
});

test('memory helper credential missing the ordinary service identity refuses before second HTTP',async()=>{
  const s=scene();await assert.rejects(s.execute({getCredentials:async pins=>{
    const r=await s.config.getCredentials(pins);if(s.credentialRequests.length>1)delete r.serviceSecret;return r;
  }}),/INVALID_ARGUMENTS/);assert.equal(s.wire.length,1);assert.deepEqual(s.limits,[]);
});

test('ineligible current record and lost helper response never invoke the final-release callback',async()=>{
  const bad=scene();await assert.rejects(bad.execute({fetchImpl:async(url,options)=>{
    bad.wire.push({url,options});if(url.endsWith(pagePath))return response(bad.f.page(JSON.parse(options.body).input));
    const receipt=bad.f.eligibility(JSON.parse(options.body));receipt.records[0].eligibleForRecall=false;return response(receipt);
  }}),/ACCESS_DENIED/);assert.equal(bad.wire.length,2);assert.deepEqual(bad.limits,[]);
  const lost=scene();await assert.rejects(lost.execute({fetchImpl:async(url,options)=>{
    lost.wire.push({url,options});if(url.endsWith(pagePath))return response(lost.f.page(JSON.parse(options.body).input));
    throw Error('lost helper response');
  }}),/INTERNAL_ERROR/);assert.equal(lost.wire.length,2);assert.deepEqual(lost.limits,[]);
});

test('memory accepts a bounded helper clock offset and narrows final release to the receipt expiry',async()=>{
  for(const checkedAtMs of [NOW-1000,NOW+500]){
    const s=scene();const out=JSON.parse(await s.execute({fetchImpl:(url,options)=>url.endsWith(helperPath)?
      response({...s.f.eligibility(JSON.parse(options.body)),checkedAtMs}):s.config.fetchImpl(url,options)}));
    assert.deepEqual(out.result,s.f.page());assert.deepEqual(s.limits,[NOW+1000]);
  }
});

test('memory refuses a helper clock offset or expiry beyond the five-second observation bound',async()=>{
  for(const {checkedAtMs,expiresAtMs,maxRequestMs} of [
    {checkedAtMs:NOW-5001,expiresAtMs:NOW+1000,maxRequestMs:1000},
    {checkedAtMs:NOW+5001,expiresAtMs:NOW+7000,maxRequestMs:8000},
    {checkedAtMs:NOW+1000,expiresAtMs:NOW+7000,maxRequestMs:8000},
  ]){
    const s=scene();await assert.rejects(s.execute({maxRequestMs,fetchImpl:(url,options)=>{
      s.wire.push({url,options});const body=JSON.parse(options.body);
      return response(url.endsWith(helperPath)?{...s.f.eligibility(body),checkedAtMs,expiresAtMs}:s.f.page(body.input));}}),/ACCESS_DENIED/);
    assert.equal(s.wire.length,2);assert.deepEqual(s.limits,[]);
  }
});

test('memory endpoint must be the exact configured signed Core page route',()=>{
  const s=scene();for(const url of [`${origin}/memory`,`${origin}${pagePath}?client=other`,`${origin}/api/clio/tools/read_monday_client_boards`,
    `http://synthetic-core.example.invalid${pagePath}`])assert.throws(()=>createSignedMemoryHttpAdapter({...s.config,
      endpoints:{search_memory:url}}),/GATEWAY_CONFIGURATION/);
});

test('the signed memory adapter accepts no retired delegated eligibility port',()=>{
  const s=scene();for(const retired of [{getEligibilityCredentials:async()=>({})},{readMemoryEligibility:async()=>({})}])
    assert.throws(()=>createSignedMemoryHttpAdapter({...s.config,...retired}),/INVALID_ARGUMENTS/);
});
