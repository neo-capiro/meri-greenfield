import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreRetentionClient} from '../core-client.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const subject={tenantId:id(1),kind:'artifact',subjectId:id(2),ownerActorId:id(3)};
const scope={tenantId:id(1),subject:{kind:'artifact',id:id(2)}};
const read=()=>({version:'meri.office-draft-retention.v2',...scope,drafts:3,active:2,bytes:12,fenced:false});
const retired=()=>({version:'meri.office-draft-retention.v2',...scope,retired:2,remaining:false,fenced:true});
function fixture(reply=read(),options={}){
 const calls=[],office=createCoreRetentionClient({origin:'https://core.invalid',getServiceSecret:async()=> 'synthetic-private-service-secret',
  fetchImpl:async(url,request)=>{calls.push({url,request});return Response.json(reply);},...options}).office;
 return {office,calls};
}
test('Office inventory and retirement use fixed current Core scope and existing service authentication',async()=>{
 for(const [operation,response] of [['read',read()],['retire',retired()]]){
  const f=fixture(response);assert.deepEqual(await f.office[operation](subject),response);
  assert.equal(f.calls.length,1);const {url,request}=f.calls[0];
  assert.equal(url,'https://core.invalid/api/internal/office-draft-retention/'+operation);
  assert.deepEqual(JSON.parse(request.body),scope);assert.equal(request.headers.authorization,undefined);
  assert.equal(request.headers['x-internal-service-secret'],'synthetic-private-service-secret');
  assert.equal(request.redirect,'error');assert.equal(request.credentials,'omit');
 }
 const response={...read(),subject:{kind:'conversation',id:id(2)}};
 assert.deepEqual(await fixture(response).office.read({...subject,kind:'conversation'}),response);
});
test('Office receiver refuses wrong identity, widened metadata and impossible counts',async()=>{
 for(const patch of [{version:'old'},{tenantId:id(8)},{subject:{kind:'artifact',id:id(8)}},
  {subject:{kind:'artifact',id:id(2),actorId:id(3)}},{bytesBase64:'private'},
  {drafts:-1},{active:4},{active:0},{bytes:1.2},{bytes:Number.MAX_SAFE_INTEGER+1},{drafts:'3'}])
  await assert.rejects(fixture({...read(),...patch}).office.read(subject));
 for(const patch of [{retired:101},{retired:-1},{retired:0.5},{remaining:'false'},{bytes:0}])
  await assert.rejects(fixture({...retired(),...patch}).office.retire(subject));
 const f=fixture();for(const patch of [{tenantId:'*'},{kind:'tenant'},{subjectId:'*'},{force:true}])
  await assert.rejects(f.office.retire({...subject,...patch}));
 assert.equal(f.calls.length,0);
});
test('partial batches remain incomplete and readback always observes current Core state',async()=>{
 const replies=[{...retired(),retired:100,remaining:true},{...read(),drafts:102,active:2,bytes:12},
  {...retired(),retired:2},{...read(),drafts:102,active:0,bytes:0},read()];let calls=0;
 const f=fixture(null,{fetchImpl:async()=>{calls++;return Response.json(replies.shift());}});
 assert.equal((await f.office.retire(subject)).remaining,true);
 assert.equal((await f.office.read(subject)).active,2);
 assert.equal((await f.office.retire(subject)).remaining,false);
 assert.equal((await f.office.read(subject)).active,0);
 assert.equal((await f.office.read(subject)).active,2);assert.equal(calls,5);
});
test('zero counts prove disposal only with the current durable Core fence',async()=>{
 for(const fenced of [false,true]){
  const f=fixture({...read(),drafts:0,active:0,bytes:0,fenced});
  assert.equal(await f.office.verify(subject),fenced);
 }
 await assert.rejects(fixture({...retired(),fenced:false}).office.retire(subject));
 await assert.rejects(fixture({...read(),fenced:'true'}).office.read(subject));
});
test('unknown retirement is never replayed and missing, denied or oversized replies cannot claim erasure',async()=>{
 for(const make of [()=>Response.json({}, {status:403}),()=>Response.json({}, {status:404}),
  ()=>new Response('{}',{status:302}),()=>new Response('x'.repeat(16385),{headers:{'content-type':'application/json'}}),
  ()=>{throw Error('lost response');}]){
  let calls=0;const f=fixture(null,{fetchImpl:async()=>{calls++;return make();}});
  await assert.rejects(f.office.retire(subject));assert.equal(calls,1);
 }
});
test('Office read and retire share cancellation, bounded body waits and response cleanup',async()=>{
 for(const operation of ['read','retire']){
  let cancelled=false;
  const f=fixture(null,{maxRequestMs:20,fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),
   {headers:{'content-type':'application/json'}})});
  await assert.rejects(f.office[operation](subject),/RETENTION_AUTHORITY_UNAVAILABLE/);assert.equal(cancelled,true);
  const abort=new AbortController();abort.abort();const g=fixture();
  await assert.rejects(g.office[operation](subject,{signal:abort.signal}));assert.equal(g.calls.length,0);
 }
});
