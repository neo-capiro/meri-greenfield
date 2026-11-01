import test from 'node:test';
import assert from 'node:assert/strict';
import {capiroDataCase,ids} from './fixture.mjs';
import canonicalize from 'canonicalize';

for(const id of ids)test(`${id}: fixed native route preserves authored input, exact result and request binding`,async()=>{
  const f=capiroDataCase(id),call=f.call(),result=JSON.parse(await f.handler()(call));
  assert.equal(new URL(f.wire[0].url).pathname,`/api/clio/tools/${id}`);
  assert.deepEqual(f.wire[0].body,f.arguments);assert.deepEqual(result.result,f.page);
  assert.deepEqual(result.binding,f.authority.binding);assert.equal(result.argumentsSha256,call.argumentsSha256);
  assert.deepEqual(result.operation,f.operation);assert.equal(f.wire.length,1);
});
test('current authority and original argument hash reject before Core dispatch',async()=>{
  for(const mutate of [call=>call.argumentsSha256='0'.repeat(64),call=>call.authority.deadlineMs=0,call=>call.authority.sourceIds=[]]){
    const f=capiroDataCase(),call=structuredClone(f.call());mutate(call);await assert.rejects(f.handler()(call));assert.equal(f.wire.length,0);
  }
});
test('native error is preserved as an error envelope and never converted to empty rows',async()=>{
  const f=capiroDataCase();f.state.page={version:'0.1.0',generatedAt:f.page.generatedAt,ok:false,error:{code:'QUERY_TIMEOUT',message:'Query exceeded the time budget.'}};
  const result=JSON.parse(await f.handler()(f.call()));assert.deepEqual(result.result,f.state.page);assert.equal(Object.hasOwn(result.result,'rows'),false);
});
test('Core HTTP failures map to unavailability, denial or withheld result rather than one generic code',async()=>{
  for(const [status,code] of [[503,'UNAVAILABLE'],[500,'UNAVAILABLE'],[429,'UNAVAILABLE'],[408,'UNAVAILABLE'],[403,'ACCESS_DENIED'],[401,'ACCESS_DENIED'],[404,'INVALID_RESULT'],[400,'INVALID_RESULT']]){
    for(const id of ids){
      const f=capiroDataCase(id);f.state.responseFactory=()=>Response.json({message:'refused'},{status});
      await assert.rejects(f.handler()(f.call()),{message:code},`${id} ${status}`);assert.equal(f.wire.length,1);
    }
  }
});
test('numeric coercion, false counts, undisclosed fields and mismatched limits fail closed',async()=>{
  for(const mutate of [p=>p.rows[0].total=100.1,p=>p.rows[0].count=9007199254740992,p=>p.rowCount=1,p=>p.rows[0].hidden='x',p=>p.limits.rowLimit=200,p=>p.coverage.sourceUniverseComplete=true]){
    const f=capiroDataCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
  }
});
test('UTF8 whole envelope and configured transport caps independently withhold oversized results',async()=>{
  const f=capiroDataCase();f.state.resultMutator=p=>{p.rows[0].pe_code='界'.repeat(90000);};
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  const g=capiroDataCase();await assert.rejects(g.handler({maxResponseBytes:128})(g.call()),{message:'RESOURCE_LIMIT'});
});
test('cancellation after Core returns withholds result bytes',async()=>{
  const f=capiroDataCase(),controller=new AbortController();f.state.afterSource=()=>controller.abort();
  await assert.rejects(f.handler()({...f.call(),signal:controller.signal}),{message:'CANCELLED'});
});

test('private SQL sends exact bounded canonical context only with per-call credentials',async()=>{
  const request={source:'client_records',sql:'SELECT COUNT(*) AS total FROM client_objectives',parameters:[],rowLimit:2};
  const absent=capiroDataCase('query_capiro_data',{request});await assert.rejects(absent.handler()(absent.call()),{message:'UNAVAILABLE'});assert.equal(absent.wire.length,0);
  const f=capiroDataCase('query_capiro_data',{request}),result=JSON.parse(await f.handler({credentialsForCall:()=>f.transport.getCredentials})(f.call()));
  assert.deepEqual(result.result,f.page);assert.deepEqual(f.wire[0].body,request);
  const expected={binding:f.authority.binding,subject:f.authority.subject,policyRevision:f.authority.policyRevision,normalizationContext:f.normalizationContext};
  assert.equal(Buffer.from(f.wire[0].options.headers['x-meri-read-correlation'],'base64url').toString('utf8'),canonicalize(expected));
  const publicCase=capiroDataCase();await publicCase.handler()(publicCase.call());assert.equal(publicCase.wire[0].options.headers['x-meri-read-correlation'],undefined);
});

test('private SQL refuses an injected source before it can bypass attended Core credentials',async()=>{
  const request={source:'client_records',sql:'SELECT COUNT(*) AS total FROM client_objectives',parameters:[],rowLimit:2};
  const f=capiroDataCase('query_capiro_data',{request});let reads=0;
  await assert.rejects(f.handler({getCredentials:undefined,readSource:async()=>{reads++;return f.page;}})(f.call()),{message:'ACCESS_DENIED'});
  assert.equal(reads,0);assert.equal(f.wire.length,0);
});

test('private source result cannot substitute a public page or a different client, even for errors',async()=>{
  const request={source:'client_records',sql:'SELECT COUNT(*) AS total FROM client_objectives',parameters:[],rowLimit:2};
  for(const mutate of [p=>p.version='0.1.0',p=>p.scope.clientId='10000000-0000-4000-8000-000000000001',p=>{delete p.scope;}]){
    const f=capiroDataCase('query_capiro_data',{request});f.state.resultMutator=mutate;
    await assert.rejects(f.handler({credentialsForCall:()=>f.transport.getCredentials})(f.call()),{message:'INVALID_RESULT'});
  }
  const f=capiroDataCase('query_capiro_data',{request});f.state.page={version:'0.1.0',generatedAt:f.page.generatedAt,ok:false,error:{code:'SOURCE_UNAVAILABLE',message:'Unavailable'}};
  await assert.rejects(f.handler({credentialsForCall:()=>f.transport.getCredentials})(f.call()),{message:'INVALID_RESULT'});
});
