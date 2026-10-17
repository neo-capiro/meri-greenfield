/** Native selector/return rails through synthetic HTTP; no LegiScan, cache, quota, ingestion or database executes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {assertStoredStateRequest} from '../request-context.mjs';
import {createStateStatusVotesHandlers} from '../handler.mjs';
import {storedCase,ids,billKey,note,storedPage} from './fixture.mjs';
const status=ids[0],votes=ids[1];
const nativeSuffixes={
 'not-found':' A live LegiScan lookup of the current session found no such bill either.',
 'not-configured':'',
 quota:' A live LegiScan lookup was skipped because this month\u2019s lookup budget is used up; say the bill could not be checked.',
 'provider-error':' A live LegiScan lookup failed; say the bill could not be checked rather than that it does not exist.',
};
const result=async f=>JSON.parse(await f.handler()(f.call())).result;

for(const id of ids)test(`${id}: every frozen selector class delegates the original flat body under the same {} context`,async()=>{
 for(const request of [{billId:billKey},{billId:' TX H.B. 1234 '},{billId:'HB 1234',state:' tx '},
  {billId:'not a designation',state:'TX'},{billId:'not a designation'},{},{billId:null},{billId:'  '}]){
  const f=storedCase(id,{request}),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(assertStoredStateRequest(f.operation,request),request);assert.deepEqual(wire.body,request);
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');
  assert.deepEqual(proof.normalizationContext,{});assert.equal(proof.requestSha256,hash(request));assert.equal(proof.argumentsSha256,call.argumentsSha256);
  assert.equal(Object.hasOwn(wire.options.headers,'x-meri-read-observation'),false);assert.equal(Object.hasOwn(wire.body,'storedOnly'),false);
  assert.deepEqual(out,{binding:f.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(f.wire.length,1);assert.equal(f.credentialCalls.length,1);
 }
});

for(const id of ids)test(`${id}: native live lookup outcome notes retain exact reason/Unicode with no retry or generic absence`,async()=>{
 for(const [nativeOutcome,suffix] of Object.entries(nativeSuffixes)){
  const request={billId:' TX HB 1234 '},f=storedCase(id,{request,nativeOutcome}),out=await result(f);
  assert.equal(out.note,`No bill found matching "TX HB 1234" in TX.${suffix}`);
  if(id===status){assert.equal(out.found,false);assert.equal(Object.hasOwn(out,'billId'),false);}else{assert.equal(out.votesFound,0);assert.deepEqual(out.votes,[]);}
  assert.equal(Object.hasOwn(out,'absenceEvidence'),false);assert.equal(Object.hasOwn(out,'lookupPerformed'),false);
  assert.equal(f.wire.length,1);assert.equal(f.credentialCalls.length,1);assert.deepEqual(f.wire[0].body,request);
 }
});

test('missing and invalid native status branches preserve billId/query precedence and precise request-derived text',async()=>{
 for(const request of [{},{billId:null},{billId:' '},{query:' '},{billId:'',query:null}]){
  const f=storedCase(status,{request}),out=await result(f);assert.deepEqual(out,{tool:status,generatedAt:f.page.generatedAt,found:false,note:note('MissingStateBillNote')});
 }
 for(const [request,expected] of [
  [{billId:' ? ? '},'Could not parse "? ?" as a state bill designation \u2014 specify the state, e.g. "TX HB 1234".'],
  [{query:' ? ? ',state:' tx '},'Could not parse "? ?" as a state bill designation.'],
  [{billId:'?',query:billKey},'Could not parse "?" as a state bill designation \u2014 specify the state, e.g. "TX HB 1234".'],
 ]){const f=storedCase(status,{request});assert.equal((await result(f)).note,expected);assert.deepEqual(f.wire[0].body,request);}
 const f=storedCase(status,{request:{billId:' ',query:' TX HB 1234 '}});assert.equal((await result(f)).billId,billKey);
});

test('native stored and live-found designation keys are received without choosing or manufacturing a session',async()=>{
 for(const id of ids)for(const resolvedKey of ['tx-2024-hb1234','tx-2025x2-hb1234']){
  const f=storedCase(id,{request:{billId:'HB 1234',state:'TX'},resolvedKey}),out=await result(f);
  assert.equal(id===status?out.billId:out.votes[0].billKey,resolvedKey);assert.equal(f.wire.length,1);
 }
 for(const id of ids)for(const resolvedKey of ['fl-2025-hb1234','tx-2025-sb1234','tx-2025-hb1235']){
  const f=storedCase(id,{request:{billId:'TX HB 1234'},resolvedKey});await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('invalid supplied floor bill cannot broaden to stored rows or substitute another failure; designations stay key-bound',async()=>{
 for(const request of [{billId:'?',state:'TX'},{billId:'?'}]){
  const nativeOutcome='quota',f=storedCase(votes,{request,nativeOutcome}),base=f.page;
  for(const replacement of [
   storedCase(votes).page,{...base,note:note('NoStateVotesNote')},{...base,note:'No such bill exists'},
   {...base,note:base.note+' PRIVATE'},
  ]){f.state.page=replacement;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});}
 }
 const selected=storedCase(votes,{request:{billId:'TX HB 1234'}}),row=selected.page.votes[0];
 selected.state.page={...selected.page,votesFound:2,votes:[row,{...row,id:'other-session',billKey:'tx-2024-hb1234'}]};
 await assert.rejects(selected.handler()(selected.call()),{message:'INVALID_RESULT'});
});

test('resolved native empty status/votes stay separate from unresolved designation and retain actual caveats',async()=>{
 const absent=storedCase(status,{request:{billId:'TX HB 1234'},nativeOutcome:'absent'}),out=await result(absent);
 assert.equal(out.billId,billKey);assert.equal(out.found,false);assert.equal(out.note,`No bill ${billKey} on record in the Capiro database. Say so explicitly \u2014 do not describe its status from memory.`);
 const empty=storedCase(votes,{request:{billId:'TX HB 1234'},nativeOutcome:'empty'});assert.equal((await result(empty)).note,note('NoStateVotesNote'));
 for(const id of ids){const f=storedCase(id,{request:{billId:'TX HB 1234'},nativeOutcome:'provider-error'});
  f.state.resultMutator=p=>{p.found=false;p.billId=billKey;};await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});}
});

test('designation selection retains current exact actor/tenant/operation/source grants before credential factories',async()=>{
 for(const id of ids)for(const mutate of [a=>a.decision.decision='denied',a=>a.claims.actions=[],a=>a.decision.scopes=[],
  a=>a.binding.tenantId='other',a=>a.decision.actor.actorId='other',a=>a.sourceIds=[]]){
  const f=storedCase(id,{request:{billId:'TX HB 1234'}}),call=structuredClone(f.call()),{getCredentials,...configuration}=f.transport;let factories=0;mutate(call.authority);
  const [handler]=createStateStatusVotesHandlers({...configuration,now:f.now,credentialsForCall:()=>{factories++;return getCredentials;}},[f.operation]);
  await assert.rejects(handler.execute(call));assert.equal(factories,0);assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
 }
});

test('raw designation and retained hash/context cannot be replaced by a canonical request or model trust keys',async()=>{
 for(const id of ids){const f=storedCase(id,{request:{billId:'TX HB 1234'}}),original=f.call(),canonical=f.call({billId:billKey});
  for(const changes of [{input:canonical.input,argumentsSha256:canonical.argumentsSha256},{request:{billId:billKey}},
   {normalizationContext:{asOf:f.page.generatedAt}},{normalizationContext:{resolvedBillKey:billKey}},
   {request:{...f.arguments,noFetch:true}},{request:{...f.arguments,storedOnly:true}}])
   await assert.rejects(f.handler()({...original,...changes}),{message:'INVALID_ARGUMENTS'});
  assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
 }
});

test('native HTTP failure, denial, response limits, cancellation and timeout cannot synthesize or retry a result',async()=>{
 for(const id of ids)for(const status of [400,401,403,404,429,500]){
  const f=storedCase(id,{request:{billId:'TX HB 1234'}});f.state.responseFactory=()=>Response.json({error:'PRIVATE'},{status});
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
 }
 const f=storedCase(status,{request:{billId:'TX HB 1234'}});await assert.rejects(f.handler({getCredentials:async()=>{deny('ACCESS_DENIED');}})(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 const g=storedCase(status,{request:{billId:'TX HB 1234'}}),controller=new AbortController();g.state.afterSource=()=>controller.abort();
 await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
 const h=storedCase(status,{request:{billId:'TX HB 1234'}});h.state.afterSource=()=>h.state.now=h.authority.deadlineMs;await assert.rejects(h.handler()(h.call()),{message:'DEADLINE'});
 const small=storedCase(status,{request:{billId:'TX HB 1234'}});await assert.rejects(small.handler({maxResponseBytes:8})(small.call()),{message:'RESOURCE_LIMIT'});
});

test('fixture unresolved notes are literal native outcomes and no receiving branch rewrites malformed source bytes',async()=>{
 const f=storedCase(status,{request:{billId:'TX HB 1234'},nativeOutcome:'quota'}),raw=f.page.note;
 assert.equal(raw.includes('\u2019'),true);f.state.resultMutator=p=>p.note=p.note.replace('\u2019',"'");
 await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.state.nativeValue.note.includes("month's"),true);
 assert.equal(f.page.note,raw);assert.equal(f.wire.length,1);
 const missing=storedPage(status,{kind:'missing'},f.now());assert.equal(missing.note,note('MissingStateBillNote'));
});
