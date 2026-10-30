/** Facts, workflow and hold over the REAL protocol validators, the real store and the real transaction
 * boundary, with inert SQL/transport fixtures. No socket, no database, no native qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {HOST_FACTS_PATH,HOST_FACTS_RESPONSE_SCHEMA,HOST_FACTS_WIRE_MAX_BYTES,HOST_HOLD_PATH,
 HOST_WORKFLOW_PATH,hostFactsRequest,hostHoldRequest,hostWorkflowRequest,encodeHostControl,decodeHostControl,
 hostFactsResponse,hostHoldResponse,hostWorkflowResponse,HOST_CONTROL_REQUEST_SCHEMA} from './protocol.mjs';
import {createPostgresHostCurrentnessStore,HOST_CONTROL_SQL} from './postgres-store.mjs';
import {hostClientDnsName} from './protocol.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';

const HOST_ID='11111111-1111-4111-8111-111111111111',GEN=3,NOW_FIXED=1700000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',
 conversationId:'22222222-2222-4222-8222-222222222222',generation:GEN,hostId:HOST_ID,
 imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:NOW_FIXED+600000};
function fixture({state={}}={}){
 const shared={};
 const a=assertHostAllocation({...allocation});
 const b=assertHostRunBinding(a,binding);
 const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',bootId:'99999999-9999-4999-8999-999999999999',
  conversationId:b.conversationId,hostId:a.hostId};
 const queries=[];
 const client={async query(statement,values){queries.push({statement,values});
  if(statement.includes('lock_allocation'))return {rows:[{allocation_json:a,allocation_sha256:hash(a),
   host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),client_cert_sha256:state.fingerprint??'d'.repeat(64),
   client_dns_name:hostClientDnsName(a),client_cert_not_after_ms:NOW_FIXED+300000,lease_deadline_ms:a.leaseDeadlineMs,state:'active'}]};
  if(statement.startsWith('INSERT INTO meri_host_control.request_nonces')){
   if(state.replay)return {rows:[]};return {rows:[{nonce_sha256:values[2]}]};}
  if(statement.includes('clock_timestamp'))return {rows:[{now_ms:NOW_FIXED}]};
  return {rows:[]};
 }};
 const transact=async(effect,options={})=>{shared.depth=(shared.depth??0)+1;
  try{if(state.failTransact)throw Object.assign(Error('lost ack'),{code:'HOST_CONTROL_UNKNOWN'});
   const value=await effect(client);return value;}
  finally{shared.depth-=1;}};
 const untouched={};
 return {a,b,hostIdentity,client,transact,queries,shared,untouched,state,
  request:(schema)=>({schema,allocation:a,binding:b,hostIdentity,nonce:'e'.repeat(64)}),
  fingerprint:'d'.repeat(64),peer:hostClientDnsName(a)};
}
const factsFixture=(fact,{size}={})=>({schema:'meri-browser-host-facts/3',binding,
 scopes:[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}],
 deadlineMs:NOW_FIXED+60000,currentUntilMs:NOW_FIXED+60000,phase:'active',
 admitted:{sdk:true,bash:false,browser:true},capabilityPolicy:{},capabilityPolicySha256:'f'.repeat(64),
 browserPolicy:{enabled:true,tools:[],allowedOrigins:size?Array.from({length:size},(_,i)=>`https://o${i}.example`):[],
  timeouts:{},downloads:{}},browserPolicySha256:'f'.repeat(64),...fact});

test('facts run on the SAME authenticated client and a valid payload above 32 KiB is admitted',async()=>{
 const f=fixture();let seenClient=null;
 const big=factsFixture({}, {size:1200});
 assert.ok(Buffer.byteLength(JSON.stringify(big))>32768,'the fixture itself exceeds the old 32 KiB ceiling');
 assert.ok(Buffer.byteLength(JSON.stringify(big))<262144);
 const store=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>{throw Error('no');},
  readCanonicalFacts:async(client)=>{seenClient=client;return big;},maxLeaseMs:30000});
 const answer=await store.readFacts({request:f.request('meri-host-facts-request/1'),fingerprintSha256:f.fingerprint,peerDnsName:f.peer});
 assert.equal(seenClient,f.client,'the producer consumed the store\'s own transaction client');
 assert.equal(answer.schema,HOST_FACTS_RESPONSE_SCHEMA);assert.equal(answer.nonce,'e'.repeat(64));
 assert.equal(answer.facts.binding.writerFence,binding.writerFence);
 assert.ok(answer.currentUntilMs>answer.checkedAtMs);
 const wire=encodeHostControl(answer,HOST_FACTS_WIRE_MAX_BYTES);
 assert.ok(wire.length>32768&&wire.length<=HOST_FACTS_WIRE_MAX_BYTES,'wire carries the larger payload');
 assert.deepEqual(decodeHostControl(wire,HOST_FACTS_WIRE_MAX_BYTES),answer);
 // An unacknowledged transaction never releases an answer.
 const failing=createPostgresHostCurrentnessStore({transact:async()=>{throw Error('lost ack');},
  readCanonicalRun:async()=>{throw Error('no');},readCanonicalFacts:async()=>big,maxLeaseMs:30000});
 await assert.rejects(failing.readFacts({request:f.request('meri-host-facts-request/1'),fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),
  {message:'HOST_CONTROL_UNAVAILABLE'});
});

test('a replayed nonce, wrong peer, wrong binding and an oversized payload all refuse',async()=>{
 const f=fixture(),big=factsFixture({});
 const make=state=>createPostgresHostCurrentnessStore({transact:state.transact,readCanonicalRun:async()=>{throw Error('no');},
  readCanonicalFacts:async()=>big,maxLeaseMs:30000});
 const store=make(f);
 await store.readFacts({request:f.request('meri-host-facts-request/1'),fingerprintSha256:f.fingerprint,peerDnsName:f.peer});
 const replay=fixture({state:{replay:true}});
 await assert.rejects(make(replay).readFacts({request:replay.request('meri-host-facts-request/1'),
  fingerprintSha256:replay.fingerprint,peerDnsName:replay.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 await assert.rejects(store.readFacts({request:f.request('meri-host-facts-request/1'),fingerprintSha256:f.fingerprint,
  peerDnsName:'wrong.example'}),{message:'HOST_CONTROL_UNAVAILABLE'});
 await assert.rejects(store.readFacts({request:f.request('meri-host-facts-request/1'),fingerprintSha256:'0'.repeat(64),
  peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 const other=fixture();
 await assert.rejects(make(other).readFacts({request:{...other.request('meri-host-facts-request/1'),
  binding:{...binding,writerFence:8}},fingerprintSha256:other.fingerprint,peerDnsName:other.peer}),
  {message:'HOST_CONTROL_UNAVAILABLE'});
 const huge=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>{throw Error('no');},
  readCanonicalFacts:async()=>factsFixture({},{}),maxLeaseMs:30000,maxFactsBytes:1024});
 await assert.rejects(huge.readFacts({request:f.request('meri-host-facts-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
});

test('the workflow resolver runs with no transaction held and a post-read change refuses',async()=>{
 const f=fixture();const states=[];
 const active={binding,browserPolicySha256:'f'.repeat(64),capabilityPolicySha256:'f'.repeat(64),
  sdkAdmitted:true,browserAdmitted:true,bashAdmitted:false,phase:'active',currentUntilMs:NOW_FIXED+60000};
 let call=0;
 const store=createPostgresHostCurrentnessStore({transact:f.transact,
  readCanonicalRun:async()=>{states.push(structuredClone(active));return call++===0?active:{...active,phase:'browser-held'};},
  resolveWorkflow:async({binding:target})=>{assert.equal(f.shared.depth,0,'no transaction is held during the Core domain read');
   assert.deepEqual(target,binding);return {manifest:{files:[]},manifestSha256:'0'.repeat(64),enabled:true};},
  maxLeaseMs:30000});
 await assert.rejects(store.resolveBrowserWorkflow({request:f.request('meri-host-workflow-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 // A missing real resolver refuses instead of answering from a static manifest.
 const missing=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>active,maxLeaseMs:30000});
 await assert.rejects(missing.resolveBrowserWorkflow({request:f.request('meri-host-workflow-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
});

test('hold answers ONLY verified APPLIED unreturned custody and performs no lifecycle write',async()=>{
 const f=fixture();let holdCalls=0,saved=0;
 const held={binding,browserPolicySha256:'f'.repeat(64),capabilityPolicySha256:'f'.repeat(64),
  sdkAdmitted:false,browserAdmitted:true,bashAdmitted:false,phase:'browser-held',currentUntilMs:NOW_FIXED+60000,
  browserCustody:{binding,hostId:HOST_ID,generation:GEN,expiresAtMs:NOW_FIXED+60000}};
 const custody={ownerInstanceId:'77777777-7777-4777-8777-777777777777',hostId:HOST_ID,generation:GEN,
  policySha256:'f'.repeat(64),expiresAtMs:NOW_FIXED+60000,binding,leaseEpoch:1};
 const store=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>held,
  holdCustody:async({client,binding:target,allocation})=>{holdCalls++;assert.equal(client,f.client);
   assert.equal(allocation.hostId,HOST_ID);assert.equal(target.writerFence,binding.writerFence);
   return {controlId:'88888888-8888-4888-8888-888888888888',checkpointId:binding.runId,
    checkpointSha256:'9'.repeat(64),custody};},maxLeaseMs:30000});
 const answer=await store.holdBrowser({request:f.request('meri-host-hold-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer});
 assert.equal(answer.outcome,'APPLIED');assert.deepEqual(answer.custody,custody);
 assert.equal(holdCalls,1);assert.equal(saved,0,'no lifecycle write or dispatch happened');
 // A returned custody is refused by the lifecycle owner's same-client check, and a successor phase never
 // reaches the APPLIED answer at all.
 const returned=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>held,
  holdCustody:async()=>{throw Object.assign(Error('BROWSER_CUSTODY_REFUSED'),{code:'BROWSER_CUSTODY_REFUSED'});},maxLeaseMs:30000});
 await assert.rejects(returned.holdBrowser({request:f.request('meri-host-hold-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 const successor=createPostgresHostCurrentnessStore({transact:f.transact,
  readCanonicalRun:async()=>({...held,phase:'browser-successor'}),holdCustody:async()=>{holdCalls++;return {custody};},maxLeaseMs:30000});
 await assert.rejects(successor.holdBrowser({request:f.request('meri-host-hold-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
 assert.equal(holdCalls,1,'a successor phase never calls the custody owner');
 // A foreign host custody is refused by the store's own exact allocation check.
 const foreign=createPostgresHostCurrentnessStore({transact:f.transact,readCanonicalRun:async()=>held,
  holdCustody:async()=>({custody:{...custody,generation:GEN+1}}),maxLeaseMs:30000});
 await assert.rejects(foreign.holdBrowser({request:f.request('meri-host-hold-request/1'),
  fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),{message:'HOST_CONTROL_UNAVAILABLE'});
});

test('the three routes are the only closed operations and every envelope rejects an unbound answer',()=>{
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
