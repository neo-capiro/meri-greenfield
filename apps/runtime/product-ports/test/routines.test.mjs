/** SYNTHETIC: the routines family over the real foreground feature, kill switch and readiness census. The enabled case borrows the
 * existing routines application fixture (synthetic SQL, Core and Temporal); it proves composition, not live owners. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createProductPortsFactory} from '../index.mjs';
import {createRoutinesFamily,routinesFamily,compileRoutinesConfiguration,PRODUCTION_ROUTINE_OWNERS} from '../routines.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {ROUTINE_PATHS} from '../../../control/schedules/application-http.mjs';
import {applicationFixture,routineRequest} from '../../../control/schedules/test/application-fixture.mjs';
const code=c=>e=>e?.code===c;
const base={limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:131072},native:{maxResponseBytes:131072}};
const post=(path,body={},credential='synthetic')=>new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
const census=ports=>{const r=productReadiness({ports:captureRuntimePorts(ports),retention:null,sourceEnabled:false});return [r.owners.find(o=>o.name==='schedules.application').state,r.owners.find(o=>o.name==='schedules.inbox').state];};

test('production composition is the disabled feature: nothing borrowed is inspected and readiness says disabled',async()=>{
 let touched=0;const poison=new Proxy({},{get(){touched++;throw Error('unexpected');}});
 for(const configuration of [base,{...base,routines:{enabled:false}}]){
  const ports=createProductPortsFactory({families:[['routines',createRoutinesFamily]]})(Object.freeze({configuration,pool:poison,client:poison,native:poison,now:Date.now,canonicalProductPorts:{}}));
  assert.deepEqual(Object.keys(ports),['routinesApplicationFactory']);assert.deepEqual(census(ports),['disabled','disabled']);
  const response=await ports.routinesApplicationFactory.create({sessions:poison}).handle(post(ROUTINE_PATHS.prepare));
  assert.equal(response.status,503);assert.equal((await response.json()).error.code,'ROUTINES_UNAVAILABLE');
 }
 assert.equal(touched,0);
});

test('enabled in configuration without the trusted owners reports unavailable instead of failing control startup',async()=>{
 const {ports}=createRoutinesFamily({configuration:{...base,routines:{enabled:true}},pool:{},client:{},now:Date.now});
 assert.deepEqual(census(ports),['unavailable','unavailable']);
 assert.equal((await ports.routinesApplicationFactory.create({sessions:{}}).handle(post(ROUTINE_PATHS.list))).status,503);
 for(const routines of [{},{enabled:'true'},{enabled:true,owners:'forged'}])assert.throws(()=>compileRoutinesConfiguration({routines}),code('ROUTINES_CONFIGURATION'));
 for(const owners of [{},{context:{},runControl:{cancel(){}},retirement:{retire(){}}},{context:{commandContext:1,allocationJson:1,template:1,workflow:1,policy:1,limits:1},runControl:{},retirement:{retire(){}}}])
  assert.throws(()=>routinesFamily(owners),code('ROUTINES_CONFIGURATION'));
 // Every missing production owner is named with the lane that must produce it.
 assert.deepEqual(Object.keys(PRODUCTION_ROUTINE_OWNERS).sort(),['context.commandContext+allocationJson+template','context.policy','context.workflow','retirement','runControl']);
});

test('with every trusted owner supplied the enabled feature composes over the actual sessions and serves preparation',async()=>{
 const f=await applicationFixture();try{
  const {commandContext,allocationJson,template,workflow,policy,limits}=f.contextConfiguration,cancelled=[],retired=[];
  const client={...f.client,connection:{withDeadline:(deadline,fn)=>fn(),withAbortSignal:(signal,fn)=>fn()}};
  const family=routinesFamily({context:{commandContext,allocationJson,template,workflow,policy,limits},newId:f.newId,
   runControl:{async cancel(call){cancelled.push(call);}},retirement:{async retire(call){retired.push(call);}}});
  const {ports}=family({configuration:{...base,routines:{enabled:true}},pool:f.pool,client,now:f.now});
  assert.equal(ports.routinesApplicationFactory.state(),'pending');
  const app=ports.routinesApplicationFactory.create({sessions:f.sessions});assert.deepEqual(census(ports),['composed','pending']);
  const prepared=await app.handle(post(ROUTINE_PATHS.prepare,{requestId:'public-request',operation:'schedule_task',request:routineRequest()},f.session.credential));
  assert.equal(prepared.status,200);assert.equal((await prepared.json()).status,'approval_required');
  assert.equal(f.temporal.calls.create,0);assert.deepEqual([cancelled.length,retired.length],[0,0]);
 }finally{await f.close();}
});
