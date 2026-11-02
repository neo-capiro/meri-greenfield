/** Focused checks for the facts projection, the held/successor wire shape and the live Core workflow join.
 *
 * The currentness test drives the REAL createBrowserHostCurrentness over a synthetic SQL client that
 * returns an actual rowRun record from the lifecycle fixture (projection + request on the row) and a real
 * allocation row; only the execution reader, Core client and policy readers are synthetic boundaries.
 * Activation is control configuration; without an open record browserAdmitted is false and the facts producer refuses — that
 * gate is asserted, never bypassed. No database, network, native or activation change happens here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {savedRequestOf,createBrowserHostCurrentness} from '../../control/browser-hosts/currentness.mjs';
import {allocationRow} from '../../control/browser-hosts/allocation.mjs';
import {createBrowserHostRunFacts,createBrowserHostSiteWorkflowPort} from '../browser-host-run-facts.mjs';
import {assertBrowserHostFacts,browserHostFactsDigest,BROWSER_HOST_FACTS_SCHEMA,BROWSER_HOST_FACT_PHASES}
  from '../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';
import {compileBrowserActivation,EGRESS_REQUIREMENTS_SHA256,BROWSER_ACTIVATION_RENDER_VERIFICATION} from '../../worker/conversation/browser/activation.mjs';
import {hostClientDnsName} from '../../worker/conversation/host/control/protocol.mjs';
import {lifecycleFixture,binding as fixtureBinding,id} from '../../control/conversations/test/lifecycle-fixture.mjs';

const U=n=>`${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const binding=Object.freeze({tenantId:U(1),actorId:U(2),conversationId:U(3),runId:U(4),attemptId:U(5),workerId:U(6),writerFence:1});
const successor=Object.freeze({...binding,runId:U(9)});
const scopes=Object.freeze([Object.freeze({tenantId:U(1),kind:'client',resourceId:U(7),policyRevision:'synthetic-policy'})]);
const custody={ownerInstanceId:U(8),hostId:U(9),generation:1,policySha256:'c'.repeat(64),expiresAtMs:2000,binding};
const handoff={to:U(9),custody};
const client={query:async()=>({rows:[]})};
const selection={siteId:'synthetic-site',workflowId:'synthetic-flow',version:2,manifestSha256:'b'.repeat(64)};

test('the saved request comes from the row, never from its projection',()=>{
 assert.equal(savedRequestOf({request:{siteWorkflow:{siteId:'s'}},projection:{binding}}).siteWorkflow.siteId,'s');
 assert.equal(savedRequestOf({projection:{request:{siteWorkflow:{}}}}),null,'a projection-level request is not the source');
 assert.equal(savedRequestOf(null),null);
});

/** A real allocation row built through the canonical record validator. */
function allocationRowFor(now,allocated=binding){
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:allocated.tenantId,conversationId:allocated.conversationId,
  generation:1,hostId:U(9),imageDigest:'sha256:'+'d'.repeat(64),leaseDeadlineMs:now+60000,hostMode:'browser-only'};
 const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef0',bootId:U(5),conversationId:allocated.conversationId,hostId:U(9)};
 const dns=hostClientDnsName(allocation);
 const endpoint={address:'10.0.0.5',port:8443,serverName:'host.synthetic.invalid',serverFingerprintSha256:'f'.repeat(64)};
 const record={allocation,originalBinding:allocated,hostIdentity,ownerInstanceId:U(8),endpoint,
  hostCertificate:{fingerprintSha256:'e'.repeat(64),dnsName:dns,notAfterMs:now+60000},serverCertificateNotAfterMs:now+60000};
 const row={host_id:U(9),generation:1,tenant_id:allocated.tenantId,conversation_id:allocated.conversationId,lease_deadline_ms:now+60000,
  allocation_json:allocation,allocation_sha256:hash(allocation),host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),
  record_sha256:hash(record),state:'active',credential_revision:1,client_cert_sha256:'e'.repeat(64),client_dns_name:dns,
  client_cert_not_after_ms:now+60000,server_cert_not_after_ms:now+60000,original_binding_json:allocated,owner_instance_id:U(8),endpoint_json:endpoint};
 assert.equal(allocationRow(row).state,'active','the row reconstitutes through the canonical validator');
 return {row,allocation};
}

/** Synthetic external boundaries; the run row itself is a real rowRun record from the lifecycle fixture. */
function sqlClient({runRow,allocationRowValue,seen}){
 return {async query(sql){
  if(sql.startsWith('SELECT * FROM meri_host_control.lock_allocation')){seen.push('allocation');return {rows:[allocationRowValue]};}
  if(sql.startsWith('SELECT pg_advisory_xact_lock')){seen.push('advisory');return {rows:[]};}
  if(sql.startsWith('SELECT * FROM meri_conversations.runs')){seen.push('runs');return {rows:[runRow]};}
  throw Error('unexpected SQL: '+sql);
 }};
}
function currentnessFor({runRow,allocationRowValue,now,state='running',scopesFor=scopes,bindingFor=binding,activation}){
 const seen=[];
 const core={async readCurrent(){return {principal:{tenantId:bindingFor.tenantId,actorId:bindingFor.actorId},role:'standard_user',permissions:[],
  clientIds:[scopesFor[0].resourceId],identityRevision:'1'.repeat(64),membershipRevision:'2'.repeat(64),contextRevision:'3'.repeat(64),
  conversationId:bindingFor.conversationId,selectedClientId:scopesFor[0].resourceId,checkedAtMs:now,expiresAtMs:now+30000};}};
 const store={executions:{async readCurrentOnClient(){return {binding:bindingFor,scopes:scopesFor,policyRevision:'synthetic-policy',deadlineMs:now+60000,
   executionSha256:'4'.repeat(64),executionPhase:'started',run:{state}};}},
  lifecycle:{browserCustody:{async currentHost(){throw Error('no custody in this fixture');}}}};
 const currentness=createBrowserHostCurrentness({store,core,
  nativeCredentials:{async nativeCredentialFor(){return {credential:'synthetic-native',expiresAtMs:now+30000};}},
  capabilityPolicy:{async forRun(){return {};}},readBrowserPolicy:async()=>validateBrowserPolicy(),...(activation?{activation}:{}),now:()=>now,maxRequestMs:3000});
 return {currentness,seen,client:sqlClient({runRow,allocationRowValue,seen})};
}

test('real readFacts keeps row.request as the saved selection while readHost keeps its closed shape',async()=>{
 const lifecycle=await lifecycleFixture({browserSessions:true});
 try{
  await lifecycle.running();
  const saved=await lifecycle.store.read(fixtureBinding,{},()=>{});
  const runRow={tenant_id:fixtureBinding.tenantId,conversation_id:fixtureBinding.conversationId,run_id:fixtureBinding.runId,
   request_id:saved.request.requestId,projection:saved.run,projection_sha256:hash(saved.run),request:saved.request,
   request_sha256:hash(saved.request),last_sequence:Number(saved.lastSequence),hold_control_id:null};
  const now=Date.now(),{row,allocation}=allocationRowFor(now,fixtureBinding);
  const rtBinding=saved.run.binding;
  const rtScopes=[{tenantId:rtBinding.tenantId,kind:'client',resourceId:U(7),policyRevision:'synthetic-policy'}];
  const fixture=currentnessFor({runRow,allocationRowValue:row,now,scopesFor:rtScopes,bindingFor:rtBinding});

  const facts=await fixture.currentness.readFacts(fixture.client,{allocation:allocation,binding:rtBinding});
  assert.deepEqual(fixture.seen,['allocation','advisory','runs'],'the facts read runs on the supplied transaction client');
  assert.deepEqual(facts.savedRequest,saved.request,'the saved request comes from the ROW, not from projection');
  assert.deepEqual(facts.scopes,rtScopes,'scopes come from the canonical execution read boundary');
  assert.equal(facts.browserAdmitted,false,'no configured activation record, so browser admission is truthfully false');
  const open=currentnessFor({runRow,allocationRowValue:row,now,scopesFor:rtScopes,bindingFor:rtBinding,
   activation:compileBrowserActivation({state:'open',evidence:'docs/qualification/browser-egress/record.md',evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256,renderVerification:{schema:BROWSER_ACTIVATION_RENDER_VERIFICATION,sourceCommit:'0'.repeat(40),renderedAtMs:1,evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256}})});
  const admitted=await open.currentness.readFacts(open.client,{allocation:allocation,binding:rtBinding});
  assert.equal(admitted.browserAdmitted,true,'the same read admits the browser under control\'s open record');
  assert.equal(admitted.sdkAdmitted,true);assert.deepEqual(admitted.browserPolicy,facts.browserPolicy);
  assert.equal(facts.sdkAdmitted,true);
  assert.ok(facts.browserPolicy,'the current browser policy value is present');
  assert.ok(facts.capabilityPolicy);
  assert.equal(facts.originalBinding.tenantId,rtBinding.tenantId);

  const host=await fixture.currentness.readHost(fixture.client,{allocation:allocation,binding:rtBinding});
  assert.equal(Object.hasOwn(host,'savedRequest'),false,'readHost keeps its closed response');
  assert.equal(Object.hasOwn(host,'scopes'),false);
  assert.equal(Object.hasOwn(host,'browserPolicy'),false);

  // Activation is held in source, so the facts producer refuses rather than fabricating admission.
  await assert.rejects(createBrowserHostRunFacts({currentness:fixture.currentness}).readCanonicalFacts(fixture.client,
   {allocation,binding:rtBinding}),{code:'BROWSER_HOST_FACTS_REFUSED'});

  // A stale allocation lease refuses before any fact is produced.
  const stale=currentnessFor({runRow,allocationRowValue:{...row,lease_deadline_ms:now+1000},now:now+120000,scopesFor:rtScopes,bindingFor:rtBinding});
  await assert.rejects(stale.currentness.readFacts(stale.client,{allocation,binding:rtBinding}));

  // A binding outside the allocated conversation refuses.
  await assert.rejects(fixture.currentness.readFacts(fixture.client,{allocation,binding:{...rtBinding,conversationId:U(12)}}));
 }finally{lifecycle.close();}
});

test('a held run yields truthful facts: browser custody only, SDK and Bash denied',async()=>{
 const state={phase:'browser-held',browserAdmitted:true,sdkAdmitted:false,bashAdmitted:false,currentUntilMs:900,deadlineMs:1000,
  scopes,originalBinding:binding,browserCustody:custody,browserHandoff:handoff,browserPolicy:validateBrowserPolicy(),savedRequest:{siteWorkflow:selection}};
 const doc=await createBrowserHostRunFacts({currentness:{readFacts:async()=>state}}).readCanonicalFacts(client,{allocation:{},binding});
 assert.equal(doc.phase,'browser-held');
 assert.deepEqual(doc.admitted,{sdk:false,bash:false,browser:true},'a held run never claims SDK admission');
 assert.equal(Object.hasOwn(doc,'capabilityPolicy'),false,'no capability policy is claimed for a held run');
 assert.deepEqual(doc.browserCustody,custody,'custody comes from the canonical chain');
 assert.deepEqual(doc.browserHandoff,handoff);
 assert.deepEqual(doc.siteWorkflow,selection);
 assert.deepEqual(assertBrowserHostFacts(JSON.parse(JSON.stringify(doc))),doc,'held facts re-validate');
 assert.equal(browserHostFactsDigest(doc),hash(doc));
});

test('a successor run keeps browser custody of the same site workflow selection it must adopt',async()=>{
 const state={phase:'browser-successor',browserAdmitted:true,sdkAdmitted:false,bashAdmitted:false,currentUntilMs:900,deadlineMs:1000,
  scopes,originalBinding:binding,browserCustody:custody,browserHandoff:handoff,browserPolicy:validateBrowserPolicy(),savedRequest:{siteWorkflow:selection}};
 const doc=await createBrowserHostRunFacts({currentness:{readFacts:async()=>state}}).readCanonicalFacts(client,{allocation:{},binding:successor});
 assert.equal(doc.phase,'browser-successor');
 // The host adopts custody only under an identical manifest, so a successor without the selection could never
 // resume a signed-in workflow; the selection grants nothing (the host re-resolves it for the successor binding).
 assert.deepEqual(doc.siteWorkflow,selection,'the conversation selection travels with custody to the successor');
 assert.deepEqual(doc.admitted,{sdk:false,bash:false,browser:true});
 const plain={...state,savedRequest:{}};
 const none=await createBrowserHostRunFacts({currentness:{readFacts:async()=>plain}}).readCanonicalFacts(client,{allocation:{},binding:successor});
 assert.equal(Object.hasOwn(none,'siteWorkflow'),false,'no selection is invented for an ordinary run');
});

test('a held state cannot masquerade as active and the wire refuses a policy on held facts',async()=>{
 const fakeActive={phase:'browser-held',browserAdmitted:true,sdkAdmitted:true,bashAdmitted:false,currentUntilMs:900,deadlineMs:1000,scopes,originalBinding:binding};
 await assert.rejects(createBrowserHostRunFacts({currentness:{readFacts:async()=>fakeActive}}).readCanonicalFacts(client,{allocation:{},binding}),{code:'BROWSER_HOST_FACTS_REFUSED'});
 const noCustody={phase:'browser-held',browserAdmitted:false,sdkAdmitted:false,bashAdmitted:false,currentUntilMs:900,deadlineMs:1000,scopes,originalBinding:binding};
 await assert.rejects(createBrowserHostRunFacts({currentness:{readFacts:async()=>noCustody}}).readCanonicalFacts(client,{allocation:{},binding}),{code:'BROWSER_HOST_FACTS_REFUSED'});
 // An "active" state without the current policy values is refused (by the shared policy validator or the
 // facts guard) — it can never be advertised as an admitted run.
 const activeNoPolicy={phase:'active',browserAdmitted:true,sdkAdmitted:false,bashAdmitted:false,currentUntilMs:900,deadlineMs:1000,scopes,originalBinding:binding};
 await assert.rejects(createBrowserHostRunFacts({currentness:{readFacts:async()=>activeNoPolicy}}).readCanonicalFacts(client,{allocation:{},binding}),
  error=>['BROWSER_HOST_FACTS_REFUSED','BROWSER_POLICY'].includes(error.code));
 assert.throws(()=>assertBrowserHostFacts({schema:BROWSER_HOST_FACTS_SCHEMA,binding,scopes,deadlineMs:1000,currentUntilMs:900,
  phase:BROWSER_HOST_FACT_PHASES[1],admitted:{sdk:false,bash:false,browser:true},capabilityPolicy:{}}),{code:'BROWSER_HOST_FACTS_REFUSED'});
});

test('the pause/APPLIED hold is exactly the state the held projection keys on',async()=>{
 const lifecycle=await lifecycleFixture({browserSessions:true});
 try{
  await lifecycle.running();
  const controlId=id(930);
  await lifecycle.control({controlId,intent:'takeover.begin'});
  await lifecycle.claim(controlId);
  const applied=await lifecycle.checkpoint(controlId,{schema:'meri-browser-custody/1',binding:fixtureBinding,controlId,
   ownerInstanceId:id(932),hostId:id(933),generation:1,leaseEpoch:1,policySha256:'a'.repeat(64),expiresAtMs:Date.now()+60000});
  assert.equal(applied.state,'APPLIED','the checkpoint is APPLIED before any retainTakeover read');
  const saved=await lifecycle.store.read(fixtureBinding,{},()=>{});
  assert.equal(saved.run.state,'paused','the run is paused, which is the held branch precondition');
  const takeover=await lifecycle.service.readTakeover({credential:lifecycle.credential});
  assert.equal(takeover.state,'held','the canonical retained custody is advertised, so the held branch is reachable');
  assert.deepEqual(takeover.custody,applied.custody??takeover.custody,'the held custody is the APPLIED checkpoint custody');
 }finally{lifecycle.close();}
});

test('the live workflow port resolves through the real Core admission owner with the saved selection',async()=>{
 const calls=[];
 const store={read:async()=>({run:{binding,scopes,versions:{synthetic:1}},request:{siteWorkflow:selection}})};
 const admission={resolve:async(input)=>{calls.push(input);return {manifest:{synthetic:true},manifestSha256:'a'.repeat(64),enabled:true};}};
 const port=createBrowserHostSiteWorkflowPort({store,admission});
 assert.equal(Object.hasOwn(binding,'scopes'),false,'a RunBinding has no scopes');
 const first=await port.resolve({binding});
 await port.resolve({binding});
 assert.equal(calls.length,2,'each resolve re-reads and re-resolves');
 assert.deepEqual(calls[0].selection,selection,'the SAVED selection is passed to the Core owner');
 assert.deepEqual(calls[0].scopes,scopes);assert.deepEqual(calls[0].versions,{synthetic:1});
 assert.equal(Object.hasOwn(calls[0],'credential'),false,'no credential is placed in the admission input');
 assert.equal(first.enabled,true);
 assert.throws(()=>createBrowserHostSiteWorkflowPort({store,admission:{}}),{code:'BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE'});
});

test('a changed saved selection or scope refuses as SESSION_CHANGED',async()=>{
 const admission={resolve:async()=>({manifest:{},manifestSha256:'a'.repeat(64),enabled:true})};
 // The port reads the row twice per resolve; a selection change between those reads must refuse.
 let reads=0;
 const changingStore={async read(){const changed=reads++>0;
  return {run:{binding,scopes,versions:{synthetic:1}},request:{siteWorkflow:changed?{...selection,version:3}:selection}};}};
 const changing=createBrowserHostSiteWorkflowPort({admission,store:changingStore});
 await assert.rejects(changing.resolve({binding}),{code:'BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE'});
 let scopeReads=0;
 const scopeStore={async read(){const widened=scopeReads++>0;
  return {run:{binding,scopes:widened?[]:scopes,versions:{synthetic:1}},request:{siteWorkflow:selection}};}};
 const scopeChange=createBrowserHostSiteWorkflowPort({admission,store:scopeStore});
 await assert.rejects(scopeChange.resolve({binding}),{code:'BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE'});

 const empty=createBrowserHostSiteWorkflowPort({admission,store:{read:async()=>({run:{binding,scopes,versions:{}},request:{}})}});
 await assert.rejects(empty.resolve({binding}),{code:'BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE'},'a run without a saved selection cannot resolve');
});
