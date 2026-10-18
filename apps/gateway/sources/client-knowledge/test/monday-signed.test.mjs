import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createMondaySignedHttpAdapter} from '../monday-signed-adapter.mjs';
import {createMondaySignedReadHandler} from '../monday-signed-handler.mjs';
import {createClientKnowledgeFixture,NOW,uuid} from './fixtures.mjs';

const operation='read_monday_client_boards',invocationId='synthetic_monday_1';
const endpoint=`https://synthetic-core.example.invalid/api/clio/tools/${operation}`;
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
function scene() {
  const f=createClientKnowledgeFixture(operation),wire=[],requests=[];
  const config={...f.config,endpoints:{[operation]:endpoint},
    async getCredentials(pins){requests.push(pins);return {...f.credentials(pins),invocationId:pins.invocationId,
      authorizationScheme:'CapiroMeriRead',target:pins.target,correlationSha256:pins.correlationSha256};},
    async fetchImpl(url,options){wire.push({url,options});return new Response(JSON.stringify(f.page(JSON.parse(options.body).input)),
      {headers:{'content-type':'application/json'}});}};
  const execute=(changes={},call={...f.call(),invocationId})=>createMondaySignedReadHandler({operation:f.operation,
    adapter:createMondaySignedHttpAdapter({...config,...changes}),now:()=>f.state.now})(call);
  return {f,config,requests,wire,execute};
}

test('Monday signed Core route binds invocation, exact body bytes and four-field correlation',async()=>{
  const {f,requests,wire,execute}=scene(),output=JSON.parse(await execute());
  assert.deepEqual(output.result,f.page());assert.deepEqual(output.binding,f.binding);
  assert.equal(wire.length,1);assert.equal(wire[0].url,endpoint);
  const {options}=wire[0],body=JSON.parse(options.body),pins=requests[0];
  assert.deepEqual(body,{input:f.input(),metadata:f.normalized().metadata});
  assert.equal(options.body,JSON.stringify(body));assert.equal(pins.invocationId,invocationId);
  assert.equal(pins.argumentsSha256,canonicalSha256(body.input));
  assert.equal(pins.requestSha256,canonicalSha256(body));
  assert.deepEqual(pins.target,{method:'POST',path:`/api/clio/tools/${operation}`,bodySha256:sha(options.body)});
  assert.equal(options.headers.authorization,'CapiroMeriRead SYNTHETIC_KNOWLEDGE_TOKEN');
  assert.equal(options.headers['x-meri-deadline-at'],String(NOW+1000));
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  const correlation=Buffer.from(options.headers['x-meri-read-correlation'],'base64url').toString('utf8');
  assert.equal(correlation,canonicalize({binding:f.binding,subject:f.subject,
    policyRevision:f.authority.policyRevision,normalizationContext:{}}));
  assert.equal(pins.correlationSha256,sha(correlation));
  assert.ok(!options.body.includes('SYNTHETIC_KNOWLEDGE_TOKEN'));
});

test('Monday requires trusted invocation and exact configured Core route before broker or Fetch',async()=>{
  const s=scene();await assert.rejects(s.execute({},s.f.call()),/INVALID_ARGUMENTS|ACCESS_DENIED/);
  assert.equal(s.requests.length,0);assert.equal(s.wire.length,0);
  for(const url of ['https://synthetic-core.example.invalid/monday',
    `https://synthetic-core.example.invalid/api/clio/tools/${operation}?clientId=one`,
    `http://synthetic-core.example.invalid/api/clio/tools/${operation}`])
    assert.throws(()=>createMondaySignedHttpAdapter({...s.config,endpoints:{[operation]:url}}),/GATEWAY_CONFIGURATION/);
});

for(const [name,change] of Object.entries({
  bearer:receipt=>{receipt.authorizationScheme='Bearer';},
  invocation:receipt=>{receipt.invocationId='other_invocation';},
  target:receipt=>{receipt.target={...receipt.target,path:'/api/clio/tools/search_memory'};},
  body:receipt=>{receipt.target={...receipt.target,bodySha256:'0'.repeat(64)};},
  correlation:receipt=>{receipt.correlationSha256='0'.repeat(64);},
  missingCorrelation:receipt=>{delete receipt.correlationSha256;},
  mapping:receipt=>{receipt.managedBoardMapping.clientId=uuid('d');},
  expired:receipt=>{receipt.expiresAtMs=NOW;},
  beyondDeadline:receipt=>{receipt.expiresAtMs=NOW+10001;},
}))test(`Monday ${name} receipt refuses before Fetch`,async()=>{
  const s=scene();await assert.rejects(s.execute({getCredentials:async pins=>{
    const receipt=await s.config.getCredentials(pins);change(receipt);return receipt;
  }}),/ACCESS_DENIED|INVALID_ARGUMENTS/);
  assert.equal(s.wire.length,0);
});

test('Monday bound mapping rejects a source row outside the current board set',async()=>{
  const s=scene(),page=s.f.page();page.records[0].payload.origin.boardId='999';
  page.records[0].provenance.boardId='999';page.records[0].recordId='999:202';
  await assert.rejects(s.execute({fetchImpl:async(url,options)=>{s.wire.push({url,options});
    return new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});}}),/INVALID_RESULT/);
  assert.equal(s.wire.length,1);
});

test('Monday signed response obeys claim output byte bound',async()=>{
  const s=scene(),call={...s.f.call(),invocationId};
  call.authority={...call.authority,claims:{...call.authority.claims,budgets:{...call.authority.claims.budgets,maxOutputBytes:256}}};
  await assert.rejects(s.execute({},call),/RESOURCE_LIMIT/);assert.equal(s.wire.length,1);
});

test('Monday oversized signed correlation refuses before credential issuance',async()=>{
  const s=scene(),call=structuredClone({...s.f.call(),invocationId});
  for(let index=0;index<90;index++){
    const scope={...call.authority.subject.scopes[0],resourceId:`synthetic-client-${index}`};
    call.authority.subject.scopes.push(scope);call.authority.claims.scopes.push({...scope});
    call.authority.decision.scopes.push({...scope});
  }
  assert.ok(Buffer.byteLength(canonicalize({binding:call.authority.binding,subject:call.authority.subject,
    policyRevision:call.authority.policyRevision,normalizationContext:{}}),'utf8')>8192);
  await assert.rejects(s.execute({},call),/RESOURCE_LIMIT/);
  assert.equal(s.requests.length,0);assert.equal(s.wire.length,0);
});
