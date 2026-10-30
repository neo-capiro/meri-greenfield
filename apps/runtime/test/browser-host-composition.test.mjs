/** Focused checks for the shared browser-host Control wiring: the real configuration compiler, the real
 * currentness/allocation/router factories and the real facts contract, with synthetic external owners.
 * Source evidence only - never native/PG/Core activation, and activation is never opened. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileBrowserHostConfiguration} from '../browser-host-configuration.mjs';
import {createBrowserHostComposition,readBrowserHostMaterial} from '../browser-host-composition.mjs';
import {createBrowserHostRunFacts,createBrowserHostSiteWorkflowPort} from '../browser-host-run-facts.mjs';
import {assertBrowserHostFacts,browserHostFactsDigest,BROWSER_HOST_FACTS_SCHEMA,BROWSER_HOST_FACTS_MAX_BYTES,
 BROWSER_HOST_ARTIFACT_MAX_BYTES,BROWSER_HOST_ARTIFACT_MAX_ENCODED_BYTES,BROWSER_HOST_ARTIFACT_ENVELOPE_OVERHEAD_BYTES,
 BROWSER_HOST_ARTIFACT_ENVELOPE_MAX_BYTES,BROWSER_HOST_ARTIFACT_ENCODING} from '../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';

const U=n=>`${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const binding=Object.freeze({tenantId:U(1),actorId:U(2),conversationId:U(3),runId:U(4),attemptId:U(5),workerId:U(6),writerFence:1});
const scopes=Object.freeze([Object.freeze({tenantId:U(1),kind:'client',resourceId:U(7),policyRevision:'synthetic-policy'})]);
const capabilityPolicy={};
const browserPolicy=validateBrowserPolicy();
const tls={privateClient:{clientName:'control.private.invalid',certFile:'C:/m/c.pem',keyFile:'C:/m/k.pem',caFile:'C:/m/ca.pem'}};
const material={privateClient:{cert:Buffer.from('c'),key:Buffer.from('k'),ca:Buffer.from('a')}};
const wire=v=>Object.freeze({schema:BROWSER_HOST_FACTS_SCHEMA,binding:v.binding??binding,scopes:v.scopes??scopes,
 deadlineMs:v.deadlineMs??1000,currentUntilMs:v.currentUntilMs??900,phase:v.phase??'active',
 admitted:v.admitted??{sdk:true,bash:false,browser:true},
 capabilityPolicy:v.capabilityPolicy??capabilityPolicy,capabilityPolicySha256:v.capabilityPolicySha256??canonicalSha256(capabilityPolicy),
 browserPolicy:v.browserPolicy??browserPolicy,browserPolicySha256:v.browserPolicySha256??canonicalSha256(browserPolicy),
 ...(v.siteWorkflow===undefined?{}:{siteWorkflow:v.siteWorkflow}),...(v.browserHandoff===undefined?{}:{browserHandoff:v.browserHandoff})});
const owners=()=>({pool:{connect:async()=>({query:async()=>({rows:[]}),release(){}}),end(){return assert.fail('borrowed pool ended');}},
 store:{executions:{readCurrentOnClient:async()=>({})},lifecycle:{browserCustody:{currentHost:async()=>({})}},
  read:async()=>({run:{binding,scopes,versions:{synthetic:1}},request:{}})},
 sessions:{nativeCredentialFor:async()=>({credential:'synthetic-credential'})},core:{readCurrent:async()=>({})},
 capabilityPolicy:{forRun:async()=>({})},readBrowserPolicy:async()=>({})});

test('configuration: absent and disabled compose nothing; a usable declaration is closed',()=>{
 assert.equal(compileBrowserHostConfiguration({}),null);
 assert.equal(compileBrowserHostConfiguration({browserHosts:{enabled:false}}),null);
 const d=compileBrowserHostConfiguration({browserHosts:{enabled:true,tls}});
 assert.equal(d.requestMs,10000);assert.equal(d.maxCurrentnessMs,3000);assert.equal(d.maxLeaseMs,10000);
 assert.equal(d.bind,undefined);
 assert.throws(()=>compileBrowserHostConfiguration({browserHosts:{enabled:true,tls,ready:true}}));
 assert.throws(()=>compileBrowserHostConfiguration({browserHosts:{enabled:true,tls:{privateClient:{...tls.privateClient,certFile:'rel.pem'}}}}));
 assert.throws(()=>compileBrowserHostConfiguration({browserHosts:{enabled:true,tls,bind:{address:'10.0.0.1',port:8443}}}));
 assert.throws(()=>compileBrowserHostConfiguration({browserHosts:{enabled:true}}));
});

test('facts contract accepts exactly the wire it emits (roundtrip, repeat, digest, tamper)',()=>{
 const first=assertBrowserHostFacts(wire({}));
 const serialized=JSON.stringify(first);
 const second=assertBrowserHostFacts(JSON.parse(serialized));
 assert.deepEqual(second,first,'the emitted wire re-validates identically');
 assert.deepEqual(assertBrowserHostFacts(second),second,'validation is repeatable');
 assert.equal(browserHostFactsDigest(JSON.parse(serialized)),canonicalSha256(second));
 assert.throws(()=>assertBrowserHostFacts(wire({capabilityPolicySha256:'a'.repeat(64)})),{code:'BROWSER_HOST_FACTS_REFUSED'});
 assert.throws(()=>assertBrowserHostFacts(wire({browserPolicySha256:canonicalSha256({synthetic:true})})),{code:'BROWSER_HOST_FACTS_REFUSED'});
 const legacy={...wire({})};delete legacy.capabilityPolicySha256;
 assert.throws(()=>assertBrowserHostFacts(legacy),'a document without digests is not the wire');
 assert.throws(()=>assertBrowserHostFacts(wire({phase:'held'})));
 assert.throws(()=>assertBrowserHostFacts(wire({currentUntilMs:5000})));
 assert.throws(()=>assertBrowserHostFacts(wire({binding:{...binding,runId:U(9)}}),{binding}));
 assert.throws(()=>assertBrowserHostFacts(wire({scopes:[{tenantId:U(2),kind:'client',resourceId:U(7),policyRevision:'p'}]})),'scope tenant must match');
 assert.throws(()=>assertBrowserHostFacts({...wire({}),siteWorkflows:[]}),'a manifest list is not facts');
 assert.ok(Buffer.byteLength(JSON.stringify(first))<=BROWSER_HOST_FACTS_MAX_BYTES);
});

test('artifact bounds are the named base64 encoding, with max and one-over arithmetic',()=>{
 assert.equal(BROWSER_HOST_ARTIFACT_ENCODING,'base64');
 assert.equal(BROWSER_HOST_ARTIFACT_MAX_BYTES,26214400);
 assert.equal(Math.ceil(BROWSER_HOST_ARTIFACT_MAX_BYTES/3)*4,BROWSER_HOST_ARTIFACT_MAX_ENCODED_BYTES);
 assert.equal(BROWSER_HOST_ARTIFACT_MAX_ENCODED_BYTES,34952536);
 assert.equal(BROWSER_HOST_ARTIFACT_ENVELOPE_MAX_BYTES,BROWSER_HOST_ARTIFACT_MAX_ENCODED_BYTES+BROWSER_HOST_ARTIFACT_ENVELOPE_OVERHEAD_BYTES);
 assert.equal(BROWSER_HOST_ARTIFACT_ENVELOPE_MAX_BYTES,35018072);
 assert.ok(BROWSER_HOST_ARTIFACT_ENVELOPE_MAX_BYTES>BROWSER_HOST_ARTIFACT_MAX_ENCODED_BYTES,'the envelope bound exceeds the encoded payload');
 assert.ok(Math.ceil((BROWSER_HOST_ARTIFACT_MAX_BYTES+1)/3)*4<=BROWSER_HOST_ARTIFACT_ENVELOPE_MAX_BYTES,'one raw byte over still fits the envelope');
 assert.ok(BROWSER_HOST_ARTIFACT_ENVELOPE_MAX_BYTES+1>BROWSER_HOST_ARTIFACT_ENVELOPE_MAX_BYTES,'one byte over the envelope bound is out');
});

test('composition refuses a declared host when any canonical owner is missing, and is absent when undeclared',()=>{
 const declaration=compileBrowserHostConfiguration({browserHosts:{enabled:true,tls}});
 for(const missing of ['pool','store','sessions','core','capabilityPolicy','readBrowserPolicy']){
  const value=owners();value[missing]=undefined;
  assert.throws(()=>createBrowserHostComposition({declaration,...value,material,now:()=>1000}),{code:'BROWSER_HOST_COMPOSITION'});
 }
 assert.equal(createBrowserHostComposition({declaration:null}),null);
});

test('composition wires the real owners, closes idempotently and refuses to start after close',async()=>{
 const declaration=compileBrowserHostConfiguration({browserHosts:{enabled:true,tls}});
 const composed=createBrowserHostComposition({declaration,...owners(),material,now:()=>1000});
 for(const name of ['read','prepareResume','execute','executeBrowserOperation'])assert.equal(typeof composed.browserHosts[name],'function');
 for(const name of ['readHost','readRoute','readFacts'])assert.equal(typeof composed.currentness[name],'function');
 assert.equal(typeof composed.readCanonicalFacts,'function','the protected store binds this exact callback');
 assert.equal(composed.siteWorkflows(),null,'no Core admission port supplied => no workflow resolver');
 assert.equal(composed.state().siteWorkflows,false);
 assert.deepEqual(await composed.start(),{mounted:true,listener:null},'a client-only declaration starts without a listener');
 assert.deepEqual(await composed.close(),{closed:true});
 assert.deepEqual(await composed.close(),{closed:true});
 await assert.rejects(composed.start(),{code:'BROWSER_HOST_CLOSED'});
});

test('material loader reads exactly the declared references',async()=>{
 const declaration=compileBrowserHostConfiguration({browserHosts:{enabled:true,tls}});
 const seen=[];const loaded=await readBrowserHostMaterial(declaration,async path=>{seen.push(path);return Buffer.from('x');});
 assert.deepEqual(seen,['C:/m/c.pem','C:/m/k.pem','C:/m/ca.pem']);
 assert.equal(loaded.hostServer,undefined);
 assert.equal(await readBrowserHostMaterial(null,async()=>Buffer.from('x')),null);
 await assert.rejects(readBrowserHostMaterial(declaration,async()=>Buffer.alloc(0)),{code:'BROWSER_HOST_COMPOSITION'});
});

test('facts run on the caller client and refuse successor, held and missing-deadline states',async()=>{
 const seen=[];
 const currentness={readFacts:async(client,input)=>{seen.push({client,input});return {phase:'active',browserAdmitted:true,sdkAdmitted:true,bashAdmitted:false,
  currentUntilMs:900,deadlineMs:1000,scopes,capabilityPolicy,browserPolicy,originalBinding:binding,
  savedRequest:{siteWorkflow:{siteId:'synthetic-site',workflowId:'synthetic-flow',version:2,manifestSha256:'b'.repeat(64)}}}}};
 const facts=createBrowserHostRunFacts({currentness});
 const client={query:async()=>({rows:[]})};
 const doc=await facts.readCanonicalFacts(client,{allocation:{hostId:U(9),generation:1},binding});
 assert.equal(seen.length,1);assert.equal(seen[0].client,client,'the supplied transaction client is used');
 assert.equal(doc.deadlineMs,1000);assert.equal(doc.currentUntilMs,900);
 assert.equal(doc.capabilityPolicySha256,canonicalSha256(doc.capabilityPolicy));
 assert.equal(doc.browserPolicySha256,canonicalSha256(doc.browserPolicy));
 assert.deepEqual(doc.siteWorkflow,{siteId:'synthetic-site',workflowId:'synthetic-flow',version:2,manifestSha256:'b'.repeat(64)},'the SAVED selection, not a manifest');
 assert.equal(Object.hasOwn(doc,'browserHandoff'),false,'handoff is not invented when the read does not supply it');
 assert.deepEqual(assertBrowserHostFacts(JSON.parse(JSON.stringify(doc))),doc);

 const held={readFacts:async()=>({phase:'active',browserAdmitted:false,sdkAdmitted:true,bashAdmitted:false,currentUntilMs:900,deadlineMs:1000,scopes,capabilityPolicy,browserPolicy,originalBinding:binding})};
 await assert.rejects(createBrowserHostRunFacts({currentness:held}).readCanonicalFacts(client,{allocation:{},binding}),{code:'BROWSER_HOST_FACTS_REFUSED'});

 const successor={readFacts:async()=>({phase:'active',browserAdmitted:true,sdkAdmitted:true,bashAdmitted:false,currentUntilMs:900,deadlineMs:1000,scopes,capabilityPolicy,browserPolicy,originalBinding:{...binding,runId:U(9)}})};
 await assert.rejects(createBrowserHostRunFacts({currentness:successor}).readCanonicalFacts(client,{allocation:{},binding}),{code:'BROWSER_HOST_FACTS_REFUSED'});

 const noDeadline={readFacts:async()=>({phase:'active',browserAdmitted:true,sdkAdmitted:true,bashAdmitted:false,currentUntilMs:900,scopes,capabilityPolicy,browserPolicy,originalBinding:binding})};
 await assert.rejects(createBrowserHostRunFacts({currentness:noDeadline}).readCanonicalFacts(client,{allocation:{},binding}),{code:'BROWSER_HOST_FACTS_REFUSED'});
 await assert.rejects(createBrowserHostRunFacts({currentness}).readCanonicalFacts({},{}),{code:'BROWSER_HOST_FACTS_REFUSED'});
});

test('the live site-workflow port re-resolves through the real Core admission owner with saved selection',async()=>{
 const calls=[];const selection={siteId:'synthetic-site',workflowId:'synthetic-flow',version:2,manifestSha256:'b'.repeat(64)};
 const store={read:async()=>({run:{binding,scopes,versions:{synthetic:1}},request:{siteWorkflow:selection}})};
 const admission={resolve:async(input)=>{calls.push(input);
  return {manifest:{synthetic:true},manifestSha256:'a'.repeat(64),enabled:true};}};
 const port=createBrowserHostSiteWorkflowPort({store,admission});
 assert.equal(Object.hasOwn(binding,'scopes'),false,'a RunBinding has no scopes');
 const first=await port.resolve({binding});
 const second=await port.resolve({binding});
 assert.equal(calls.length,2,'each resolve re-reads and re-resolves');
 assert.deepEqual(calls[0].selection,selection,'the SAVED selection is passed to the Core owner');
 assert.deepEqual(calls[0].scopes,scopes);assert.deepEqual(calls[0].versions,{synthetic:1});
 assert.equal(first.enabled,true);assert.equal(second.enabled,true);
 assert.throws(()=>createBrowserHostSiteWorkflowPort({store,admission:{}}),{code:'BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE'});
});
