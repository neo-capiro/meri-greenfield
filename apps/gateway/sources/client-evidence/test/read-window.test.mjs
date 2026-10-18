import test from 'node:test';
import assert from 'node:assert/strict';
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createClientEvidenceHttpAdapter} from '../http-adapter.mjs';
import {createClientEvidenceReadHandler} from '../handler.mjs';
import {readContext,assertClientEvidenceResult} from '../request-context.mjs';
import {clientEvidenceFixture,credentialReceipt,NOW,asOf,operations,sha} from './fixtures.mjs';

const iso=offset=>new Date(NOW+offset).toISOString();
function observed(page,startedAt,completedAt) {
 page.readWindow={startedAt:iso(startedAt),completedAt:iso(completedAt)};
 page.generatedAt=page.readWindow.completedAt;
 return page;
}
function setup() {
 const f=clientEvidenceFixture(operations.profile,{clientId:'Synthetic named client',section:'people'}),
  state={now:NOW},wire=[],pins=[],endpoint='https://client-evidence.example.invalid/api/clio/tools/get_client_context';
 const config={endpoints:{get_client_context:endpoint},now:()=>state.now,maxRequestMs:10000,maxResponseBytes:65536,
  getCredentials:async request=>{pins.push(request);return {...credentialReceipt(request),authorizationScheme:'CapiroMeriRead'};},
  fetchImpl:async(url,options)=>{wire.push({url,options});return new Response(JSON.stringify(f.page),{headers:{'content-type':'application/json'}});}};
 const call={...f.call,invocationId:'synthetic_read_window'};
 const adapter=(changes={})=>createClientEvidenceHttpAdapter({...config,...changes});
 const execute=(changes={})=>createClientEvidenceReadHandler({operation:f.operation,adapter:adapter(changes),now:()=>state.now});
 const {argumentsSha256,...sourceCall}=call;
 return {...f,state,wire,pins,config,call,sourceCall:{operation:f.operation,...sourceCall},adapter,execute};
}

test('signed profile accepts an asynchronous owner read and preserves admission and exact request pins',async()=>{
 const f=setup();observed(f.page,25,900);
 const output=JSON.parse(await f.execute({fetchImpl:async(url,options)=>{
  f.wire.push({url,options});f.state.now=NOW+1000;
  return new Response(JSON.stringify(f.page),{headers:{'content-type':'application/json'}});
 }})(f.call));
 assert.deepEqual(output.result,f.page);assert.equal(output.result.generatedAt,iso(900));
 assert.deepEqual(output.result.readWindow,{startedAt:iso(25),completedAt:iso(900)});
 assert.equal(f.pins[0].normalizationContext.asOf,asOf);
 assert.equal(f.pins[0].argumentsSha256,f.call.argumentsSha256);
 assert.equal(f.pins[0].requestSha256,canonicalSha256({input:f.input,metadata:f.metadata}));
 assert.equal(f.pins[0].target.bodySha256,sha(f.wire[0].options.body));
 assert.equal(f.wire[0].options.body,JSON.stringify({input:f.input,metadata:f.metadata}));
 assert.equal(f.wire[0].options.headers['x-meri-deadline-at'],String(NOW+5000));
 const correlation=Buffer.from(f.wire[0].options.headers['x-meri-read-correlation'],'base64url').toString('utf8');
 assert.equal(correlation,canonicalize({binding:f.authority.binding,subject:f.authority.subject,
  policyRevision:f.authority.policyRevision,normalizationContext:f.normalizationContext}));
 assert.deepEqual(output.binding,f.authority.binding);assert.deepEqual(output.subject,f.authority.subject);
 assert.equal(output.result.context.client.id,f.input.clientId);
});

test('profile owner timestamps accept the inclusive five second admission and response skew bounds',async()=>{
 const f=setup();observed(f.page,-5000,5000);
 assert.deepEqual(JSON.parse(await f.execute()(f.call)).result.readWindow,f.page.readWindow);
});

for(const [label,mutate] of [
 ['a read begun before this admission allowance',p=>observed(p,-5001,0)],
 ['a completion beyond the response allowance',p=>observed(p,0,5001)],
 ['an absent owner window',p=>delete p.readWindow],
 ['a reversed owner window',p=>observed(p,1,0)],
 ['a completion timestamp differing from generatedAt',p=>p.readWindow.completedAt=iso(1)]
])test(`profile source refuses ${label}`,async()=>{
 const f=setup();mutate(f.page);
 await assert.rejects(f.adapter().read(f.sourceCall),/INVALID_RESULT/);
 await assert.rejects(f.execute()(f.call),/INVALID_RESULT/);
});

test('profile response receipt is fixed at headers before streamed body time can widen the allowance',async()=>{
 const f=setup();observed(f.page,0,5001);
 const bytes=new TextEncoder().encode(JSON.stringify(f.page));
 await assert.rejects(f.execute({fetchImpl:async()=>new Response(new ReadableStream({
  pull(controller){f.state.now=NOW+1000;controller.enqueue(bytes);controller.close();}
 },{highWaterMark:0}),{headers:{'content-type':'application/json'}})})(f.call),/INVALID_RESULT/);
 assert.equal(f.state.now,NOW+1000);
});

test('profile completion also obeys the effective token or request deadline with inclusive skew',()=>{
 for(const deadlineMs of [NOW+100,NOW+500]) {
  const f=setup(),context=readContext(f.sourceCall,()=>NOW);
  observed(f.page,0,deadlineMs-NOW+5000);
  assert.equal(assertClientEvidenceResult(f.page,context,{receivedAtMs:NOW+1000,deadlineMs}),f.page);
  f.page.generatedAt=f.page.readWindow.completedAt=iso(deadlineMs-NOW+5001);
  assert.throws(()=>assertClientEvidenceResult(f.page,context,{receivedAtMs:NOW+1000,deadlineMs}),/INVALID_RESULT/);
 }
 const f=setup(),context=readContext(f.sourceCall,()=>NOW);
 observed(f.page,0,15001);
 assert.throws(()=>assertClientEvidenceResult(f.page,context,{receivedAtMs:NOW+11000,deadlineMs:NOW+20000}),/INVALID_RESULT/);
});

test('profile body reading still stops at the short lived token deadline despite a valid owner window',async()=>{
 const f=setup(),bytes=new TextEncoder().encode(JSON.stringify(f.page));let cancelled=false;
 await assert.rejects(f.execute({getCredentials:async request=>({...credentialReceipt(request),
  authorizationScheme:'CapiroMeriRead',expiresAtMs:NOW+100}),fetchImpl:async()=>new Response(new ReadableStream({
   pull(controller){f.state.now=NOW+101;controller.enqueue(bytes);},cancel(){cancelled=true;}
  },{highWaterMark:0}),{headers:{'content-type':'application/json'}})})(f.call),/DEADLINE/);
 assert.equal(cancelled,true);
});

test('profile handler enforces admission and receipt bounds for a non HTTP adapter',async()=>{
 for(const [startedAt,completedAt] of [[-5001,0],[0,5001]]) {
  const f=setup();observed(f.page,startedAt,completedAt);
  const execute=createClientEvidenceReadHandler({operation:f.operation,adapter:{async read(){return f.page;}},now:()=>NOW});
  await assert.rejects(execute(f.call),/INVALID_RESULT/);
 }
});
