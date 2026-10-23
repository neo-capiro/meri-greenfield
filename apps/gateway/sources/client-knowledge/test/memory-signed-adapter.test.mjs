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

function scene({general=false}={}) {
  const f=createClientKnowledgeFixture('search_memory',{client:!general}),wire=[],pageRequests=[],helperRequests=[],limits=[];
  const config={endpoints:{search_memory:`${origin}${pagePath}`},now:()=>f.state.now,
    maxRequestMs:1000,maxResponseBytes:1048576,
    async getCredentials(pins){pageRequests.push(pins);return {...f.credentials(pins),
      invocationId:pins.invocationId,authorizationScheme:'CapiroMeriRead',target:pins.target,
      correlationSha256:pins.correlationSha256};},
    async getEligibilityCredentials(pins){helperRequests.push(pins);return {...f.receiptPins(pins),
      invocationId:pins.invocationId,pageProof:pins.pageProof,pageBodySha256:pins.pageBodySha256,
      pageRequestSha256:pins.pageRequestSha256,resultSha256:pins.resultSha256,recordsSha256:pins.recordsSha256,
      authorizationScheme:'CapiroMeriRead',target:pins.target,correlationSha256:pins.correlationSha256,
      bearerToken:'SYNTHETIC_HELPER_TOKEN',serviceSecret:'SYNTHETIC_HELPER_SECRET',expiresAtMs:NOW+1000};},
    async fetchImpl(url,options){wire.push({url,options});
      if(url.endsWith(pagePath))return response(f.page(JSON.parse(options.body).input),
        {'x-meri-memory-page-proof':'SYNTHETIC_PAGE_PROOF'});
      if(url.endsWith(helperPath))return response(f.eligibility(JSON.parse(options.body)));
      throw Error('unexpected route');}};
  const call=(changes={})=>({...f.call(),invocationId,limitReleaseDeadline:expiry=>limits.push(expiry),...changes});
  const execute=(changes={},selection=call())=>createClientKnowledgeReadHandler({operation:f.operation,
    adapter:createSignedMemoryHttpAdapter({...config,...changes}),now:()=>f.state.now})(selection);
  return {f,wire,pageRequests,helperRequests,limits,config,call,execute};
}

test('selected-client memory uses one signed page and one distinct signed eligibility helper',async()=>{
  const s=scene(),out=JSON.parse(await s.execute());
  assert.deepEqual(out.result,s.f.page());assert.equal(s.wire.length,2);
  assert.deepEqual(s.wire.map(row=>new URL(row.url).pathname),[pagePath,helperPath]);
  const page=s.wire[0].options,helper=s.wire[1].options;
  assert.equal(page.headers.authorization,'CapiroMeriRead SYNTHETIC_KNOWLEDGE_TOKEN');
  assert.equal(helper.headers.authorization,'CapiroMeriRead SYNTHETIC_HELPER_TOKEN');
  assert.equal(page.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE_SECRET');
  assert.equal(helper.headers['x-internal-service-secret'],'SYNTHETIC_HELPER_SECRET');
  assert.equal(page.headers['x-meri-read-correlation'],helper.headers['x-meri-read-correlation']);
  const correlation=Buffer.from(page.headers['x-meri-read-correlation'],'base64url').toString('utf8');
  assert.equal(correlation,canonicalize({binding:s.f.binding,subject:s.f.subject,
    policyRevision:s.f.authority.policyRevision,normalizationContext:s.f.normalizationContext}));
  const pageBody=JSON.parse(page.body),helperBody=JSON.parse(helper.body),pagePins=s.pageRequests[0],helperPins=s.helperRequests[0];
  assert.deepEqual(pageBody,{input:s.f.input(),metadata:s.f.normalized().metadata});
  assert.equal(pagePins.invocationId,invocationId);assert.equal(pagePins.argumentsSha256,canonicalSha256(pageBody.input));
  assert.equal(pagePins.requestSha256,canonicalSha256(pageBody));
  assert.deepEqual(pagePins.target,{method:'POST',path:pagePath,bodySha256:sha(page.body)});
  assert.equal(pagePins.correlationSha256,sha(correlation));
  assert.equal(helperPins.pageProof,'SYNTHETIC_PAGE_PROOF');
  assert.equal(helperPins.pageBodySha256,sha(page.body));
  assert.equal(helperPins.pageRequestSha256,canonicalSha256(pageBody));
  assert.equal(helperPins.resultSha256,canonicalSha256(out.result));
  assert.equal(helperPins.recordsSha256,canonicalSha256(helperBody.records));
  assert.equal(helperPins.bodyJson,helper.body);
  assert.deepEqual(helperPins.target,{method:'POST',path:helperPath,bodySha256:sha(helper.body)});
  assert.deepEqual(helperBody.records,[{memoryItemId:out.result.records[0].recordId,
    recordSha256:canonicalSha256(out.result.records[0])}]);
  assert.deepEqual(s.limits,[NOW+1000]);
  assert.equal(JSON.stringify(out).includes('SYNTHETIC_PAGE_PROOF'),false);
  assert.equal(JSON.stringify(out).includes('SYNTHETIC_HELPER_TOKEN'),false);
});

test('memory refuses personal scope and missing dispatcher provenance before credential request',async()=>{
  const s=scene(),personal=createClientKnowledgeFixture('search_memory');
  await assert.rejects(s.execute({},personal.call()),/ACCESS_DENIED/);
  await assert.rejects(s.execute({},s.call({invocationId:undefined})),/ACCESS_DENIED/);
  await assert.rejects(s.execute({},s.call({limitReleaseDeadline:undefined})),/ACCESS_DENIED/);
  assert.equal(s.pageRequests.length,0);assert.equal(s.wire.length,0);
});

test('missing page proof refuses before helper issuance and strips no unverified result',async()=>{
  const s=scene();await assert.rejects(s.execute({fetchImpl:async(url,options)=>{
    s.wire.push({url,options});return response(s.f.page(JSON.parse(options.body).input));
  }}),/ACCESS_DENIED/);
  assert.equal(s.wire.length,1);assert.equal(s.helperRequests.length,0);assert.equal(s.limits.length,0);
});

test('over-budget memory page refuses before eligibility helper credential or HTTP',async()=>{
  const s=scene();s.f.claims.budgets.maxOutputBytes=512;
  await assert.rejects(s.execute(),/RESOURCE_LIMIT/);
  assert.equal(s.pageRequests.length,1);assert.equal(s.wire.length,1);
  assert.equal(s.helperRequests.length,0);assert.equal(s.limits.length,0);
});

for(const [name,change] of Object.entries({
  bearer:r=>{r.authorizationScheme='Bearer';},
  target:r=>{r.target={...r.target,path:'/api/clio/tools/other'};},
  body:r=>{r.target={...r.target,bodySha256:'a'.repeat(64)};},
  invocation:r=>{r.invocationId='different';},
  correlation:r=>{r.correlationSha256='a'.repeat(64);},
  matchingSecret:r=>{r.serviceSecret=r.bearerToken;},
}))test(`memory page ${name} credential refuses before HTTP`,async()=>{
  const s=scene();await assert.rejects(s.execute({getCredentials:async pins=>{
    const r=await s.config.getCredentials(pins);change(r);return r;
  }}),/ACCESS_DENIED/);assert.equal(s.wire.length,0);assert.equal(s.limits.length,0);
});

for(const [name,change] of Object.entries({
  bearer:r=>{r.authorizationScheme='Bearer';},
  target:r=>{r.target={...r.target,path:'/api/clio/tools/other'};},
  body:r=>{r.target={...r.target,bodySha256:'a'.repeat(64)};},
  proof:r=>{r.pageProof='other';},
  result:r=>{r.resultSha256='a'.repeat(64);},
  token:r=>{r.bearerToken='SYNTHETIC_KNOWLEDGE_TOKEN';},
  emptySecret:r=>{r.serviceSecret='';},
  matchingSecret:r=>{r.serviceSecret=r.bearerToken;},
}))test(`memory helper ${name} credential refuses before second HTTP`,async()=>{
  const s=scene();await assert.rejects(s.execute({getEligibilityCredentials:async pins=>{
    const r=await s.config.getEligibilityCredentials(pins);change(r);return r;
  }}),/ACCESS_DENIED/);assert.equal(s.wire.length,1);assert.equal(s.limits.length,0);
});

test('memory helper missing service identity refuses before second HTTP',async()=>{
  const s=scene();await assert.rejects(s.execute({getEligibilityCredentials:async pins=>{
    const r=await s.config.getEligibilityCredentials(pins);delete r.serviceSecret;return r;
  }}),/INVALID_ARGUMENTS/);assert.equal(s.wire.length,1);assert.equal(s.limits.length,0);
});

test('ineligible current record and lost helper response never invoke final-release expiry callback',async()=>{
  const bad=scene();await assert.rejects(bad.execute({fetchImpl:async(url,options)=>{
    bad.wire.push({url,options});if(url.endsWith(pagePath))return response(bad.f.page(JSON.parse(options.body).input),
      {'x-meri-memory-page-proof':'SYNTHETIC_PAGE_PROOF'});
    const r=bad.f.eligibility(JSON.parse(options.body));r.records[0].eligibleForRecall=false;return response(r);
  }}),/ACCESS_DENIED/);assert.equal(bad.wire.length,2);assert.equal(bad.limits.length,0);
  const lost=scene();await assert.rejects(lost.execute({fetchImpl:async(url,options)=>{
    lost.wire.push({url,options});if(url.endsWith(pagePath))return response(lost.f.page(JSON.parse(options.body).input),
      {'x-meri-memory-page-proof':'SYNTHETIC_PAGE_PROOF'});
    throw Error('lost helper response');
  }}));assert.equal(lost.wire.length,2);assert.equal(lost.limits.length,0);
});

test('signed memory accepts a bounded Core clock offset and narrows final release to receipt expiry',async()=>{
  for(const checkedAtMs of [NOW-1000,NOW+500]){
    const s=scene();const out=JSON.parse(await s.execute({fetchImpl:(url,options)=>{
      if(!url.endsWith(helperPath))return s.config.fetchImpl(url,options);
      return response({...s.f.eligibility(JSON.parse(options.body)),checkedAtMs});
    }}));
    assert.equal(out.result.tool,'search_memory');assert.deepEqual(s.limits,[NOW+1000]);
  }
});

test('signed memory refuses receipt clock offset or expiry beyond the five-second observation bound',async()=>{
  for(const {checkedAtMs,expiresAtMs,maxRequestMs} of [
    {checkedAtMs:NOW-5001,expiresAtMs:NOW+1000,maxRequestMs:1000},
    {checkedAtMs:NOW+5001,expiresAtMs:NOW+7000,maxRequestMs:8000},
    {checkedAtMs:NOW+1000,expiresAtMs:NOW+7000,maxRequestMs:8000},
  ]){
    const s=scene();await assert.rejects(s.execute({maxRequestMs,
      getEligibilityCredentials:async pins=>({...await s.config.getEligibilityCredentials(pins),expiresAtMs:NOW+maxRequestMs}),
      fetchImpl:(url,options)=>{
        if(!url.endsWith(helperPath))return s.config.fetchImpl(url,options);
        return response({...s.f.eligibility(JSON.parse(options.body)),checkedAtMs,expiresAtMs});
      }}),/ACCESS_DENIED/);
    assert.deepEqual(s.limits,[]);
  }
});

test('memory endpoint must be the exact configured signed Core page route',()=>{
  const s=scene();for(const url of [`${origin}/memory`,`${origin}${pagePath}?client=other`,`${origin}/api/clio/tools/read_monday_client_boards`,
    `http://synthetic-core.example.invalid${pagePath}`])assert.throws(()=>createSignedMemoryHttpAdapter({...s.config,
      endpoints:{search_memory:url}}),/GATEWAY_CONFIGURATION/);
});


test('General signed memory preserves exact personal actor scope and mandatory page/eligibility proof for firm and personal records',async()=>{
 for(const scope of ['firm','user_private']){const s=scene({general:true});const raw=s.f.page();raw.records[0].payload.scope=scope;
  const value=JSON.parse(await s.execute({fetchImpl:async(url,options)=>url.endsWith(pagePath)?response(raw,{'x-meri-memory-page-proof':'SYNTHETIC_PAGE_PROOF'}):response(s.f.eligibility(JSON.parse(options.body)))}));
  assert.equal(value.subject.kind,'personal');assert.equal(value.result.records[0].payload.clientId,null);assert.equal(s.pageRequests.length,1);assert.equal(s.helperRequests.length,1);
 }
});
test('General signed memory refuses client records, mixed task scopes and changed identity before release',async()=>{
 const client=scene({general:true}),page=client.f.page();page.records[0].payload.scope='client';page.records[0].payload.clientId=client.f.clientId;page.records[0].entityRef={type:'client',id:client.f.clientId};page.results[0].clientId=client.f.clientId;
 await assert.rejects(client.execute({fetchImpl:async()=>response(page,{'x-meri-memory-page-proof':'SYNTHETIC_PAGE_PROOF'})}));assert.equal(client.helperRequests.length,0);
 for(const mutate of [f=>f.claims.scopes.push({...f.claims.scopes[0],kind:'client',resourceId:f.clientId}),f=>f.subject.scopes[0].resourceId=f.clientId,f=>f.subject.actorId=f.clientId]){
  const s=scene({general:true});mutate(s.f);await assert.rejects(s.execute());assert.equal(s.wire.length,0);
 }
});
test('General signed memory refuses expired page/helper authority and stale or mismatched eligibility proof',async()=>{
 for(const mutation of ['expiry','identity','result','record']){const s=scene({general:true});
  await assert.rejects(s.execute({fetchImpl:async(url,options)=>{if(url.endsWith(pagePath))return response(s.f.page(),{'x-meri-memory-page-proof':'SYNTHETIC_PAGE_PROOF'});const r=s.f.eligibility(JSON.parse(options.body));if(mutation==='expiry')r.expiresAtMs=NOW;if(mutation==='identity')r.binding.actorId=s.f.clientId;if(mutation==='result')r.resultSha256='a'.repeat(64);if(mutation==='record')r.records[0].eligibleForRecall=false;return response(r);}}));
  assert.equal(s.limits.length,0);
 }
});
