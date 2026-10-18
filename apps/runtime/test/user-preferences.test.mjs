/** Actual runtime adapter, native membership/API/service/store. Core identity/Fetch and SQL boundaries are scripted.
 * Unrelated prepared-run compiler and artifact-recovery composition are borrowed; no native allocation or S3 behavior is qualified. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
mock.module('../prepared-candidate-config.mjs',{namedExports:{compilePreparedCandidateConfiguration(){throw Error('No prepared-run compilation in this settings test');}}});
mock.module('../artifacts/composition.mjs',{namedExports:{runtimeArtifactRecovery(){return null;}}});
const {createRuntimeUserPreferences}=await import('../user-preferences.mjs');
const {captureRuntimePorts,createRuntimeProductApplications}=await import('../product-applications.mjs');
const {compileControlUserPreferencesConfiguration,validateConfiguration}=await import('../config.mjs');
import {createControlRouteApplications} from '../control-route-boundary.mjs';
import {createSettingsPoolFixture} from '../../control/settings/test/postgres-store-fixture.mjs';
import {fixture} from '../../control/settings/user-application/test/fixture.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {productFailure} from '../../control/product-access/errors.mjs';
const unavailable=error=>productFailure(error)?.code==='USER_PREFERENCES_UNAVAILABLE';
const configuration={sourceEnabled:false,limits:{requestMs:1000,requestBytes:131072},native:{maxResponseBytes:131072}};
const request=(operation,body={},credential='A')=>new Request('https://meri.synthetic.invalid/api/settings/user/'+operation,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
const tables=['meri_settings.user_preferences','meri_settings.settings_audit'];
const schema=()=>({rows:tables.map(name=>({name,relation:name}))});
function assembled({enabled=true,scripts=[]}={}){
 const native=fixture(),sql=createSettingsPoolFixture(scripts),state={reads:0,result:schema(),error:false,wait:null};
 const pool={...sql.pool,async query(statement,params){state.reads++;assert.match(statement,/^SELECT name,to_regclass/u);assert.deepEqual(params,[tables]);await state.wait;if(state.error)throw Error('synthetic private schema outage');return state.result;}};
 const ports=captureRuntimePorts({conversationMembership:native.gate}),config={...configuration,userPreferences:{enabled}},runtime=createRuntimeUserPreferences({configuration:config,pool,ports,now:()=>native.state.now});
 const products=createRuntimeProductApplications({configuration:config,sessions:{},ports,now:()=>native.state.now,userPreferences:runtime});
 const routes=createControlRouteApplications({assembly:{handle:r=>products.handle(r)??new Response(null,{status:404})},candidate:{handle(){assert.fail('settings must not use protected candidate authority');}}});
 return {runtime,native,sql,state,routes,call:(operation,body={},credential='A')=>routes.public.handle(request(operation,body,credential))};
}
test('absent/false opt-in is inert; declarations accept only a closed boolean and only the control role',async()=>{
 for(const c of [configuration,{...configuration,userPreferences:{enabled:false}}]){
  const blocked=new Proxy({}, {get(){assert.fail('disabled construction must not inspect ports or pool');}});
  const runtime=createRuntimeUserPreferences({configuration:c,pool:blocked,ports:blocked});assert.equal(runtime.state(),'disabled');
  await runtime.readiness();assert.equal((await runtime.handle(request('save'))).status,503);runtime.close();
 }
 for(const value of [null,{},true,{enabled:'true'},{enabled:1},{enabled:true,gate:{}}])assert.throws(()=>compileControlUserPreferencesConfiguration({userPreferences:value}));
 assert.equal(compileControlUserPreferencesConfiguration({userPreferences:{enabled:true}}),true);
 assert.throws(()=>validateConfiguration({userPreferences:{enabled:true}},'conversation-runner'));
 assert.throws(()=>validateConfiguration({userPreferences:{enabled:true}},'temporal-worker'));
});
test('enabled missing canonical membership refuses readiness and routes without database effects',async()=>{
 const blocked=new Proxy({}, {get(){assert.fail('missing owner must not inspect pool');}});
 const runtime=createRuntimeUserPreferences({configuration:{...configuration,userPreferences:{enabled:true}},pool:blocked,ports:captureRuntimePorts()});
 assert.equal(runtime.state(),'unavailable');await assert.rejects(runtime.readiness(),unavailable);
 assert.equal((await runtime.handle(request('read'))).status,503);
});
test('exact public mounts remain closed until schema readiness; protected and neighboring settings paths stay excluded',async()=>{
 const x=assembled();assert.equal(x.runtime.state(),'pending');assert.equal((await x.call('read')).status,503);
 assert.equal(x.native.state.identities.length,0);assert.equal(x.sql.connections(),0);
 for(const path of ['tenant/read','read/extra','%72ead'])assert.equal((await x.call(path)).status,404);
 for(const operation of ['read','save'])assert.equal((await x.routes.private.handle(request(operation))).status,404);
 await x.runtime.readiness();assert.equal(x.runtime.state(),'composed');assert.equal(x.state.reads,1);
 for(const [r,status] of [[new Request('https://meri.synthetic.invalid/api/settings/user/read'),405],[request('read?unexpected=1'),404]])assert.equal((await x.routes.public.handle(r)).status,status);
 assert.equal(x.sql.connections(),0);x.runtime.close();assert.equal(x.runtime.state(),'retired');assert.equal((await x.call('read')).status,503);
});
test('actual composed API reads, saves and reads back with the native owner, complete document and one audit',async()=>{
 const native=fixture(),preferences={...native.preferences,theme:'dark',density:'compact'},row={revision:'1',document:preferences,document_sha256:canonicalSha256(preferences)};
 const x=assembled({scripts:[{steps:[{match:/^SELECT revision,document/u,rows:[]}]},
  {steps:[{match:/^INSERT INTO meri_settings.user_preferences/u,rows:[row],inspect(params){assert.deepEqual(params.slice(0,2),['tenant-A','actor-A']);assert.deepEqual(JSON.parse(params[3]),preferences);}},{match:/^INSERT INTO meri_settings.settings_audit/u}]},
  {steps:[{match:/^SELECT revision,document/u,rows:[row]}]}]});
 await x.runtime.readiness();assert.equal((await x.call('read')).status,200);
 const saved=await x.call('save',{expectedRevision:0,preferences});assert.equal(saved.status,200);assert.deepEqual(await saved.json(),{owner:{tenantId:'tenant-A',actorId:'actor-A'},revision:1,preferences});
 assert.deepEqual(await (await x.call('read')).json(),{owner:{tenantId:'tenant-A',actorId:'actor-A'},revision:1,preferences});
 assert.ok(x.native.state.identities.length>=3);assert.ok(x.native.state.identities.every(c=>c.credential==='A'));
 assert.equal(x.sql.committed.filter(row=>row.kind==='audit').length,1);assert.equal(x.sql.released.length,3);x.runtime.close();
});
test('missing/duplicate schema rows close serving; a successful explicit readiness recovers it',async()=>{
 const x=assembled();await x.runtime.readiness();
 for(const rows of [[],[schema().rows[0],schema().rows[0]],tables.map(name=>({name,relation:null}))]){
  x.state.result={rows};await assert.rejects(x.runtime.readiness(),unavailable);assert.equal((await x.call('read')).status,503);
 }
 x.state.result=schema();await x.runtime.readiness();assert.equal(x.runtime.state(),'composed');x.state.error=true;
 await assert.rejects(x.runtime.readiness(),unavailable);assert.equal(x.runtime.state(),'pending');assert.equal(x.sql.connections(),0);
});
test('cancellation and retirement fence late readiness without closing borrowed resources',async()=>{
 for(const retire of [false,true]){
  const x=assembled(),wait=Promise.withResolvers(),controller=new AbortController();x.state.wait=wait.promise;
  const checking=x.runtime.readiness({signal:controller.signal});await new Promise(resolve=>setImmediate(resolve));
  if(retire)x.runtime.close();else controller.abort();wait.resolve();await assert.rejects(checking,unavailable);
  assert.equal((await x.call('read')).status,503);assert.equal(x.sql.connections(),0);
 }
});
test('a healthy pending readiness probe preserves serving; a failed latest probe closes it',async()=>{
 const x=assembled({scripts:[{steps:[{match:/^SELECT revision,document/u,rows:[]}]}]});await x.runtime.readiness();
 const wait=Promise.withResolvers();x.state.wait=wait.promise;const checking=x.runtime.readiness();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.runtime.state(),'composed');assert.equal((await x.call('read')).status,200);wait.resolve();await checking;
 assert.equal(x.runtime.state(),'composed');const controller=new AbortController();controller.abort();
 await assert.rejects(x.runtime.readiness({signal:controller.signal}),unavailable);
 assert.equal((await x.call('read')).status,503);x.runtime.close();
});
