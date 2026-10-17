/** PARTIAL_INPUT stored-key adapter controls. Source-shaped JSON only; no Core/provider/quota execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createStateStatusVotesHandlers} from '../handler.mjs';
import {storedCase,ids,billKey,note} from './fixture.mjs';

for(const id of ids){
 test(`${id}: canonical stored-key fixed POST, original raw request and exact private carrier`,async()=>{
  const f=storedCase(id),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,{});
  assert.equal(Object.hasOwn(out.result,'complete'),false);assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);
 });
 test(`${id}: designation/invalid selectors and unsupported status omissions remain UNAVAILABLE before credentials/native work`,async()=>{
  const unsupported=[{billId:'TX HB 1234'},{billId:'HB 1234',state:'TX'},{billId:'FL HB 1234',state:'TX'},
   {billId:'71000000-0000-4000-8000-000000000091'},{billId:'tx-2025x-hb1234'},{billId:'not-a-bill'},
   ...(id==='get_state_bill_status'?[{billId:null},{billId:'   '},{},{state:'TX'},{query:'TX HB 1234',state:'TX'}]:[])];
  for(const request of unsupported){
   const f=storedCase(id,{request});await assert.rejects(f.handler()(f.call()),{message:'UNAVAILABLE'});
   assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: canonical case/dot/whitespace/special-session aliases preserve one native normalization pass`,async()=>{
  const request={billId:' T.X.- 2025X2-H.B.1234a ',state:' fl '},f=storedCase(id,{request}),out=JSON.parse(await f.handler()(f.call()));
  const selected='tx-2025x2-hb1234a';assert.deepEqual(f.wire[0].body,request);
  assert.equal(f.contract.normalizeInput(request,{}).metadata.selector.key,selected);
  assert.equal(id==='get_state_bill_status'?out.result.billId:out.result.votes[0].billKey,selected);
 });
 test(`${id}: effective trim/clip before canonical inspection matches the native parser`,async()=>{
  const request={billId:billKey+' '.repeat(70)+'TX HB 9'},f=storedCase(id,{request});
  const out=JSON.parse(await f.handler()(f.call()));assert.equal(f.wire[0].body.billId,request.billId);
  assert.equal(f.call().input.billId.length,60);assert.equal(id==='get_state_bill_status'?out.result.billId:out.result.votes[0].billKey,billKey);
  const g=storedCase(id,{request:{billId:'X'.repeat(60)+billKey}});await assert.rejects(g.handler()(g.call()),{message:'UNAVAILABLE'});assert.equal(g.credentialCalls.length,0);
 });
 test(`${id}: current actor, tenant, operation and source grants remain required before credentials`,async()=>{
  for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.binding.tenantId='other',
   a=>a.decision.actor.actorId='other',a=>a.decision.operation='other@0.2.0',a=>a.decision.decision='denied',
   a=>a.decision.scopes=[],a=>a.sourceIds=[]]){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));
   assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: argument authority, fake no-fetch options, context and digest substitution are invalid`,async()=>{
  const f=storedCase(id);
  for(const extra of [{tenantId:'other'},{actorId:'other'},{noFetch:true},{storedOnly:true},{sourceId:'other'}])
   await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,...extra}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),normalizationContext:{actorId:'other'}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
  const designation=f.call({billId:'TX HB 1234'}),canonical=f.call();
  await assert.rejects(f.handler()({...designation,input:canonical.input,argumentsSha256:canonical.argumentsSha256}),{message:'INVALID_ARGUMENTS'});
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: correlated credentials and both native secrets remain mandatory`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256',
   'normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=storedCase(id);f.state.credentialMutator=proof=>proof[key]=key==='expiresAtMs'?f.now():null;
   await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
  const f=storedCase(id);await assert.rejects(f.handler({getCredentials:undefined})(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
 });
 test(`${id}: original deadline, abort and response bounds withhold bytes`,async()=>{
  const f=storedCase(id);await assert.rejects(f.handler()({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.wire.length,0);
  const g=storedCase(id);g.state.now=g.authority.deadlineMs;await assert.rejects(g.handler()(g.call()),{message:'DEADLINE'});assert.equal(g.wire.length,0);
  const h=storedCase(id);await assert.rejects(h.handler({maxResponseBytes:16})(h.call()),{message:'RESOURCE_LIMIT'});
  const k=storedCase(id),controller=new AbortController();k.state.afterSource=()=>controller.abort();
  await assert.rejects(k.handler()({...k.call(),signal:controller.signal}),{message:'CANCELLED'});
 });
 test(`${id}: malformed native errors, new completeness fields and foreign selected keys cannot be released`,async()=>{
  for(const response of [()=>Response.json({error:'SYNTHETIC_PRIVATE'}),()=>Response.json({},{status:503}),
   page=>Response.json({...page,complete:true}),page=>Response.json({...page,tool:'other'})]){
   const f=storedCase(id);f.state.responseFactory=response;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
  const f=storedCase(id);f.state.resultMutator=page=>{if(id==='get_state_bill_status')page.billId='tx-2025-hb9999';else page.votes[0].billKey='tx-2025-hb9999';};
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 });
}

test('status canonical query fallback preserves billId precedence and never promotes a designation',async()=>{
 for(const request of [{query:' T.X.-2025-H.B.1234 '},{billId:null,query:billKey},{billId:' ',query:billKey},
  {billId:billKey,query:'TX HB 9',state:'FL'}]){
  const f=storedCase('get_state_bill_status',{request}),out=JSON.parse(await f.handler()(f.call()));
  assert.deepEqual(f.wire[0].body,request);assert.equal(out.result.billId,billKey);
 }
 const f=storedCase('get_state_bill_status',{request:{billId:'TX HB 9',query:billKey}});
 await assert.rejects(f.handler()(f.call()),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);
});

test('absent canonical stored bill preserves explicit database-scoped honesty and makes one request only',async()=>{
 const f=storedCase();f.state.page={tool:'get_state_bill_status',generatedAt:f.page.generatedAt,billId:billKey,found:false,
  note:`No bill ${billKey} on record in the Capiro database. Say so explicitly — do not describe its status from memory.`};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,f.state.page);assert.equal(f.wire.length,1);
 f.state.resultMutator=page=>page.note='No bill exists';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('status keeps no-vote/dead-session caveats and independent companion status facts',async()=>{
 const f=storedCase();f.state.page={...f.page,status:'dead_by_deadline',statusLabel:'Dead — session adjourned sine die',
  companions:[{relatedBillKey:'tx-2025-sb1',linkType:'companion',identifier:'SB 1',status:'enacted',statusLabel:'Enacted'},
   {relatedBillKey:'tx-2025-sb2',linkType:'related',identifier:null,status:null,statusLabel:null}],
  note:note('NoBillVotesNote')+' '+note('DeadStateBillNote')};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.votes.length,0);assert.equal(out.result.companions[0].status,'enacted');
 assert.equal(out.result.note,f.state.page.note);
 f.state.resultMutator=page=>page.note=note('DeadStateBillNote');await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('status nullable/negative stored vote facts and inherited-label omission survive JSON receiving',async()=>{
 const f=storedCase();f.state.page={...f.page,status:'constructor',votes:[{
  chamber:null,motion:null,date:null,yeas:-1,nays:0,nv:0,absent:0,passed:null,sourceUrl:null,
 }]};delete f.state.page.statusLabel;delete f.state.page.note;
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(Object.hasOwn(out.result,'statusLabel'),false);
 assert.equal(out.result.votes[0].passed,null);assert.equal(out.result.votes[0].yeas,-1);
 assert.equal(Object.hasOwn(out.result,'note'),false);
});

test('vote response preserves empty honesty, limit/chamber predicates and canonical SQL-date ordering',async()=>{
 const f=storedCase('search_state_floor_votes',{request:{billId:billKey,query:'pass',chamber:' LOWER ',limit:'1.9'}});
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.votesFound,1);assert.deepEqual(f.wire[0].body,f.arguments);assert.equal(f.call().input.limit,1);
 for(const mutate of [page=>page.votesFound=0,page=>page.votes[0].chamber='upper',page=>page.votes[0].motion=null,
  page=>page.votes.push({...page.votes[0],id:'other'}),page=>page.votes[0].date='2025-01-15T12:00:00.000Z']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 const g=storedCase('search_state_floor_votes');g.state.page={tool:g.operation.id,generatedAt:g.page.generatedAt,votesFound:0,votes:[],note:note('NoStateVotesNote')};
 assert.deepEqual(JSON.parse(await g.handler()(g.call())).result,g.state.page);assert.equal(g.wire.length,1);
});

test('native dates cross actual JSON bytes and no result bridge changes the stored projection',async()=>{
 const f=storedCase('search_state_floor_votes');f.state.resultMutator=page=>{
  page.generatedAt=new Date(f.now());page.votes[0].date=new Date('2025-01-15T00:00:00.000Z');
 };
 const out=JSON.parse(await f.handler()(f.call()));assert.ok(f.state.nativeValue.generatedAt instanceof Date);
 assert.equal(out.result.generatedAt,new Date(f.now()).toISOString());assert.equal(out.result.votes[0].date,'2025-01-15T00:00:00.000Z');
});

test('vote null dates precede descending dated rows and ascending source rows are refused',async()=>{
 const f=storedCase('search_state_floor_votes',{request:{billId:billKey,limit:3}}),base=f.page.votes[0];
 f.state.page={...f.page,votesFound:3,votes:[{...base,id:'null-date',date:null},
  {...base,id:'newer',date:'2025-01-16T00:00:00.000Z'},{...base,id:'older',date:'2025-01-15T00:00:00.000Z'}]};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.votes.map(row=>row.id),['null-date','newer','older']);
 f.state.resultMutator=page=>{[page.votes[1],page.votes[2]]=[page.votes[2],page.votes[1]];};
 await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('per-call credential composition cannot bypass the stored-selector effect boundary',async()=>{
 const f=storedCase(),{getCredentials,...configuration}=f.transport;
 const [handler]=createStateStatusVotesHandlers({...configuration,now:f.now,credentialsForCall:()=>getCredentials},[f.operation]);
 await assert.rejects(handler.execute(f.call({billId:'TX HB 1234'})),{message:'UNAVAILABLE'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);await handler.execute(f.call());assert.equal(f.wire.length,1);
});

test('constructor allows exactly two fixed read producers, no caller route or unsupported no-fetch configuration',()=>{
 const f=storedCase(),configuration={...f.transport,now:f.now};
 for(const operations of [[],[f.operation,f.operation],[{id:'search_state_bills',version:'0.2.0'}],
  [{id:'get_state_bill_status',version:'0.1.0'}]])assert.throws(()=>createStateStatusVotesHandlers(configuration,operations),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createStateStatusVotesHandlers({...configuration,origin:'https://native-core.example.invalid/other'},[f.operation]),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createStateStatusVotesHandlers({...configuration,noFetch:true},[f.operation]));assert.equal(f.wire.length,0);
});
