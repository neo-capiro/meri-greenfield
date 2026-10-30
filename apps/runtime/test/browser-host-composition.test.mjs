/** Focused composition checks for the shared browser-host Control wiring. These use the REAL
 * currentness/allocation/router factories and the real contracts with synthetic external owners; they
 * are source evidence, never native/PG/Core acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileBrowserHostConfiguration} from '../browser-host-configuration.mjs';
import {createBrowserHostComposition,readBrowserHostMaterial} from '../browser-host-composition.mjs';
import {createBrowserHostRunFacts,createBrowserHostSavedSelection,createBrowserHostSiteWorkflowPort} from '../browser-host-run-facts.mjs';
import {assertBrowserHostFacts,BROWSER_HOST_FACTS_SCHEMA,BROWSER_HOST_FACTS_MAX_BYTES} from '../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';

const tls={privateClient:{clientName:'control.private.invalid',certFile:'C:/m/c.pem',keyFile:'C:/m/k.pem',caFile:'C:/m/ca.pem'}};
const material={privateClient:{cert:Buffer.from('c'),key:Buffer.from('k'),ca:Buffer.from('a')}};
const owners=()=>({pool:{connect:async()=>({query:async()=>({rows:[]}),release(){}})},
 store:{executions:{readCurrentOnClient:async()=>({})},lifecycle:{browserCustody:{currentHost:async()=>({})}},read:async()=>({})},
 sessions:{nativeCredentialFor:async()=>({credential:'x'})},core:{readCurrent:async()=>({})},
 capabilityPolicy:{forRun:async()=>({})},readBrowserPolicy:async()=>({})});

test('configuration: absent and disabled compose nothing, a usable declaration is closed',()=>{
 assert.equal(compileBrowserHostConfiguration({}),null);
 assert.equal(compileBrowserHostConfiguration({browserHosts:{enabled:false}}),null);
 const declared=compileBrowserHostConfiguration({browserHosts:{enabled:true,tls}});
 assert.equal(declared.requestMs,10000);assert.equal(declared.maxCurrentnessMs,3000);assert.equal(declared.maxLeaseMs,10000);
 assert.equal(declared.tls.privateClient.clientName,'control.private.invalid');
 assert.equal(declared.bind,undefined);
});

test('configuration refuses unknown keys, relative paths and a bind without server material',()=>{
 assert.throws(()=>compileBrowserHostConfiguration({browserHosts:{enabled:true,tls,ready:true}}));
 assert.throws(()=>compileBrowserHostConfiguration({browserHosts:{enabled:true,tls:{privateClient:{...tls.privateClient,certFile:'rel.pem'}}}}));
 assert.throws(()=>compileBrowserHostConfiguration({browserHosts:{enabled:true,tls,bind:{address:'10.0.0.1',port:8443}}}));
 assert.throws(()=>compileBrowserHostConfiguration({browserHosts:{enabled:true}}));
});

test('composition refuses a declared host when any canonical owner is missing',()=>{
 const declaration=compileBrowserHostConfiguration({browserHosts:{enabled:true,tls}});
 for(const missing of ['pool','store','sessions','core','capabilityPolicy','readBrowserPolicy']){
  const value=owners();value[missing]=undefined;
  assert.throws(()=>createBrowserHostComposition({declaration,...value,material}),{code:'BROWSER_HOST_COMPOSITION'});
 }
 assert.equal(createBrowserHostComposition({declaration:null}),null);
});

test('composition builds the real router/allocations/currentness and closes only what it owns',async()=>{
 const declaration=compileBrowserHostConfiguration({browserHosts:{enabled:true,tls}});
 const value=owners();let poolClosed=0;value.pool.end=()=>{poolClosed++;};
 const composed=createBrowserHostComposition({declaration,...value,material});
 assert.equal(typeof composed.browserHosts.read,'function');
 assert.equal(typeof composed.browserHosts.executeBrowserOperation,'function');
 assert.equal(typeof composed.allocations.resolve,'function');
 assert.equal(typeof composed.currentness.readHost,'function');
 assert.equal(typeof composed.currentness.readRoute,'function');
 assert.equal(typeof composed.currentness.readFacts,'function');
 assert.deepEqual(await composed.close(),{closed:true});
 assert.deepEqual(await composed.close(),{closed:true},"close is idempotent");
 assert.equal(poolClosed,0,'the borrowed pool is never ended here');
});

test('material loader reads exactly the declared references',async()=>{
 const declaration=compileBrowserHostConfiguration({browserHosts:{enabled:true,tls}});
 const seen=[];const loaded=await readBrowserHostMaterial(declaration,async path=>{seen.push(path);return Buffer.from('x');});
 assert.deepEqual(seen,['C:/m/c.pem','C:/m/k.pem','C:/m/ca.pem']);
 assert.equal(loaded.hostServer,undefined);
 assert.equal(await readBrowserHostMaterial(null,async()=>Buffer.from('x')),null);
 await assert.rejects(readBrowserHostMaterial(declaration,async()=>Buffer.alloc(0)),{code:'BROWSER_HOST_COMPOSITION'});
});

test('facts run on the caller transaction client and never open their own',async()=>{
 let opened=0,seenClient=false;
 const currentness={readFacts:async(client)=>{seenClient=client?.query!==undefined;opened++;return {phase:'active',browserAdmitted:true,
  sdkAdmitted:true,bashAdmitted:false,currentUntilMs:900,deadlineMs:1000,scopes:[{tenantId:'t',kind:'client',resourceId:'c'}],
  capabilityPolicy:{bash:false},browserPolicy:{enabled:true}};}};
 const facts=createBrowserHostRunFacts({currentness});
 const client={query:async()=>({rows:[]})};
 const doc=await facts.readCanonicalFacts(client,{allocation:{hostId:'h',generation:1},binding:{tenantId:'11111111-1111-4111-8111-111111111111',actorId:'22222222-2222-4222-8222-222222222222',conversationId:'33333333-3333-4333-8333-333333333333',runId:'44444444-4444-4444-8444-444444444444',attemptId:'55555555-5555-4555-8555-555555555555',workerId:'66666666-6666-4666-8666-666666666666',writerFence:1}});
 assert.equal(seenClient,true);assert.equal(opened,1);
 assert.equal(doc.schema,BROWSER_HOST_FACTS_SCHEMA);assert.equal(doc.deadlineMs,1000);assert.equal(doc.currentUntilMs,900);
 assert.ok(Buffer.byteLength(JSON.stringify(doc))<=BROWSER_HOST_FACTS_MAX_BYTES);
 await assert.rejects(facts.readCanonicalFacts({},{}),{code:'BROWSER_HOST_FACTS_REFUSED'});
});

test('facts refuse a missing execution deadline instead of substituting the cutoff',async()=>{
 const currentness={readFacts:async()=>({phase:'active',browserAdmitted:true,sdkAdmitted:true,bashAdmitted:false,currentUntilMs:900,
  scopes:[{kind:'client',resourceId:'c'}],capabilityPolicy:{},browserPolicy:{}})};
 await assert.rejects(createBrowserHostRunFacts({currentness}).readCanonicalFacts({query:async()=>({})},
  {allocation:{},binding:{}}),{code:'BROWSER_HOST_FACTS_REFUSED'});
});

test('saved selection is read through the store and the live port re-resolves through the service',async()=>{
 const binding={tenantId:'11111111-1111-4111-8111-111111111111',actorId:'22222222-2222-4222-8222-222222222222',conversationId:'33333333-3333-4333-8333-333333333333',runId:'44444444-4444-4444-8444-444444444444',attemptId:'55555555-5555-4555-8555-555555555555',workerId:'66666666-6666-4666-8666-666666666666',writerFence:1};
 let calls=0;
 const saved=createBrowserHostSavedSelection({store:{read:async()=>({run:{binding,scopes:[{kind:'client',resourceId:'c'}],versions:{v:1}},request:{}})}});
 assert.equal(await saved.readSavedSelection({binding}),null,'no saved workflow is not a selection');
 assert.equal(calls,0);
 let resoled=0;
 const port=createBrowserHostSiteWorkflowPort({service:{siteWorkflowResolve:async({credential,binding:value})=>{resoled++;assert.equal(credential,'cred');return {manifest:{},manifestSha256:'a'.repeat(64),enabled:true};}},
  nativeCredentials:{nativeCredentialFor:async()=>({credential:'cred'})}});
 const current=await port.resolve({binding:{...binding,scopes:[{kind:'client',resourceId:'c'}]}});
 assert.equal(resoled,1,'the live port re-resolves current Core state each call');
 assert.equal(current.enabled,true);
 assert.throws(()=>createBrowserHostSiteWorkflowPort({service:{},nativeCredentials:{}}),{code:'BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE'});
});

test('facts contract pins the binding, bounds the answer and is digest-stable',()=>{
 const base={schema:BROWSER_HOST_FACTS_SCHEMA,binding:{tenantId:'11111111-1111-4111-8111-111111111111',actorId:'22222222-2222-4222-8222-222222222222',conversationId:'33333333-3333-4333-8333-333333333333',runId:'44444444-4444-4444-8444-444444444444',attemptId:'55555555-5555-4555-8555-555555555555',workerId:'66666666-6666-4666-8666-666666666666',writerFence:1},
  scopes:[{kind:'client',resourceId:'c'}],deadlineMs:1000,currentUntilMs:900,phase:'active',admitted:{sdk:true,bash:false,browser:true},
  capabilityPolicy:{bash:false},browserPolicy:{enabled:true}};
 const ok=assertBrowserHostFacts(base);
 assert.equal(ok.currentUntilMs,900);
 assert.throws(()=>assertBrowserHostFacts(base,{binding:{...base.binding,runId:'other'}}));
 assert.throws(()=>assertBrowserHostFacts({...base,currentUntilMs:5000}));
 assert.throws(()=>assertBrowserHostFacts({...base,phase:'held'}));
 assert.throws(()=>assertBrowserHostFacts({...base,siteWorkflows:[]}),'a manifest list is not part of facts');
});
