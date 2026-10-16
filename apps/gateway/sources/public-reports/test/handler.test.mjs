import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandlers,id as familyId,sourceDirectory} from '../../../general-reads/families/public-reports.mjs';
import {createPublicReportsHandlers} from '../handler.mjs';
import {setup,ids,NOW,stamp,nativeResult,noEstimate} from './fixture.mjs';

const json=value=>JSON.parse(JSON.stringify(value));
test('family composes exactly the three canonical operations without fetching',()=>{
 const f=setup();assert.equal(familyId,'public-reports');assert.equal(sourceDirectory,'public-reports');
 assert.deepEqual(f.handlers.map(h=>h.operation.id).sort(),[...ids].sort());
 assert.deepEqual(f.wire,[]);assert.deepEqual(f.proofs,[]);
 assert.throws(()=>createPublicReportsHandlers(f.config,[{id:'search_sec_filings',version:'0.2.0'}]),/GATEWAY_CONFIGURATION/);
});

for(const id of ids){
 test(`${id}: native POST JSON stays raw inside the exact private carrier`,async()=>{
  const request=id===ids[0]?{billId:' HR-1 ',congress:119,query:'  estimate  ',limit:1}:
   id===ids[1]?{query:'  oversight  ',reportType:' Report ',limit:1}:{query:' policy ',limit:1};
  const f=setup(id,request),page=await f.execute(),{url,options}=f.wire[0],proof=f.proofs[0];
  assert.equal(f.wire.length,1);assert.equal(url,`https://core.invalid/api/clio/tools/${id}`);
  assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),request);
  assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
  assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER_JWT');
  assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SECRET');
  assert.equal(options.headers['x-meri-deadline-at'],String(NOW+1000));
  assert.equal(options.headers['content-type'],'application/json');assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(Object.keys(page).sort(),['argumentsSha256','binding','operation','result','subject']);
  assert.deepEqual(page.result,json(nativeResult(id)));assert.deepEqual(page.binding,f.authority.binding);
  assert.deepEqual(page.subject,f.authority.subject);assert.deepEqual(page.operation,f.operation);
  assert.equal(page.argumentsSha256,f.normalized.argumentsSha256);assert.equal(proof.argumentsSha256,f.hash(f.normalized.input));
  assert.equal(proof.requestSha256,f.hash(request));assert.deepEqual(proof.input,f.normalized.input);
  assert.deepEqual(proof.normalizationContext,{});assert.equal(proof.origin,'https://core.invalid');
 });
 test(`${id}: defaults are canonical while the producer receives the original empty object`,async()=>{
  const f=setup(id);if(id===ids[0])f.state.page={tool:id,generatedAt:stamp,estimatesFound:0,estimates:[],note:noEstimate()};
  const page=await f.execute();assert.deepEqual(JSON.parse(f.wire[0].options.body),{});
  assert.equal(f.normalized.input.limit,id===ids[0]?10:20);assert.deepEqual(f.contract.binding.contextKeys,[]);
  assert.deepEqual(page.result,json(f.state.page??nativeResult(id)));
 });
 test(`${id}: missing credential owner remains unavailable with no Fetch`,async()=>{
  const f=setup(id,{}, {getCredentials:undefined});await assert.rejects(f.execute(),/UNAVAILABLE/);assert.equal(f.wire.length,0);
 });
 test(`${id}: unknown request keys and substituted effective input stop before credential acquisition`,async()=>{
  for(const change of [c=>{c.request.actorRole='capiro_admin';},c=>{c.request.clientId='forged';},
   c=>{c.request.endpoint='https://other.invalid';},c=>{c.input.limit=2;},c=>{c.argumentsSha256='0'.repeat(64);},
   c=>{c.normalizationContext.nowMs=NOW;}]){
   const f=setup(id),call=structuredClone(f.call);change(call);
   await assert.rejects(f.execute(call));assert.equal(f.proofs.length,0);assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: no alternate wrapper or added completeness assertion is accepted`,async()=>{
  for(const page of [{output:json(nativeResult(id))},{...json(nativeResult(id)),complete:true},
   {...json(nativeResult(id)),tool:ids.find(other=>other!==id)}]){
   const f=setup(id);f.state.page=page;await assert.rejects(f.execute(),/INVALID_RESULT/);assert.equal(f.wire.length,1);
  }
 });
}

test('CBO preserves original note labels, Unicode expansions and clipped whitespace on the wire',async()=>{
 for(const [billId,label,effective] of [[' HR-1 ','HR-1','hr-1'],['İ'.repeat(40),'İ'.repeat(40),'i\u0307'.repeat(40)],
  ['H'.repeat(39)+' X','H'.repeat(39)+' ','h'.repeat(39)]]){
  const f=setup(ids[0],{billId});f.state.page={tool:ids[0],generatedAt:stamp,estimatesFound:0,estimates:[],note:noEstimate(label)};
  const page=await f.execute();assert.equal(page.result.note,noEstimate(label));assert.equal(f.normalized.input.billId,effective);
  assert.deepEqual(JSON.parse(f.wire[0].options.body),{billId});assert.notEqual(f.proofs[0].requestSha256,f.proofs[0].argumentsSha256);
 }
 const f=setup(ids[0],{billId:'HR-1'});f.state.page={tool:ids[0],generatedAt:stamp,estimatesFound:0,estimates:[],note:noEstimate('hr-1')};
 await assert.rejects(f.execute(),/INVALID_RESULT/);
});
test('CBO zero Congress and blank strings keep native defaults without manufactured absence evidence',async()=>{
 const request={billId:'  ',query:'   ',congress:0},f=setup(ids[0],request);
 assert.deepEqual(f.normalized.input,{limit:10});f.state.page={tool:ids[0],generatedAt:stamp,estimatesFound:0,estimates:[],note:noEstimate()};
 const page=await f.execute();assert.deepEqual(JSON.parse(f.wire[0].options.body),request);
 assert.deepEqual(Object.keys(page.result).sort(),['estimates','estimatesFound','generatedAt','note','tool']);
});
test('GAO/CRS keep original cap-boundary strings for exactly one native normalization',async()=>{
 for(const id of ids.slice(1)){
  const request={query:'q'.repeat(239)+' suffix',...(id===ids[1]?{reportType:'R'.repeat(59)+' suffix'}:{})};
  const f=setup(id,request);if(id===ids[1])f.state.page={...nativeResult(id),data:[{...nativeResult(id).data[0],reportType:'R'.repeat(59)+' '}]};
  await f.execute();assert.equal(f.normalized.input.query,'q'.repeat(239)+' ');
  assert.deepEqual(JSON.parse(f.wire[0].options.body),request);
 }
});
test('CBO exact filters, counts and required absence disclosures cannot drift',async()=>{
 for(const change of [p=>{p.estimatesFound=2;},p=>{p.estimates[0].billId='hr-2';},p=>{p.estimates[0].congress=118;},
  p=>{p.estimates[0].cost=0;},p=>{p.estimates=[];p.estimatesFound=0;},
  p=>{p.note=noEstimate('HR-1');}]){
  const f=setup(ids[0],{billId:'HR-1',congress:119});const page=json(nativeResult(ids[0]));change(page);f.state.page=page;
  await assert.rejects(f.execute(),/INVALID_RESULT/);
 }
});
test('stored dates serialize via JSON and invalid dates/order/duplicate IDs or raw oversized excerpts fail',async()=>{
 for(const [id,change] of [[ids[0],p=>{p.estimates[0].pubDate='2026-10-10';}],
  [ids[1],p=>{p.data[0].publishDate='2026-10-10T12:30:00.000Z';}],
  [ids[1],p=>{p.data[0].title='x'.repeat(241);}], [ids[2],p=>{p.data[0].summary=' not normalized ';}],
  [ids[2],p=>{p.data.push({...p.data[0]});}],
  [ids[2],p=>{p.data.push({...p.data[0],id:'newer',date:'2026-10-11T00:00:00.000Z'});}]]){
  const f=setup(id);f.state.page=json(nativeResult(id));change(f.state.page);await assert.rejects(f.execute(),/INVALID_RESULT/);
 }
});
test('GAO exact reportType and request limits are checked without treating separate totals as snapshot counts',async()=>{
 const f=setup(ids[1],{reportType:'Report',limit:1});const result=await f.execute();assert.equal(result.result.total,0);assert.equal(result.result.data.length,1);
 const wrong=setup(ids[1],{reportType:'Other'});await assert.rejects(wrong.execute(),/INVALID_RESULT/);
 for(const id of ids){const g=setup(id,{limit:1});g.state.page=json(nativeResult(id));
  const key=id===ids[0]?'estimates':'data';g.state.page[key].push({...g.state.page[key][0],id:'synthetic-second'});
  if(id===ids[0])g.state.page.estimatesFound=2;await assert.rejects(g.execute(),/INVALID_RESULT/);}
});

test('closed source configuration refuses delegated transport, endpoint overrides and unowned context',()=>{
 const f=setup();for(const change of [{delegatedTransport:{read(){throw Error('must not run');}}},{paths:{}},{normalizationContext:{}},
  {actorRole:'capiro_admin'},{origin:'http://core.invalid'},{maxRequestMs:0},{maxResponseBytes:0},{now:0}])
  assert.throws(()=>createHandlers({...f.config,...change}));
});
test('credential receipt must contain the additional service secret and exact current request proof',async()=>{
 for(const mutate of [c=>{delete c.serviceSecret;},c=>{c.serviceSecret='bad\nsecret';},c=>{c.bearerToken='bad\nuser';},
  c=>{c.expiresAtMs=NOW;},c=>{c.binding.actorId='other';},c=>{c.subject.actorId='other';},
  c=>{c.operation.id=ids[2];},c=>{c.requestSha256='f'.repeat(64);},c=>{c.argumentsSha256='f'.repeat(64);},
  c=>{c.normalizationContext={actorRole:'capiro_admin'};},c=>{c.origin='https://other.invalid';}]){
  const f=setup(),config={...f.config,getCredentials:async pins=>{const value=structuredClone(f.credential(pins));mutate(value);return value;}};
  const handler=createHandlers(config).find(h=>h.operation.id===ids[0]);await assert.rejects(handler.execute(f.call));assert.equal(f.wire.length,0);
 }
});
test('native guard/producer failures never fall back or release their body',async()=>{
 for(const status of [401,403,404,500,503]){
  let calls=0;const f=setup(ids[1],{}, {fetchImpl:async()=>{calls++;return new Response('SYNTHETIC_PRIVATE_DETAIL',{status});}});
  await assert.rejects(f.execute(),error=>error.message==='INVALID_RESULT');assert.equal(calls,1);
 }
});
test('response bytes are bounded by both source configuration and capability output budget',async()=>{
 for(const useClaim of [false,true]){
  const f=setup(ids[1],{},useClaim?{}:{maxResponseBytes:20});const call=structuredClone(f.call);
  if(useClaim)call.authority.claims.budgets.maxOutputBytes=20;
  await assert.rejects(f.execute(call),/RESOURCE_LIMIT/);
 }
});
test('expired or cancelled calls do not acquire credentials, and time elapsed during Fetch cannot release',async()=>{
 for(const stage of ['expired','cancelled','fetch']){
  const f=setup(ids[1]);let call=f.call;
  if(stage==='expired')f.state.now=NOW+10001;
  if(stage==='cancelled'){const controller=new AbortController();controller.abort();call={...call,signal:controller.signal};}
  if(stage==='fetch'){
   const config={...f.config,fetchImpl:async()=>{f.state.now=NOW+10001;return new Response(JSON.stringify(nativeResult(ids[1])),{headers:{'content-type':'application/json'}});}};
   const handler=createHandlers(config).find(h=>h.operation.id===ids[1]);await assert.rejects(handler.execute(call),/DEADLINE/);
  }else{await assert.rejects(f.execute(call),stage==='expired'?/DEADLINE/:/CANCELLED/);assert.equal(f.proofs.length,0);assert.equal(f.wire.length,0);}
 }
});
for(const stage of ['credentials','fetch','body'])test(`parked ${stage} cancels within the caller lifetime with no later stage`,async()=>{
 const entered=Promise.withResolvers(),pending=Promise.withResolvers(),controller=new AbortController();let fetches=0,cancelled=0;
 const f=setup(ids[1]);const config={...f.config};
 if(stage==='credentials')config.getCredentials=()=>{entered.resolve();return pending.promise;};
 if(stage==='fetch')config.fetchImpl=()=>{fetches++;entered.resolve();return pending.promise;};
 if(stage==='body')config.fetchImpl=async()=>{fetches++;return new Response(new ReadableStream({pull(){entered.resolve();return pending.promise;},cancel(){cancelled++;}},
  {highWaterMark:0}),{headers:{'content-type':'application/json'}});};
 const handler=createHandlers(config).find(h=>h.operation.id===ids[1]);const execution=handler.execute({...f.call,signal:controller.signal});
 await entered.promise;controller.abort();await assert.rejects(execution,/CANCELLED/);
 pending.resolve(stage==='credentials'?f.credential(f.proofs[0]??{}):stage==='fetch'?
  new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}}):undefined);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(fetches,stage==='credentials'?0:1);
 if(stage!=='credentials')assert.equal(cancelled,1);
});
