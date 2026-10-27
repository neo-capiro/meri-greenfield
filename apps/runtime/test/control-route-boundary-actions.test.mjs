/** Public routing through the existing product mount and authenticated Actions owner; all source/SQL ports are local fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlRouteApplications} from '../control-route-boundary.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from '../product-applications.mjs';
import {actionFixture,id} from '../native-authority/test/standalone-actions-fixture.mjs';

function mounted(options={},sourceEnabled=true){
 const f=actionFixture(options),assembly=createRuntimeProductApplications({
  configuration:{...f.context.configuration,sourceEnabled},sessions:f.sessions,now:f.context.now,
  ports:captureRuntimePorts({actionApplication:f.app}),
 });
 const routes=createControlRouteApplications({assembly,candidate:{handle(){assert.fail('public query reached private candidate');}}});
 return {...f,routes,query:()=>routes.public.handle(f.request('query',{request:{limit:20}}))};
}
function noTaskDispatch(f){assert.equal(f.state.effects,0);assert.equal(f.state.decisions,0);assert.equal(f.metadata.rows.size,0);}
function noSourceRead(f){assert.equal(f.state.sourceCalls,0);assert.equal(f.lookup.lookups.size,0);noTaskDispatch(f);}

test('public Actions query reaches the mounted authenticated owner and returns its retained scoped result',async()=>{
 const f=mounted(),response=await f.query();
 assert.equal(response.status,200,await response.clone().text());
 const result=await response.json();
 assert.equal(result.observation.result.actions[0].id,f.native.actions[0].id);
 assert.ok(result.observation.result.actions.every(action=>action.clientId===id(5)));
 assert.equal(f.lookup.lookups.size,1);assert.equal(f.state.sourceCalls,1);noTaskDispatch(f);
});

for(const mode of ['missing bearer','invalid bearer','revoked session','mismatched selected client'])test('public query preserves owner admission: '+mode,async()=>{
 const f=mounted(),request=f.request('query',{request:{}});
 if(mode==='missing bearer')request.headers.delete('authorization');
 if(mode==='invalid bearer')request.headers.set('authorization','Bearer unknown-synthetic-session');
 if(mode==='revoked session')f.state.revoked=true;
 if(mode==='mismatched selected client'){
  const read=f.sessions.readCurrentState;
  f.sessions.readCurrentState=async input=>({...await read(input),selectedClientId:id(90)});
 }
 const response=await f.routes.public.handle(request);
 assert.equal(response.status,401);assert.equal((await response.json()).error.code,'UNAUTHENTICATED');noSourceRead(f);
});

test('public query keeps final retention release refusal after the lookup was stored',async()=>{
 const f=mounted({retention:{async assertServable(){},async withRelease(){throw Error('suppressed');}}}),response=await f.query();
 assert.notEqual(response.status,200);assert.equal((await response.json()).error.outcome,'RESULT_NOT_RELEASED');
 assert.equal(f.state.sourceCalls,1);assert.equal(f.lookup.lookups.size,1);noTaskDispatch(f);
});

test('query admission does not expose action mutations, neighboring paths or the private listener',async()=>{
 const f=mounted();
 for(const route of ['draft','prepare','execute','query/','query/extra','query-other','%71uery']){
  const response=await f.routes.public.handle(f.request(route,{}));
  assert.equal(response.status,404,route);assert.equal((await response.json()).error.code,'ROUTE_NOT_FOUND');
 }
 assert.equal((await f.routes.private.handle(f.request('query',{request:{}}))).status,404);noSourceRead(f);
});

test('public query retains the canonical method and disabled-source gates',async()=>{
 const f=mounted(),request=f.request('query',{request:{}});
 assert.equal((await f.routes.public.handle(new Request(request.url,{method:'GET',headers:request.headers}))).status,405);noSourceRead(f);
 const disabled=mounted({},false),response=await disabled.query();
 assert.equal(response.status,503);assert.equal((await response.json()).error.code,'UNAVAILABLE');noSourceRead(disabled);
});
