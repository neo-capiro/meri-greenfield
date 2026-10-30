/** Real startControl/assembleControl checks for the shared browser-host family. These exercise the
 * ACTUAL assembly (no injected assemble) with the trusted external boundaries replaced by synthetic
 * ones: pool, Temporal connection, candidate and listeners. No SQL, network or native action runs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {startControl} from '../control.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../product-ports/capability-policy.mjs';

const credential='synthetic-control-startup-only-long-credential';
const tlsFiles={privateClient:{clientName:'control.private.invalid',certFile:'C:/m/c.pem',keyFile:'C:/m/k.pem',caFile:'C:/m/ca.pem'}};
const material={cert:Buffer.from('synthetic-cert'),key:Buffer.from('synthetic-key'),ca:Buffer.from('synthetic-ca')};

/** The single trusted-boundary harness: every side-effecting default is replaced, nothing else is. */
function harness({browserHosts,productPorts={}}={}){
 const configuration=structuredClone(agentcoreControlFixture().configuration);delete configuration.taskRouter;
 configuration.capabilityPlatform=structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM);
 if(browserHosts)configuration.browserHosts=browserHosts;
 const events=[],controller=new AbortController();
 const close=name=>async()=>{events.push('close:'+name);};
 const pool={async connect(){assert.fail('no transaction client in the startup harness');},
  async query(sql){events.push('schema');assert.ok(sql.startsWith("SELECT to_regclass('meri_conversations.runs')"));
   return {rows:[{runs:'meri_conversations.runs',events:'meri_conversations.events',controls:'meri_conversations.controls',
    selected_outputs:'meri_conversations.selected_outputs',initial_inputs:'meri_conversations.initial_inputs'}]};},end:close('pool')};
 const connection={async withDeadline(_at,operation){return operation();},async withAbortSignal(_signal,operation){return operation();},
  workflowService:{async describeNamespace(){events.push('temporal-health');return {};}},close:close('connection')};
 const native={async readiness(){events.push('native-readiness');},async call(){return {};}};
 const candidate={execution:{authenticate(){assert.fail('no private execution');}},native,
  productPorts:Object.freeze({browserHostCore:{readCurrent:async()=>({})},...productPorts}),
  application:{async handle(){return null;}},bindApplication(){events.push('candidate-bind');},close:close('candidate')};
 const owners={
  async readMaterial(path){events.push('material');if(path===configuration.database.connectionFile)return Buffer.from('postgresql://database.synthetic.invalid/meri?sslmode=verify-full');
   if(path===configuration.native.capabilityFile)return Buffer.from(credential);
   if(path==='C:/m/c.pem')return material.cert;if(path==='C:/m/k.pem')return material.key;if(path==='C:/m/ca.pem')return material.ca;
   assert.fail('unexpected material '+path);},
  async tls(){return {synthetic:true};},
  createPool(options){pool.options=options;events.push('pool');return pool;},
  async connect(){events.push('connect');return connection;},
  createClient(){events.push('client');return {workflow:{async start(){return {}},getHandle(){return {}}}};},
  async startCandidate(){events.push('candidate');return candidate;},
  async listen(options){const role=options.configuration.http.port===configuration.privateHttp?.port?'private':'public';
   events.push('listen:'+role);return {address:{address:'127.0.0.1',port:options.configuration.http.port},close:close(role+'-listener')};},
 };
 return {configuration,events,owners,start:()=>startControl(configuration,{signal:controller.signal,testOwners:owners})};
}

test('a declared but uncomposable browser-host family refuses before any listener opens',async()=>{
 const f=harness({browserHosts:{enabled:true,tls:tlsFiles}});
 f.owners.startCandidate=async()=>({execution:{authenticate(){assert.fail('no private execution');}},
  native:{async readiness(){},async call(){return {};}},productPorts:Object.freeze({}),application:{async handle(){return null;}},
  bindApplication(){},close:async()=>{}});
 await assert.rejects(f.start(),(error)=>{assert.equal(error.code,'CONTROL_STARTUP_FAILED');assert.ok(error.cause,'the refusal is preserved as the cause');return true;});
 assert.deepEqual(f.events.filter(event=>event.startsWith('listen:')),[],'no listener is opened for a declared but unusable family');
 assert.ok(f.events.includes('close:pool'),'the owned pool is retired on the failed startup');
});

test('an inactive declaration composes nothing and startup still binds both listeners',async()=>{
 const f=harness({browserHosts:{enabled:false}});
 const runtime=await f.start();
 try{assert.deepEqual(f.events.filter(event=>event.startsWith('listen:')),['listen:private','listen:public']);
  assert.equal(f.events.filter(event=>event==='material').length>=2,true,'material reads are the ordinary startup ones');
  assert.equal(f.events.includes('close:pool'),false,'a live runtime keeps its pool');
 }finally{await runtime.close();}
 assert.ok(f.events.includes('close:pool'));
});

test('an enabled client-only family starts with its material read before the listeners',async()=>{
 const f=harness({browserHosts:{enabled:true,tls:tlsFiles}});
 const runtime=await f.start();
 try{
  const listeners=f.events.filter(event=>event.startsWith('listen:'));
  assert.deepEqual(listeners,['listen:private','listen:public']);
  // The three declared references are read through the trusted material reader during startup.
  assert.equal(f.events.filter(event=>event==='material').length>=5,true);
  assert.equal(typeof runtime.close,'function');
 }finally{await runtime.close();}
 assert.ok(f.events.includes('close:pool'),'shutdown retires the owned pool');
});

test('a declared host with unreadable material refuses before assembling or listening',async()=>{
 const f=harness({browserHosts:{enabled:true,tls:tlsFiles}});
 const read=f.owners.readMaterial;
 f.owners.readMaterial=async path=>{if(path==='C:/m/k.pem')throw Object.assign(new Error('RUNTIME_SECRET_FILE'),{code:'RUNTIME_SECRET_FILE'});return read(path);};
 await assert.rejects(f.start(),(error)=>{assert.equal(error.code,'CONTROL_STARTUP_FAILED');return true;});
 assert.deepEqual(f.events.filter(event=>event.startsWith('listen:')),[]);
 assert.equal(f.events.includes('candidate'),false,'the candidate is never started when its material cannot be read');
});


test('a rejecting assembly cleanup still runs every owned teardown and keeps both failures',async()=>{
 const f=harness({browserHosts:{enabled:true,tls:tlsFiles}});
 const original=Object.assign(new Error('SYNTHETIC_ASSEMBLY_FAILED'),{code:'SYNTHETIC_ASSEMBLY_FAILED'});
 original.controlCleanup=Promise.reject(new Error('SYNTHETIC_CLEANUP_FAILED'));
 f.owners.assemble=()=>{throw original;};
 await assert.rejects(f.start(),(error)=>{
  assert.equal(error.code,'TEMPORAL_PRODUCT_CLEANUP_UNKNOWN','the cleanup failure is surfaced, not hidden');
  const seen=[error,...(error.cause?.errors??[])].map(entry=>entry?.message??String(entry));
  assert.ok(seen.some(message=>message.includes('SYNTHETIC_ASSEMBLY_FAILED')),'the original assembly failure is preserved');
  assert.ok(seen.some(message=>message.includes('SYNTHETIC_CLEANUP_FAILED')),'the cleanup failure is preserved');
  return true;});
 assert.ok(f.events.includes('close:candidate'),'the candidate is still retired');
 assert.ok(f.events.includes('close:connection'),'the Temporal connection is still retired');
 assert.ok(f.events.includes('close:pool'),'the pool is still retired even though cleanup rejected first');
});

test('a late constructor failure after session/browser creation retires every owner created so far',async()=>{
 const unhandled=[];
 const onUnhandled=reason=>unhandled.push(reason);
 process.on('unhandledRejection',onUnhandled);
 const f=harness({browserHosts:{enabled:true,tls:tlsFiles},
  productPorts:{uploadApplicationFactory:Object.freeze({create:()=>null,state:()=>'composed',
   createSource(){throw Object.assign(new Error('SYNTHETIC_LATE_FAILURE'),{code:'SYNTHETIC_LATE_FAILURE'});}})}});
 delete f.owners.assemble; // the REAL assembleControl runs, not a stand-in
 await assert.rejects(f.start(),(error)=>{
  assert.equal(error.code,'CONTROL_STARTUP_FAILED');
  assert.equal(error.cause?.message,'SYNTHETIC_LATE_FAILURE','the late failure is the reported cause');
  return true;});
 assert.ok(f.events.includes('close:pool'),'the owned pool is retired after a late assembly failure');
 assert.ok(f.events.includes('close:connection'),'the Temporal connection is retired too');
 assert.ok(f.events.includes('close:candidate'),'the candidate is retired too');
 await new Promise(resolve=>setImmediate(resolve));
 process.off('unhandledRejection',onUnhandled);
 assert.deepEqual(unhandled,[],'no cleanup rejection is orphaned by the late failure');
});
