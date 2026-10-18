/** Actual native-membership HTTP adapter + settings service + public Fetch application; identity/Core/store boundaries are synthetic. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,CLIENT} from './fixture.mjs';
import {createUserPreferencesApplication} from '../index.mjs';
import {createUserPreferencesFeature} from '../feature.mjs';
import {userPreferencesUnavailable} from '../protocol.mjs';

test('native membership user flow reads defaults, saves full canonical preferences, reloads and refuses a stale revision',async()=>{
 const f=fixture(),initial=await f.call('read');assert.equal(initial.status,200);assert.equal(initial.headers.get('cache-control'),'no-store');
 assert.deepEqual(await initial.json(),{owner:f.identity('A'),revision:0,preferences:f.preferences});
 const preferences={...f.preferences,theme:'dark',density:'compact',timezone:'UTC',defaultClientId:CLIENT};
 const saved=await f.call('save',{expectedRevision:0,preferences});assert.equal(saved.status,200);
 assert.deepEqual(await saved.json(),{owner:f.identity('A'),revision:1,preferences});
 assert.deepEqual(await (await f.call('read')).json(),{owner:f.identity('A'),revision:1,preferences});
 const conflict=await f.call('save',{expectedRevision:0,preferences:{...preferences,theme:'light'}});assert.equal(conflict.status,409);
 assert.deepEqual(await conflict.json(),{error:{code:'SETTINGS_REVISION_CONFLICT'}});assert.equal(f.persistence.audit.length,1);
 assert.ok(f.state.requests.every(({url,options})=>url==='https://core.synthetic.invalid/api/clio/application-authority/membership'&&options.body==='{}'&&options.redirect==='error'&&options.cache==='no-store'&&options.headers.authorization==='Bearer A'));
});

test('the owner comes only from current membership and another native actor reads an independent document',async()=>{
 const f=fixture();await f.call('save',{expectedRevision:0,preferences:{...f.preferences,theme:'dark'}});
 assert.deepEqual(await (await f.call('read',{},'B')).json(),{owner:f.identity('B'),revision:0,preferences:f.preferences});
 for(const body of [{owner:f.identity('B'),expectedRevision:1,preferences:f.preferences},{tenantId:'other',expectedRevision:1,preferences:f.preferences}]){
  const denied=await f.call('save',body);assert.equal(denied.status,400);
 }
 const client=await f.call('save',{expectedRevision:1,preferences:{...f.preferences,defaultClientId:'00000000-0000-4000-8000-000000000002'}});
 assert.equal(client.status,403);assert.deepEqual(await client.json(),{error:{code:'SETTINGS_CLIENT_REFUSED'}});assert.equal(f.persistence.audit.length,1);
});

test('membership is fresh immediately before persistence and before release; acknowledged saves retain known outcome',async()=>{
 const f=fixture();f.state.afterMembership=()=>{f.state.status='removed';f.state.afterMembership=null;};
 const before=await f.call('save',{expectedRevision:0,preferences:f.preferences});assert.equal(before.status,403);
 assert.deepEqual(await before.json(),{error:{code:'MEMBERSHIP_REVOKED'}});assert.equal(f.state.writes,0);
 f.state.status='active';f.state.afterSave=()=>{f.state.status='removed';};
 const after=await f.call('save',{expectedRevision:0,preferences:f.preferences});assert.equal(after.status,403);
 assert.deepEqual(await after.json(),{error:{code:'MEMBERSHIP_REVOKED',outcome:'RESULT_NOT_RELEASED'}});assert.equal(f.persistence.audit.length,1);
});

test('invalid documents, routes and canceled requests perform no preference mutation',async()=>{
 const f=fixture();for(const preferences of [{...f.preferences,theme:'surprise'},{...f.preferences,timezone:'not/a/timezone'},{...f.preferences,extra:true}]){
  assert.equal((await f.call('save',{expectedRevision:0,preferences})).status,400);
 }
 assert.equal((await f.call('tenant/read')).status,404);
 assert.equal((await f.call('read?tenant=other')).status,404);
 assert.equal((await f.call('read',{},'invalid')).status,502);
 assert.equal((await f.call('read',{},'A',{method:'PUT'})).status,405);
 const abort=new AbortController();abort.abort();assert.equal((await f.call('save',{expectedRevision:0,preferences:f.preferences},'A',{signal:abort.signal})).status,408);
 assert.equal(f.state.writes,0);
});

test('bounded response and malformed acknowledged records never release private values or claim a rolled-back save',async()=>{
 const f=fixture({maxResponseBytes:32});const response=await f.call('save',{expectedRevision:0,preferences:f.preferences});
 assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:{code:'PRODUCT_UNAVAILABLE',outcome:'RESULT_NOT_RELEASED'}});
 const broken=fixture();const application=createUserPreferencesApplication({gate:broken.gate,service:{readUser:broken.service.readUser,saveUser:async()=>({revision:1,preferences:{private:'do not disclose'}})},now:()=>broken.state.now,limits:{maxRequestMs:1000,maxRequestBytes:8192,maxResponseBytes:16384}});
 const bad=await application.handle(new Request('https://meri.synthetic.invalid/api/settings/user/save',{method:'POST',headers:{authorization:'Bearer A','content-type':'application/json'},body:JSON.stringify({expectedRevision:0,preferences:broken.preferences})}));
 assert.equal(bad.status,500);assert.deepEqual(await bad.json(),{error:{code:'SETTINGS_STORE_STATE',outcome:'RESULT_NOT_RELEASED'}});
});

test('disabled feature is inert; unavailable response is explicit; active accessors and invalid limits are refused unread',()=>{
 let calls=0;const gate={get admit(){calls++;throw Error('must not execute');},get recheck(){calls++;throw Error('must not execute');}};
 assert.equal(createUserPreferencesFeature({enabled:false,gate,pool:{connect(){calls++;throw Error('must not connect');}}}),null);
 const response=userPreferencesUnavailable();assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
 const f=fixture();assert.throws(()=>createUserPreferencesApplication({gate,service:f.service,now:()=>f.state.now,limits:{maxRequestMs:1000,maxRequestBytes:8192,maxResponseBytes:16384}}));
 assert.throws(()=>createUserPreferencesApplication({gate:f.gate,service:f.service,now:()=>f.state.now,limits:{maxRequestMs:10001,maxRequestBytes:8192,maxResponseBytes:16384}}));
 assert.equal(calls,0);
});
