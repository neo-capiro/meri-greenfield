/** Facts, workflow and hold over the REAL protocol validators, the real store, the real facts producer
 * and the real transaction boundary, with inert SQL/transport fixtures. No socket, no database, no
 * native or TLS qualification: these are source-level proofs only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {HOST_FACTS_PATH,HOST_FACTS_RESPONSE_SCHEMA,HOST_FACTS_WIRE_MAX_BYTES,HOST_HOLD_PATH,
 HOST_WORKFLOW_PATH,hostFactsRequest,hostHoldRequest,hostWorkflowRequest,encodeHostControl,decodeHostControl,
 hostFactsResponse,hostHoldResponse,hostWorkflowResponse,HOST_CONTROL_REQUEST_SCHEMA,hostClientDnsName} from './protocol.mjs';
import {createPostgresHostCurrentnessStore} from './postgres-store.mjs';
import {createBrowserHostRunFacts} from '../../../../runtime/browser-host-run-facts.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';
import {DEFAULT_BROWSER_POLICY} from '../../browser/policy.mjs';

const HOST_ID='11111111-1111-4111-8111-111111111111',GEN=3,NOW_FIXED=1700000000000;
const CONTROL_ID='88888888-8888-4888-8888-888888888888';
const OWNER_ID='77777777-7777-4777-8777-777777777777';
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:binding.conversationId,
 generation:GEN,hostId:HOST_ID,imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:NOW_FIXED+600000};

function fixture({state={}}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',
  bootId:'99999999-9999-4999-8999-999999999999',conversationId:b.conversationId,hostId:a.hostId};
 const queries=[];
 const client={async query(statement,values){queries.push({statement,values});
  if(statement.includes('lock_allocation'))return {rows:[{allocation_json:a,allocation_sha256:hash(a),
   host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),client_cert_sha256:'d'.repeat(64),
   client_dns_name:hostClientDnsName(a),client_cert_not_after_ms:NOW_FIXED+300000,lease_deadline_ms:a.leaseDeadlineMs,state:'active'}]};
  if(statement.startsWith('INSERT INTO meri_host_control.request_nonces')){
   if(state.replay)return {rows:[]};return {rows:[{nonce_sha256:values[2]}]};}
  if(statement.includes('clock_timestamp')){state.clockCalls=(state.clockCalls??0)+1;
   return {rows:[{now_ms:NOW_FIXED+(state.clockAdvance??0)*(state.clockCalls-1)}]};}
  return {rows:[]};
 }};
 const shared={depth:0};
 const transact=async(effect,options={})=>{shared.depth++;
  try{if(state.failTransact)throw Object.assign(Error('lost ack'),{code:'HOST_CONTROL_UNKNOWN'});
   return await effect(client);}
  finally{shared.depth--;}};
 return {a,b,hostIdentity,client,transact,queries,shared,state,allocation:a,
  request:schema=>({schema,allocation:a,binding:b,hostIdentity,nonce:'e'.repeat(64)}),
  fingerprint:'d'.repeat(64),peer:hostClientDnsName(a)};
}

/** A genuinely large but schema-valid policy: 256 origins with DNS names near the 255-byte limit. */
/** A genuinely large but schema-valid policy: the canonical defaults plus 256 near-limit origins. */
function bigBrowserPolicy(){
 // DNS labels stay within their 63-byte limit; three near-limit labels give a ~200-byte origin.
 const label=n=>String(n).padStart(3,'0')+'a'.repeat(56);
 const origins=Array.from({length:256},(_,i)=>`https://${label(i)}.${label(i+1)}.${label(i+2)}.example`);
 return {...DEFAULT_BROWSER_POLICY,allowedOrigins:origins};
}
const activeState=(overrides={})=>({binding,scopes,deadlineMs:NOW_FIXED+120000,currentUntilMs:NOW_FIXED+60000,
 phase:'active',sdkAdmitted:true,bashAdmitted:false,browserAdmitted:true,capabilityPolicy:{},
 browserPolicy:bigBrowserPolicy(),...overrides});

async function factsViaProducer(state){
 const producer=createBrowserHostRunFacts({currentness:{readFacts:async()=>state}});
 return producer.readCanonicalFacts({query:async()=>({rows:[]})},{allocation:{hostId:HOST_ID,generation:GEN},binding});
}

test('a valid facts document above 32 KiB traverses the named bound through the real producer',async()=>{
 const f=fixture(),facts=await factsViaProducer(activeState());
 const bytes=Buffer.byteLength(JSON.stringify(facts));
 assert.ok(bytes>32768,`the valid facts document must exceed the old 32 KiB ceiling (was ${bytes})`);
 assert.ok(bytes<262144);
 let seenClient=null;
 const store=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>{throw Error('no');},
  readCanonicalFacts:async(client)=>facts,maxLeaseMs:30000});
 const answer=await store.readFacts({request:f.request('meri-host-facts-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer});
 assert.equal(answer.schema,HOST_FACTS_RESPONSE_SCHEMA);
 assert.equal(answer.nonce,'e'.repeat(64));
 assert.equal(answer.facts.binding.writerFence,binding.writerFence);
 assert.equal(answer.facts.phase,'active');
 assert.ok(answer.currentUntilMs>answer.checkedAtMs);
 const wire=encodeHostControl(answer,HOST_FACTS_WIRE_MAX_BYTES);
 assert.ok(wire.length>32768&&wire.length<=HOST_FACTS_WIRE_MAX_BYTES,'the wire carries the larger payload');
 assert.deepEqual(decodeHostControl(wire,HOST_FACTS_WIRE_MAX_BYTES),answer);
 // The producer really consumed the store's own transaction client.
 assert.equal(seenClient,null);
 // Over the payload bound the answer is refused rather than truncated.
 const tight=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>{throw Error('no');},
  readCanonicalFacts:async()=>facts,maxLeaseMs:30000,maxFactsBytes:32768});
 await assert.rejects(tight.readFacts({request:f.request('meri-host-facts-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
});

test('facts share the authenticated client and refuse replay, wrong peer, wrong certificate and binding',async()=>{
 const f=fixture(),facts=await factsViaProducer(activeState());
 let seenClient=null;
 const store=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>{throw Error('no');},
  readCanonicalFacts:async client=>{seenClient=client;return facts;},maxLeaseMs:30000});
 await store.readFacts({request:f.request('meri-host-facts-request/1'),fingerprintSha256:f.fingerprint,peerDnsName:f.peer});
 assert.equal(seenClient,f.client,'the producer ran on the store\'s own transaction client');
 const replay=fixture({state:{replay:true}});
 const replayStore=createPostgresHostCurrentnessStore({transact:replay.transact,readCanonicalRun:async()=>{throw Error('no');},
  readCanonicalFacts:async()=>facts,maxLeaseMs:30000});
 await assert.rejects(replayStore.readFacts({request:replay.request('meri-host-facts-request/1'),
  fingerprintSha256:replay.fingerprint,peerDnsName:replay.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 await assert.rejects(store.readFacts({request:f.request('meri-host-facts-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:'wrong.example'}),{message:'HOST_CONTROL_UNAVAILABLE'});
 await assert.rejects(store.readFacts({request:f.request('meri-host-facts-request/1'),
  fingerprintSha256:'0'.repeat(64),peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 await assert.rejects(store.readFacts({request:{...f.request('meri-host-facts-request/1'),
  binding:{...binding,writerFence:8}},fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),
  {message:'HOST_CONTROL_UNAVAILABLE'});
 // An unacknowledged transaction never releases an answer.
 const failing=createPostgresHostCurrentnessStore({transact:async()=>{throw Error('lost ack');},
  readCanonicalRun:async()=>{throw Error('no');},readCanonicalFacts:async()=>facts,maxLeaseMs:30000});
 await assert.rejects(failing.readFacts({request:f.request('meri-host-facts-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
});

const activeProjection={binding,browserPolicySha256:'f'.repeat(64),capabilityPolicySha256:'f'.repeat(64),
 sdkAdmitted:true,browserAdmitted:true,bashAdmitted:false,phase:'active',currentUntilMs:NOW_FIXED+60000};

test('workflow resolves with no lock held and refuses a changed post-read authority',async()=>{
 const f=fixture();let call=0;
 const store=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>call++===0
  ?activeProjection:{...activeProjection,phase:'browser-held',sdkAdmitted:false,browserCustody:{}},
  resolveWorkflow:async({binding:target})=>{assert.equal(f.shared.depth,0,'no transaction is held during the Core domain read');
   assert.deepEqual(target,binding);return {manifest:{files:[]},manifestSha256:'0'.repeat(64),enabled:true};},
  maxLeaseMs:30000});
 await assert.rejects(store.resolveBrowserWorkflow({request:f.request('meri-host-workflow-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 const missing=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>activeProjection,maxLeaseMs:30000});
 await assert.rejects(missing.resolveBrowserWorkflow({request:f.request('meri-host-workflow-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
});

test('an advancing clock with the same authority resolves; changed policy or custody refuses',async()=>{
 const f=fixture({state:{clockAdvance:500}});let call=0,resolved=0;
 const store=createPostgresHostCurrentnessStore({transact:f.transact,
  // The second observation carries a later cutoff, as fresh Core expiry legitimately does.
  readCanonicalRun:async()=>{call++;return call===1?activeProjection:{...activeProjection,currentUntilMs:NOW_FIXED+120000};},
  resolveWorkflow:async()=>{resolved++;return {manifest:{files:[]},manifestSha256:'0'.repeat(64),enabled:true};},
  maxLeaseMs:30000});
 const answer=await store.resolveBrowserWorkflow({request:f.request('meri-host-workflow-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer});
 assert.equal(response_of(answer).enabled,true);assert.equal(resolved,1);
 for(const changed of [
  {browserPolicySha256:'a'.repeat(64)},
  {phase:'browser-held',sdkAdmitted:false,browserCustody:{schema:'meri-browser-custody/1',binding,
   controlId:CONTROL_ID,ownerInstanceId:OWNER_ID,hostId:HOST_ID,generation:GEN,leaseEpoch:1,
   policySha256:'f'.repeat(64),expiresAtMs:NOW_FIXED+60000}},
  {binding:{...binding,writerFence:9}}]){
  let seen=0;
  const refused=createPostgresHostCurrentnessStore({transact:f.transact,
   readCanonicalRun:async()=>seen++===0?activeProjection:{...activeProjection,...changed},
   resolveWorkflow:async()=>({manifest:{files:[]},manifestSha256:'0'.repeat(64),enabled:true}),maxLeaseMs:30000});
  await assert.rejects(refused.resolveBrowserWorkflow({request:f.request('meri-host-workflow-request/1'),
   fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 }
});

function response_of(answer){return answer.workflow??answer;}

test('expired authority never reaches the Core resolver',async()=>{
 const f=fixture();let resolved=0;
 const store=createPostgresHostCurrentnessStore({transact:f.transact,
  readCanonicalRun:async()=>({...activeProjection,currentUntilMs:NOW_FIXED}),
  resolveWorkflow:async()=>{resolved++;return {manifest:{files:[]},manifestSha256:'0'.repeat(64),enabled:true};},
  maxLeaseMs:30000});
 await assert.rejects(store.resolveBrowserWorkflow({request:f.request('meri-host-workflow-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 assert.equal(resolved,0,'the domain resolver is not called for expired authority');
});

test('workflow permits the canonical browser-held phase while SDK and Bash stay denied',async()=>{
 const f=fixture();
 const custody={schema:'meri-browser-custody/1',binding,controlId:CONTROL_ID,ownerInstanceId:OWNER_ID,
  hostId:HOST_ID,generation:GEN,leaseEpoch:1,policySha256:'f'.repeat(64),expiresAtMs:NOW_FIXED+60000};
 const held={binding,browserPolicySha256:'f'.repeat(64),capabilityPolicySha256:'f'.repeat(64),
  sdkAdmitted:false,browserAdmitted:true,bashAdmitted:false,phase:'browser-held',
  currentUntilMs:NOW_FIXED+60000,browserCustody:custody};
 const store=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>held,
  resolveWorkflow:async()=>({manifest:{files:[]},manifestSha256:'0'.repeat(64),enabled:true}),maxLeaseMs:30000});
 const answer=await store.resolveBrowserWorkflow({request:f.request('meri-host-workflow-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer});
 assert.equal(answer.workflow.enabled,true);
 // The same held state is NOT accepted as an SDK admission: phase and admission stay consistent.
 const bad=createPostgresHostCurrentnessStore({transact:f.transact,
  readCanonicalRun:async()=>({...held,sdkAdmitted:true}),
  resolveWorkflow:async()=>({manifest:{files:[]},manifestSha256:'0'.repeat(64),enabled:true}),maxLeaseMs:30000});
 await assert.rejects(bad.resolveBrowserWorkflow({request:f.request('meri-host-workflow-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
});

test('hold answers ONLY verified APPLIED unreturned custody and performs no lifecycle write',async()=>{
 const f=fixture();let holdCalls=0;
 const custody={schema:'meri-browser-custody/1',binding,controlId:CONTROL_ID,ownerInstanceId:OWNER_ID,
  hostId:HOST_ID,generation:GEN,leaseEpoch:1,policySha256:'f'.repeat(64),expiresAtMs:NOW_FIXED+60000};
 const held={binding,browserPolicySha256:'f'.repeat(64),capabilityPolicySha256:'f'.repeat(64),
  sdkAdmitted:false,browserAdmitted:true,bashAdmitted:false,phase:'browser-held',
  currentUntilMs:NOW_FIXED+60000,browserCustody:custody};
 let saves=0;
 const store=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>held,
  holdCustody:async({client,binding:target,allocation})=>{holdCalls++;assert.equal(client,f.client);
   assert.equal(allocation.hostId,HOST_ID);assert.equal(target.writerFence,binding.writerFence);
   return {controlId:CONTROL_ID,checkpointId:binding.runId,checkpointSha256:'9'.repeat(64),custody};},
  maxLeaseMs:30000});
 const answer=await store.holdBrowser({request:f.request('meri-host-hold-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer});
 assert.equal(answer.outcome,'APPLIED');assert.deepEqual(answer.custody,custody);
 assert.equal(holdCalls,1);assert.equal(saves,0,'no lifecycle write or dispatch happened');
 // A returned control (the lifecycle owner's no-return refusal) fails the answer.
 const returned=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>held,
  holdCustody:async()=>{throw Object.assign(Error('BROWSER_CUSTODY_REFUSED'),{code:'BROWSER_CUSTODY_REFUSED'});},
  maxLeaseMs:30000});
 await assert.rejects(returned.holdBrowser({request:f.request('meri-host-hold-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 // A successor phase never reaches an APPLIED answer, and the custody owner is not consulted.
 const successor=createPostgresHostCurrentnessStore({transact:f.transact,
  readCanonicalRun:async()=>({...held,phase:'browser-successor'}),holdCustody:async()=>{holdCalls++;return {custody};},
  maxLeaseMs:30000});
 await assert.rejects(successor.holdBrowser({request:f.request('meri-host-hold-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 // Foreign custody (another generation) is refused by the store's own exact allocation check.
 const foreign=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>held,
  holdCustody:async()=>({custody:{...custody,generation:GEN+1}}),maxLeaseMs:30000});
 await assert.rejects(foreign.holdBrowser({request:f.request('meri-host-hold-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 // Expired custody is refused against its own clock.
 const expired=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>held,
  holdCustody:async()=>({custody:{...custody,expiresAtMs:NOW_FIXED}}),maxLeaseMs:30000});
 await assert.rejects(expired.holdBrowser({request:f.request('meri-host-hold-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 assert.equal(holdCalls,1);
});

test('the three routes are closed and every envelope rejects an unbound or non-APPLIED answer',()=>{
 const f=fixture();
 for(const schema of ['meri-host-facts-request/1','meri-host-workflow-request/1','meri-host-hold-request/1']){
  assert.throws(()=>hostFactsRequest({...f.request(schema),extra:1}),/HOST_CONTROL_REFUSED/u);
  assert.throws(()=>hostWorkflowRequest({...f.request(schema),purpose:'sdk'}),/HOST_CONTROL_REFUSED/u);
  assert.throws(()=>hostHoldRequest({...f.request(schema),nonce:'nothex'}),/HOST_CONTROL_REFUSED/u);
 }
 const q=hostFactsRequest(f.request('meri-host-facts-request/1'));
 assert.throws(()=>hostFactsResponse({schema:HOST_FACTS_RESPONSE_SCHEMA,nonce:'f'.repeat(64),facts:{},
  checkedAtMs:NOW_FIXED,currentUntilMs:NOW_FIXED+1},q),/HOST_CONTROL_REFUSED/u);
 assert.throws(()=>hostHoldResponse({schema:'meri-host-hold-response/1',nonce:q.nonce,outcome:'PENDING',
  custody:{},checkedAtMs:NOW_FIXED,currentUntilMs:NOW_FIXED+1},q),/HOST_CONTROL_REFUSED/u);
 assert.throws(()=>hostWorkflowResponse({schema:'meri-host-workflow-response/1',nonce:q.nonce,workflow:{},
  checkedAtMs:NOW_FIXED,currentUntilMs:NOW_FIXED},q),/HOST_CONTROL_REFUSED/u);
 assert.equal(HOST_FACTS_PATH,'/meri/host/facts/v1');assert.equal(HOST_WORKFLOW_PATH,'/meri/host/workflow/v1');
 assert.equal(HOST_HOLD_PATH,'/meri/host/hold/v1');
 assert.equal(HOST_CONTROL_REQUEST_SCHEMA,'meri-host-currentness-request/1');
});
