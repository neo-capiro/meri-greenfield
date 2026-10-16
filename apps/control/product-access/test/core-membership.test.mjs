/** SYNTHETIC fixed Core transport + actual membership/product HTTP owners. No real tokens, Core, DB, listener or provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createCoreMembershipGate} from '../core-membership.mjs';
import {createProductApplication} from '../http.mjs';
import {productFailure} from '../errors.mjs';
const ORIGIN='https://core.synthetic.invalid',PATH='/api/clio/application-authority/membership',NOW=1800000000000;
const CLIENT='00000000-0000-4000-8000-000000000001';
const code=(promise,expected)=>assert.rejects(promise,e=>productFailure(e)?.code===expected);
function fixture({maxFactBytes=262144}={}){
 const state={now:NOW,identities:[],requests:[],identityExpiry:NOW+100,identityError:false,status:'active',revision:'m1',respond:null};
 const principal=credential=>({tenantId:'tenant-'+credential,actorId:'actor-'+credential});
 const receipt=credential=>({...principal(credential),status:state.status,role:'standard_user',permissions:[],clientIds:[CLIENT],membershipRevision:state.revision,checkedAtMs:state.now,expiresAtMs:state.now+10000});
 const identityContext={async verifyIdentity(call){state.identities.push(call);if(state.identityError)throw Error('private upstream failure');return {principal:principal(call.credential),identityRevision:'i1',checkedAtMs:state.now,expiresAtMs:state.identityExpiry};}};
 const fetchImpl=async(url,options)=>{const call={url,options,credential:options.headers.authorization.slice(7)};state.requests.push(call);return state.respond?state.respond(call):Response.json(receipt(call.credential));};
 const configuration={origin:ORIGIN,identityContext,fetchImpl,now:()=>state.now,limits:{maxRequestMs:1000,maxFactBytes}};
 return {state,receipt,configuration,gate:createCoreMembershipGate(configuration)};
}
test('construction is inert; fixed request uses the current native bearer and original identity cutoff',async()=>{
 const f=fixture();assert.equal(f.state.requests.length,0);assert.equal(f.state.identities.length,0);
 const result=await f.gate.admit({credential:'A'}),call=f.state.requests[0];
 assert.equal(call.url,ORIGIN+PATH);assert.equal(call.options.method,'POST');assert.equal(call.options.body,'{}');
 assert.equal(call.options.headers.authorization,'Bearer A');assert.equal(call.options.headers['x-meri-deadline-at'],String(NOW+100));
 assert.equal(call.options.redirect,'error');assert.equal(call.options.credentials,'omit');assert.equal(call.options.cache,'no-store');
 assert.deepEqual(result.principal,{tenantId:'tenant-A',actorId:'actor-A',role:'standard_user',permissions:[],clientIds:[CLIENT],membershipRevision:'m1'});
 assert.equal(result.expiresAtMs,NOW+100);assert.equal(Object.isFrozen(result.principal),true);
});
test('overlapping admissions and later rechecks never exchange request credentials',async()=>{
 const f=fixture();const results=await Promise.all(['A','B'].map(credential=>f.gate.admit({credential})));
 await Promise.all(results.map((r,i)=>f.gate.recheck({principal:r.principal,credential:['A','B'][i],deadlineMs:r.expiresAtMs})));
 assert.deepEqual(f.state.identities.map(x=>x.credential),['A','B']);assert.equal(f.state.requests.length,4);
 for(const [i,call] of f.state.requests.entries())assert.equal(call.credential,['A','B'][i%2]);
 for(const r of results)assert.equal(Object.hasOwn(r.principal,'credential'),false);
});
test('same canonical identity owner must succeed before membership IO',async()=>{
 const f=fixture();f.state.identityError=true;await code(f.gate.admit({credential:'A'}),'CONVERSATION_UNAVAILABLE');assert.equal(f.state.requests.length,0);
 await code(f.gate.admit({credential:'A\r\nforged'}),'UNAUTHENTICATED');assert.equal(f.state.requests.length,0);
});
for(const [status,expected] of [[401,'UNAUTHENTICATED'],[403,'ACCESS_DENIED'],[409,'MEMBERSHIP_CHANGED'],[408,'DEADLINE'],[302,'CONVERSATION_UNAVAILABLE'],[404,'CONVERSATION_UNAVAILABLE'],[500,'CONVERSATION_UNAVAILABLE'],[503,'CONVERSATION_UNAVAILABLE']])
 test(`Core ${status} remains a content-free ${expected}`,async()=>{const f=fixture();f.state.respond=()=>Response.json({private:'upstream detail'},{status});await code(f.gate.admit({credential:'A'}),expected);});
test('canonical gate rejects a different tenant, actor, stale fact and extra fields',async()=>{
 for(const change of [{tenantId:'other'},{actorId:'other'},{checkedAtMs:NOW-1},{unexpected:true}]){
  const f=fixture();f.state.respond=()=>Response.json({...f.receipt('A'),...change});await code(f.gate.admit({credential:'A'}),'ACCESS_DENIED');
 }
});
test('revocation and client/role revision changes deny a previously admitted member',async()=>{
 const f=fixture(),access=await f.gate.admit({credential:'A'});
 f.state.status='removed';await code(f.gate.recheck({...access,credential:'A',deadlineMs:access.expiresAtMs}),'MEMBERSHIP_REVOKED');
 f.state.status='active';f.state.revision='m2';await code(f.gate.recheck({...access,credential:'A',deadlineMs:access.expiresAtMs}),'MEMBERSHIP_CHANGED');
 f.state.revision='m1';f.state.respond=()=>Response.json({...f.receipt('A'),clientIds:[]});await code(f.gate.recheck({...access,credential:'A',deadlineMs:access.expiresAtMs}),'MEMBERSHIP_CHANGED');
 f.state.respond=()=>Response.json({...f.receipt('A'),role:'user_admin'});await code(f.gate.recheck({...access,credential:'A',deadlineMs:access.expiresAtMs}),'MEMBERSHIP_CHANGED');
});
test('fresh receipts cannot extend the caller original cutoff; expiry performs no additional IO',async()=>{
 const f=fixture(),access=await f.gate.admit({credential:'A'});f.state.now=access.expiresAtMs-1;
 await f.gate.recheck({...access,credential:'A',deadlineMs:access.expiresAtMs});assert.equal(f.state.requests[1].options.headers['x-meri-deadline-at'],String(access.expiresAtMs));
 const count=f.state.requests.length;f.state.now=access.expiresAtMs;
 await code(f.gate.recheck({...access,credential:'A',deadlineMs:access.expiresAtMs}),'DEADLINE');assert.equal(f.state.requests.length,count);
});
test('body bounds, invalid UTF8/JSON, content length, encoding and media types fail closed',async()=>{
 for(const response of [()=>new Response('x'.repeat(513),{headers:{'content-type':'application/json'}}),
  ()=>new Response(new Uint8Array([255]),{headers:{'content-type':'application/json'}}),()=>new Response('{',{headers:{'content-type':'application/json'}}),
  ()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'3'}}),()=>new Response('{}',{headers:{'content-type':'application/json','content-encoding':'gzip'}}),
  ()=>new Response('{}',{headers:{'content-type':'text/plain'}})]){
  const f=fixture({maxFactBytes:512});f.state.respond=response;await code(f.gate.admit({credential:'A'}),'CONVERSATION_UNAVAILABLE');
 }
});
test('full canonical 4096-client roster is retained, with no truncation or permission synthesis',async()=>{
 const f=fixture(),clientIds=Array.from({length:4096},(_,i)=>'00000000-0000-4000-8000-'+i.toString(16).padStart(12,'0'));
 f.state.respond=()=>Response.json({...f.receipt('A'),clientIds});const access=await f.gate.admit({credential:'A'});
 assert.deepEqual(access.principal.clientIds,clientIds);assert.deepEqual(access.principal.permissions,[]);
 f.state.respond=()=>Response.json({...f.receipt('A'),clientIds:[...clientIds,'00000000-0000-4000-8000-000000001000']});await code(f.gate.admit({credential:'A'}),'ACCESS_DENIED');
});
test('failed status and late fetch settlement cancel the native response body',async()=>{
 const f=fixture();let cancelled=0;
 const response=status=>new Response(new ReadableStream({cancel(){cancelled++;}}),{status,headers:{'content-type':'application/json'}});
 f.state.respond=()=>response(503);await code(f.gate.admit({credential:'A'}),'CONVERSATION_UNAVAILABLE');assert.equal(cancelled,1);
 const pending=Promise.withResolvers(),entered=Promise.withResolvers(),controller=new AbortController();
 f.state.respond=()=>{entered.resolve();return pending.promise;};const admission=f.gate.admit({credential:'A',signal:controller.signal});
 await entered.promise;controller.abort();await code(admission,'CANCELLED');pending.resolve(response(200));
 // Let the late settled promise's cleanup finish; no deadline sleep or detached process.
 await new Promise(setImmediate);assert.equal(cancelled,2);
});
test('actual product request rechecks Core before effect and release, retaining original cutoff and acknowledged-effect outcome',async()=>{
 const f=fixture();let effects=0;
 const app=createProductApplication({gate:f.gate,now:()=>f.state.now,limits:{maxRequestMs:1000,maxRequestBytes:1024,maxResponseBytes:1024},routes:{'/api/synthetic/effect':{effect:true,handle:async call=>{
  assert.equal(Object.hasOwn(call,'credential'),false);await call.recheckMembership();effects++;f.state.status='removed';return {private:'withheld'};
 }}}});
 const r=await app.handle(new Request('https://meri.synthetic.invalid/api/synthetic/effect',{method:'POST',headers:{authorization:'Bearer A','content-type':'application/json'},body:'{}'}));
 assert.equal(effects,1);assert.equal(r.status,403);assert.deepEqual(await r.json(),{error:{code:'MEMBERSHIP_REVOKED',outcome:'RESULT_NOT_RELEASED'}});
 assert.equal(f.state.requests.length,3);assert.ok(f.state.requests.every(x=>x.credential==='A'&&x.options.headers['x-meri-deadline-at']===String(NOW+100)));
});
test('configuration rejects user URL components and active getters without IO',()=>{
 const f=fixture();for(const origin of ['http://core.synthetic.invalid',ORIGIN+'/',ORIGIN+'/other','https://user@core.synthetic.invalid',ORIGIN+'?scope=other'])
  assert.throws(()=>createCoreMembershipGate({...f.configuration,origin}),e=>productFailure(e)?.code==='PRODUCT_CONFIGURATION');
 let executed=0;assert.throws(()=>createCoreMembershipGate({...f.configuration,identityContext:{get verifyIdentity(){executed++;throw Error();}}}),e=>productFailure(e)?.code==='PRODUCT_CONFIGURATION');
 assert.throws(()=>createCoreMembershipGate({...f.configuration,origin:{toString(){executed++;return ORIGIN;}}}),e=>productFailure(e)?.code==='PRODUCT_CONFIGURATION');
 assert.equal(executed,0);assert.equal(f.state.requests.length,0);
});
