/** Actual control startup and product composition; external resources are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {startControl} from '../control.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';

function fixture({connectHook,listenHook,nativeFailure=false}={}){
 const {configuration}=agentcoreControlFixture(),events=[];
 const pool={async query(){events.push('schema');return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'selected_outputs',initial_inputs:'initial_inputs'}]};},async connect(){assert.fail('No transaction expected');},async end(){events.push('pool-close');}};
 const native={async call(){assert.fail('No native operation expected');},async readiness(){events.push('native-ready');if(nativeFailure)throw Error('synthetic readiness failure');}};
 const client={workflow:{start:async()=>assert.fail('No workflow start'),getHandle:()=>assert.fail('No workflow handle')}};
 const candidate={native,execution:{async authenticate(){assert.fail('No execution expected');}},productPorts:{},application:{async handle(){return null;}},bindApplication(){},async close(){events.push('candidate-close');}};
 const owners={readMaterial:async p=>Buffer.from(p===configuration.database.connectionFile?'postgresql://synthetic.invalid/db?sslmode=verify-full':'synthetic-control-only'),tls:async()=>({}),
  createPool:()=>{events.push('pool');return pool;},async connect(){events.push('connect');await connectHook?.();return {async withDeadline(_at,fn){return fn();},async withAbortSignal(signal,fn){signal.throwIfAborted();return fn();},workflowService:{async describeNamespace({namespace}){assert.equal(namespace,configuration.temporal.namespace);return {};}},async close(){events.push('connection-close');}};},createClient:()=>client,
  startCandidate:async()=>{events.push('candidate');return candidate;},async listen(input){events.push('listen');await listenHook?.(input);return {address:{port:1},async close(){events.push('listener-close');}};}};
 return {configuration,pool,native,client,events,start:options=>startControl(configuration,{testOwners:owners,...options})};
}

test('product factory receives the same owned pool/client before readiness and listeners',async()=>{
 const f=fixture();let calls=0;
 const runtime=await f.start({productPortsFactory(context){calls++;f.events.push('factory');assert(Object.isFrozen(context));assert.equal(context.client,f.client);assert.equal(context.configuration,f.configuration);assert.equal(typeof context.pool.query,'function');return {};}});
 assert.equal(calls,1);assert(f.events.indexOf('factory')<f.events.indexOf('schema'));assert(f.events.indexOf('factory')<f.events.indexOf('listen'));
 await runtime.close();await runtime.close();assert.equal(f.events.filter(x=>x==='pool-close').length,1);assert.deepEqual(f.events.slice(-2),['connection-close','pool-close']);
});

test('invalid/accessor/proxy/async/generator and ambiguous factories refuse before startup IO',async()=>{
 let getters=0,calls=0;
 for(const options of [{productPortsFactory:1},{get productPortsFactory(){getters++;return ()=>{};}},{productPortsFactory:new Proxy(()=>{calls++;},{})},{productPortsFactory:async()=>{calls++;}},{productPortsFactory:function*(){calls++;}},{productPorts:{},productPortsFactory:()=>{calls++;}}]){
  const f=fixture();if(Object.getOwnPropertyDescriptor(options,'productPortsFactory')?.get){await assert.rejects(startControl(f.configuration,options));}else await assert.rejects(f.start(options));assert.deepEqual(f.events,[]);
 }
 assert.equal(getters,0);assert.equal(calls,0);
});

test('factory failures and invalid results close owned resources without opening a listener',async()=>{
 let getters=0;
 for(const factory of [()=>undefined,()=>{throw Error('factory');},()=>Promise.reject(Error('rejected synchronous result')),()=>({get then(){getters++;return ()=>{};}}),()=>({sdkSessionOwner:{get register(){getters++;return ()=>{};}}})]){
  const f=fixture();await assert.rejects(f.start({productPortsFactory:factory}),{code:'CONTROL_STARTUP_FAILED'});assert.deepEqual(f.events.slice(-2),['connection-close','pool-close']);assert(!f.events.includes('listen'));assert(!f.events.includes('schema'));
 }
 await new Promise(r=>setImmediate(r));assert.equal(getters,0);
});

test('startup cancellation after Temporal allocation closes resources before candidate or factory',async()=>{
 const abort=new AbortController(),f=fixture({connectHook:()=>abort.abort()});let calls=0;
 await assert.rejects(f.start({signal:abort.signal,productPortsFactory(){calls++;return {};}}),{code:'CONTROL_STARTUP_FAILED'});assert.equal(calls,0);assert(!f.events.includes('candidate'));assert(!f.events.includes('listen'));assert.deepEqual(f.events.slice(-2),['connection-close','pool-close']);
});

for(const mode of ['readiness','cancel'])test(`product ${mode} failure closes owned resources and preserves borrowed ports`,async()=>{
 const abort=new AbortController(),f=fixture({nativeFailure:mode==='readiness'});let disposed=0,calls=0;
 const identityContext={async verifyIdentity(){},async resolveContext(){},close(){disposed++;}};
 await assert.rejects(f.start({signal:abort.signal,productPortsFactory(){calls++;if(mode==='cancel')abort.abort();return {identityContext};}}),{code:'CONTROL_STARTUP_FAILED'});
 assert.equal(calls,1);assert.equal(disposed,0);assert(!f.events.includes('listen'));assert.deepEqual(f.events.slice(-2),['connection-close','pool-close']);
});

test('borrowed identity owner is captured before asynchronous startup and keeps its receiver',async()=>{
 let calls=0;const identityContext={marker:'original',async verifyIdentity(){assert.equal(this.marker,'original');calls++;throw Error('synthetic refusal');},async resolveContext(){}};
 const f=fixture({connectHook:()=>{identityContext.verifyIdentity=()=>{throw Error('replacement');};},listenHook:async({configuration,application})=>{
  if(configuration.http.port===8080){const r=await application.handle(new Request('https://synthetic.invalid/api/action-followthrough/session',{method:'POST',headers:{authorization:'Bearer synthetic-existing-authority','content-type':'application/json'},body:'{}'}));assert.equal(r.status,401);}
 }});
 const runtime=await f.start({productPorts:{identityContext}});assert.equal(calls,1);await runtime.close();
});
