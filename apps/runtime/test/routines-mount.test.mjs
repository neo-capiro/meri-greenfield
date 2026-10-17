/** Compiled-owner route composition only; no database, provider or release qualification. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
// Unused document storage recovery is outside this route test; every routine owner below is real.
mock.module('../artifacts/composition.mjs',{namedExports:{runtimeArtifactRecovery(){return null;}}});
// This sparse test checkout borrows dependencies without installing workspace package links.
const link=registerHooks({resolve(specifier,context,next){return specifier==='@capiro/meri-contracts/node'?{url:new URL('../../../packages/contracts/validate.mjs',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
let captureRuntimePorts,composeRuntimePorts,createRuntimeProductApplications;
try{({captureRuntimePorts,composeRuntimePorts,createRuntimeProductApplications}=await import('../product-applications.mjs'));}finally{link.deregister();}
import {createRuntimeRoutinesFeature} from '../routines.mjs';
import {productReadiness} from '../product-readiness.mjs';
import {createControlRouteApplications} from '../control-route-boundary.mjs';
import {ROUTINE_PATHS} from '../../control/schedules/application-http.mjs';
import {applicationFixture,routineRequest} from '../../control/schedules/test/application-fixture.mjs';
const configuration={sourceEnabled:false,limits:{requestMs:100,requestBytes:131072},native:{maxResponseBytes:131072}};
const request=path=>new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'});
test('fixed routines routes are public only and absent owner is unavailable',async()=>{
 const app=createRuntimeProductApplications({configuration,sessions:{},ports:captureRuntimePorts(),now:Date.now});
 const routes=createControlRouteApplications({assembly:app,candidate:{handle(){throw Error('private owner');}}});
 for(const path of Object.values(ROUTINE_PATHS)){assert.equal((await routes.public.handle(request(path))).status,503);assert.equal((await routes.private.handle(request(path))).status,404);}
 for(const path of ['/api/routines','/api/routines/approve/extra','/api/routines/other','/api/routines-other','/internal/conversations/routines'])assert.equal((await routes.public.handle(request(path))).status,404);
});
test('trusted factory receives actual assembly sessions once and retains original receiver',async()=>{
 const sessions={},seen=[];let calls=0;const feature={marker:1,create(input){assert.equal(this.marker,1);assert.equal(input.sessions,sessions);calls++;return {handle(req){seen.push(new URL(req.url).pathname);return new Response('composed');}};},state(){assert.equal(this.marker,1);return 'composed';}};
 const ports=captureRuntimePorts({routinesApplicationFactory:feature});feature.create=()=>{throw Error('replaced');};
 const app=createRuntimeProductApplications({configuration,sessions,ports,now:Date.now});
 for(const path of Object.values(ROUTINE_PATHS))assert.equal((await app.handle(request(path))).status,200);
 assert.equal(app.handle(request('/api/routines/unknown')),null);assert.equal(calls,1);assert.deepEqual(seen,Object.values(ROUTINE_PATHS));
 const state=productReadiness({ports,sourceEnabled:false});assert.equal(state.ready,false);assert.equal(state.owners.find(x=>x.name==='schedules.application').state,'composed');assert.equal(state.owners.find(x=>x.name==='schedules.dispatchWorker').state,'separate-service-required');
 assert.throws(()=>composeRuntimePorts({routinesApplicationFactory:ports.routinesApplicationFactory},{routinesApplicationFactory:ports.routinesApplicationFactory}));
});
test('routines kill switch avoids dependencies and reports disabled separately',async()=>{
 let inspected=0;const poison=new Proxy({},{get(){inspected++;throw Error('unexpected');}});
 const feature=createRuntimeRoutinesFeature({enabled:false,pool:poison,client:poison,context:poison});assert.equal(feature.state(),'disabled');
 const ports=captureRuntimePorts({routinesApplicationFactory:feature}),app=createRuntimeProductApplications({configuration,sessions:poison,ports,now:Date.now});
 assert.equal((await app.handle(request(ROUTINE_PATHS.approve))).status,503);assert.equal(inspected,0);
 assert.equal(productReadiness({ports,sourceEnabled:false}).owners.find(x=>x.name==='schedules.application').state,'disabled');
});
test('capture rejects accessor or unknown authority selectors without invoking them',()=>{
 let touched=0;assert.throws(()=>captureRuntimePorts({routinesApplicationFactory:{get create(){touched++;return ()=>{};},state(){return 'composed';}}}));
 assert.throws(()=>captureRuntimePorts({routinesApplicationFactoryModule:'forged'}));assert.equal(touched,0);
});
test('actual compiled feature joins actual canonical sessions and native context through public preparation and approval',async()=>{
 const f=await applicationFixture();try{
  const {commandContext,allocationJson,template,workflow,policy,limits}=f.contextConfiguration;
  const feature=createRuntimeRoutinesFeature({enabled:true,pool:f.pool,client:f.client,context:{commandContext,allocationJson,template,workflow,policy,limits},now:f.now,newId:f.newId,limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:131072}});
  assert.equal(feature.state(),'pending');const app=createRuntimeProductApplications({configuration,sessions:f.sessions,ports:captureRuntimePorts({routinesApplicationFactory:feature}),now:f.now});assert.equal(feature.state(),'composed');
  const routes=createControlRouteApplications({assembly:app,candidate:{handle(){throw Error('private');}}}),send=(path,body)=>routes.public.handle(new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+f.session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
  const preparedResponse=await send(ROUTINE_PATHS.prepare,{requestId:'public-request',operation:'schedule_task',request:routineRequest()});assert.equal(preparedResponse.status,200);const prepared=await preparedResponse.json();assert.equal(prepared.status,'approval_required');assert.equal(f.temporal.calls.create,0);
  const approved=await send(ROUTINE_PATHS.approve,{...f.body(prepared),decision:'approved'});assert.equal(approved.status,200);assert.equal((await approved.json()).status,'acknowledged');assert.equal(f.temporal.calls.create,1);
  f.state.revoked=true;const denied=await send(ROUTINE_PATHS.approve,{...f.body(prepared),decision:'approved'});assert.notEqual(denied.status,200);assert.equal(f.temporal.calls.create,1);
 }finally{f.close();}
});
