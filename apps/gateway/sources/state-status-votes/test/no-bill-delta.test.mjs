/** No-bill stored floor-vote selection and full native resolution admission remain distinct. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createStateStatusVotesHandlers} from '../handler.mjs';
import {assertStoredStateRequest} from '../request-context.mjs';
import {storedCase,billKey,note} from './fixture.mjs';

const id='search_state_floor_votes',operation={id,version:'0.2.0'};
test('shared preflight preserves canonical case/dot/clip aliases while classifying only effective no-bill selection as missing',()=>{
 for(const selected of [{id:'get_state_bill_status',version:'0.2.0'},operation])for(const request of [
  {billId:' T.X.-2025-H.B.1234 ',state:' fl '},{billId:billKey+' '.repeat(70)+'TX HB 9'}]){
  const raw=assertStoredStateRequest(selected,request);assert.deepEqual(raw,request);assert.notEqual(raw,request);assert.ok(Object.isFrozen(raw));
 }
 for(const request of [{billId:null},{billId:'   '},{state:' tx '}])assert.deepEqual(assertStoredStateRequest(operation,request),request);
 assert.deepEqual(assertStoredStateRequest({id:'get_state_bill_status',version:'0.2.0'},{billId:'TX HB 9',query:billKey}),{billId:'TX HB 9',query:billKey});
});
test('absent/null/empty/blank effective bill selector admits the stored floor-vote branch without a resolution observation',async()=>{
 for(const request of [{},{billId:null},{billId:''},{billId:'   '},{state:'TX'},{billId:null,state:' tx ',query:'pass',chamber:' LOWER ',limit:'1.9'}]){
  const f=storedCase(id,{request}),call=f.call(),out=JSON.parse(await f.handler()(call));
  assert.equal(f.contract.normalizeInput(request,{}).metadata.selector.kind,'missing');assert.deepEqual(assertStoredStateRequest(operation,request),request);
  assert.deepEqual(f.wire[0].body,request);assert.equal(f.wire[0].url,'https://native-core.example.invalid/api/clio/tools/search_state_floor_votes');
  assert.deepEqual(f.credentialCalls[0].normalizationContext,{});assert.equal(f.credentialCalls[0].requestSha256,hash(request));
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation,argumentsSha256:call.argumentsSha256,result:f.page});
 }
});

test('floor-vote query remains a motion selector even when it resembles a bill, unlike status query fallback',async()=>{
 for(const query of ['TX HB 1234',billKey]){
  const request={query,state:'TX'},f=storedCase(id,{request}),out=JSON.parse(await f.handler()(f.call()));
  assert.equal(f.call().input.query,query);assert.equal(Object.hasOwn(f.call().input,'billId'),false);
  assert.deepEqual(f.wire[0].body,request);assert.equal(out.result.votesFound,1);
 }
 const status={id:'get_state_bill_status',version:'0.2.0'};
 assert.deepEqual(assertStoredStateRequest(status,{query:'TX HB 1234'}),{query:'TX HB 1234'});
 assert.doesNotThrow(()=>assertStoredStateRequest(status,{query:billKey}));
});

test('no-bill state prefix correlates every row and unscoped stored votes may span states',async()=>{
 const f=storedCase(id,{request:{state:'TX',limit:2}}),base=f.page.votes[0];
 f.state.page={...f.page,votesFound:2,votes:[{...base,id:'tx-a',billKey:'tx-2025-hb1'},{...base,id:'tx-b',billKey:'tx-2025-sb2'}]};
 assert.deepEqual(JSON.parse(await f.handler()(f.call())).result.votes.map(row=>row.billKey),['tx-2025-hb1','tx-2025-sb2']);
 f.state.resultMutator=page=>page.votes[1].billKey='fl-2025-hb2';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 const g=storedCase(id,{request:{limit:2}});g.state.page={...g.page,votesFound:2,votes:[{...base,id:'tx',billKey:'tx-2025-hb1'},
  {...base,id:'fl',billKey:'fl-2025-hb2'}]};
 assert.deepEqual(JSON.parse(await g.handler()(g.call())).result.votes.map(row=>row.billKey),['tx-2025-hb1','fl-2025-hb2']);
});

test('no-bill result retains chamber/motion/limit/date predicates and actual empty-source honesty',async()=>{
 for(const mutate of [page=>page.votesFound=0,page=>page.votes[0].chamber='upper',page=>page.votes[0].motion=null,
  page=>page.votes.push({...page.votes[0],id:'second'}),page=>page.votes[0].date='2025-01-15T12:00:00.000Z']){
  const f=storedCase(id,{request:{state:'TX',chamber:'lower',query:'pass',limit:1}});f.state.resultMutator=mutate;
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 const f=storedCase(id,{request:{state:'TX'}});f.state.page={tool:id,generatedAt:f.page.generatedAt,votesFound:0,votes:[],note:note('NoStateVotesNote')};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,f.state.page);assert.equal(f.wire.length,1);
 assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);assert.equal(Object.hasOwn(out.result,'complete'),false);
 f.state.resultMutator=page=>page.note='No vote exists';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('no-bill selection still requires current exact actor/tenant/operation/source grants and correlated credentials',async()=>{
 for(const mutate of [a=>a.decision.operation='other@0.2.0',a=>a.claims.actions=[],a=>a.binding.tenantId='other',
  a=>a.decision.actor.actorId='other',a=>a.decision.scopes=[],a=>a.sourceIds=[]]){
  const f=storedCase(id,{request:{}}),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
 const f=storedCase(id,{request:{}});f.state.credentialMutator=proof=>proof.requestSha256='0'.repeat(64);
 await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
});

test('supplied designation, malformed and UUID selectors delegate once and cannot broaden unresolved votes',async()=>{
 for(const request of [{billId:'TX HB 1234',state:'TX'},{billId:'HB 1234',state:'TX'},{billId:'not-a-bill',state:'TX'},
  {billId:'71000000-0000-4000-8000-000000000091'},{billId:'X'.repeat(60)+billKey},{billId:'TX HB 1',query:billKey}]){
  const f=storedCase(id,{request}),{getCredentials,...configuration}=f.transport;let factories=0;
  const [handler]=createStateStatusVotesHandlers({...configuration,now:f.now,credentialsForCall:()=>{factories++;return getCredentials;}},[operation]);
  assert.deepEqual(assertStoredStateRequest(operation,request),request);
  const out=JSON.parse(await handler.execute(f.call()));assert.deepEqual(out.result,f.page);assert.deepEqual(f.wire[0].body,request);
  if(f.contract.normalizeInput(request,{}).metadata.selector.kind==='invalid'){assert.equal(out.result.votesFound,0);assert.deepEqual(out.result.votes,[]);}
  assert.equal(factories,1);assert.equal(f.credentialCalls.length,1);assert.equal(f.wire.length,1);
 }
 for(const request of [{},{billId:null},{billId:''},{billId:'   '},{state:'TX'}])
  assert.deepEqual(assertStoredStateRequest({id:'get_state_bill_status',version:'0.2.0'},request),request);
});

test('pure stored-state preflight rejects extra trust/no-fetch fields and hostile objects without executing hooks',async()=>{
 let effects=0;
 for(const request of [{state:'TX',storedOnly:true},{state:'TX',noFetch:true},{state:'TX',tenantId:'other'},{billId:12},
  {get billId(){effects++;return null;}},new Proxy({},{get(){effects++;throw Error('hook');}})])
  assert.throws(()=>assertStoredStateRequest(operation,request),{message:'INVALID_ARGUMENTS'});
 assert.throws(()=>assertStoredStateRequest({id:'search_state_bills',version:'0.2.0'},{}),{message:'GATEWAY_CONFIGURATION'});
 assert.equal(effects,0);
 const f=storedCase(id,{request:{}}),canonical=f.call({billId:billKey});
 await assert.rejects(f.handler()({...f.call(),input:canonical.input,argumentsSha256:canonical.argumentsSha256}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 for(const selected of ['get_state_bill_status',id]){
  const g=storedCase(selected),designation=g.call({billId:'TX HB 1234'}),stored=g.call({billId:billKey});
  await assert.rejects(g.handler()({...designation,input:stored.input,argumentsSha256:stored.argumentsSha256}),{message:'INVALID_ARGUMENTS'});
  assert.equal(g.credentialCalls.length,0);assert.equal(g.wire.length,0);
 }
});
