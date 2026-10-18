/** SYNTHETIC: the Core memory transport over a scripted Fetch; no network or Core. */
import test from 'node:test';import assert from 'node:assert/strict';
import {productFailure} from '../../product-access/errors.mjs';
import {CORE_MEMORY_ROUTES,CORE_MEMORY_DECISION_ROUTES,createCoreMemoryTransport} from '../core-http.mjs';
import {NOW,id} from './fixtures.mjs';
const json=(value,init={})=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'},...init});
function setup({reply=()=>json({ok:true}),credentials}={}){
 const seen=[];
 const transport=createCoreMemoryTransport({origin:'https://core.example',now:()=>NOW,
  getCredentials:async v=>{seen.push({credentials:v});return credentials??{tenantId:v.tenantId,actorId:v.actorId,bearerToken:'synthetic-token',serviceSecret:'synthetic-secret',expiresAtMs:NOW+5000};},
  fetchImpl:async(url,init)=>{seen.push({url,init});return reply(url,init);}});
 return {transport,seen};
}
const call=(t,route='status')=>t.transport.call(route,{tenantId:'t1',actorId:'a1',body:{candidates:[]},deadlineMs:NOW+3000},'MEMORY_REVIEW_UNAVAILABLE');
test('fixed HTTPS route, purpose-bound credentials, no redirects or ambient credentials',async()=>{
 const t=setup();assert.deepEqual(await call(t),{ok:true});
 const [{credentials},{url,init}]=t.seen;
 assert.deepEqual({tenantId:credentials.tenantId,actorId:credentials.actorId,purpose:credentials.purpose},{tenantId:'t1',actorId:'a1',purpose:'memory.status'});
 assert.equal(url,`https://core.example${CORE_MEMORY_ROUTES.status}`);assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.method,'POST');
 assert.equal(init.headers.authorization,'Bearer synthetic-token');assert.equal(init.headers['x-internal-service-secret'],'synthetic-secret');
 await assert.rejects(t.transport.call('approve',{tenantId:'t1',actorId:'a1',body:{}},'X'),e=>productFailure(e)?.code==='PRODUCT_CONFIGURATION');
});
test('credentials for another identity, non-200, wrong media type and oversize answers refuse with the caller code',async()=>{
 const refused=async t=>assert.rejects(call(t),e=>productFailure(e)?.code==='MEMORY_REVIEW_UNAVAILABLE');
 await refused(setup({credentials:{tenantId:'t2',actorId:'a1',bearerToken:'x',serviceSecret:'y',expiresAtMs:NOW+5000}}));
 await refused(setup({reply:()=>json({},{status:500})}));
 await refused(setup({reply:()=>new Response('{}',{status:200,headers:{'content-type':'text/plain'}})}));
 await refused(setup({reply:()=>json({pad:'x'.repeat(300000)})}));
 assert.throws(()=>createCoreMemoryTransport({origin:'http://core.example',getCredentials:()=>{},now:()=>NOW}),e=>productFailure(e)?.code==='PRODUCT_CONFIGURATION');
 // A bearer that is the service secret never leaves (the reads broker's credential invariant).
 await refused(setup({credentials:{tenantId:'t1',actorId:'a1',bearerToken:'same',serviceSecret:'same',expiresAtMs:NOW+5000}}));
});
test('decision routes substitute the candidate id and carry the bearer only; definite statuses map to the typed refusal, 503 stays the caller failure',async()=>{
 const t=setup({reply:()=>json({ok:true})});
 await t.transport.call('versionApprove',{tenantId:'t1',actorId:'a1',id:id(5),body:{},deadlineMs:NOW+3000},'MEMORY_DECISION_UNCERTAIN',{409:'MEMORY_DECISION_CONFLICT'});
 const [{credentials},{url,init}]=t.seen;
 assert.equal(credentials.purpose,'memory.versionApprove');assert.equal(url,`https://core.example${CORE_MEMORY_DECISION_ROUTES.versionApprove.replace('{id}',id(5))}`);
 assert.equal(init.headers.authorization,'Bearer synthetic-token');assert.equal('x-internal-service-secret' in init.headers,false);
 const fail=(reply,route,input,failure,refused)=>setup({reply}).transport.call(route,{tenantId:'t1',actorId:'a1',body:{},deadlineMs:NOW+3000,...input},failure,refused).then(()=>'resolved',e=>productFailure(e)?.code);
 assert.equal(await fail(()=>json({},{status:409}),'submit',{},'MEMORY_REVIEW_UNCERTAIN',{409:'MEMORY_SUBMISSION_REFUSED'}),'MEMORY_SUBMISSION_REFUSED');
 assert.equal(await fail(()=>json({},{status:503}),'submit',{},'MEMORY_REVIEW_UNCERTAIN',{409:'MEMORY_SUBMISSION_REFUSED'}),'MEMORY_REVIEW_UNCERTAIN');
 assert.equal(await fail(()=>json({},{status:409}),'submit',{},'MEMORY_REVIEW_UNCERTAIN'),'MEMORY_REVIEW_UNCERTAIN');
 assert.equal(await fail(()=>json({},{status:404}),'ownerDecision',{id:id(6)},'MEMORY_DECISION_UNCERTAIN',{404:'MEMORY_DECISION_NOT_FOUND'}),'MEMORY_DECISION_NOT_FOUND');
 // Fixed routes take no id; decision routes need a UUID; refusal maps are closed to 4xx/5xx statuses and typed codes.
 assert.equal(await fail(()=>json({}),'status',{id:id(1)},'X'),'PRODUCT_CONFIGURATION');
 assert.equal(await fail(()=>json({}),'ownerDecision',{id:'not-a-uuid'},'X'),'PRODUCT_CONFIGURATION');
 assert.equal(await fail(()=>json({}),'ownerDecision',{id:id(1)},'X',{200:'OK_CODE'}),'PRODUCT_CONFIGURATION');
 assert.equal(await fail(()=>json({}),'ownerDecision',{id:id(1)},'lower'),'PRODUCT_CONFIGURATION');
});
