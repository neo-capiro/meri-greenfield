/** The named approval decision through the REAL store, real protocol validators and real receipt validator.
 * Inert SQL/transport only: no database, socket, TLS or key material. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {browserPreparationProposalId,BROWSER_APPROVAL_REQUEST_SCHEMA}
 from '../../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {hostDecideRequest,hostDecideResponse,HOST_DECIDE_RESPONSE_SCHEMA,hostClientDnsName} from './protocol.mjs';
import {createPostgresHostCurrentnessStore} from './postgres-store.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';

const NOW=1700000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:binding.conversationId,
 generation:3,hostId:'11111111-1111-4111-8111-111111111111',imageDigest:`sha256:${'a'.repeat(64)}`,
 leaseDeadlineMs:NOW+600000};
const toolUseId='toolu_01HZX';
const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',toolUseId,
 inputSha256:hash({tool:'browser_click',arguments:{}}),pageOrigin:'https://app.capiro.example',
 policySha256:'a'.repeat(64)};
const originalRequest={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),
 input:{tool:'browser_click',arguments:{}},requestedAtMs:NOW-1000,expiresAtMs:NOW+600000};
const proposalId=browserPreparationProposalId({binding,toolUseId});

function receipt(at){
 return {schema:'meri-browser-approval-receipt/1',proposalId,subjectSha256:hash(subject),toolUseId,
  decision:{proposalId,commandSha256:hash(subject),decision:'approved',
   decidedAt:new Date(at-500).toISOString(),expiresAt:new Date(at+60000).toISOString(),
   approver:{tenantId:'tenant',actorId:'actor'},policyRevision:'p1'},
  consumption:{consumed:true,consumptionId:'99999999-9999-4999-8999-999999999999',consumedAtMs:at}};
}

function fixture({state={}}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',
  bootId:'77777777-7777-4777-8777-777777777777',conversationId:b.conversationId,hostId:a.hostId};
 const queries=[];const shared={depth:0,admittedAt:null,clock:0};
 const client={async query(statement,values){queries.push(statement);
  if(statement.includes('lock_allocation'))return {rows:[{allocation_json:a,allocation_sha256:hash(a),
   host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),client_cert_sha256:'d'.repeat(64),
   client_dns_name:hostClientDnsName(a),client_cert_not_after_ms:NOW+300000,lease_deadline_ms:a.leaseDeadlineMs,
   state:'active'}]};
  if(statement.startsWith('INSERT INTO meri_host_control.request_nonces')){
   if(state.replay)return {rows:[]};return {rows:[{nonce_sha256:values[2]}]};}
  if(statement.includes('clock_timestamp')){shared.clock++;return {rows:[{now_ms:NOW}]};}
  return {rows:[]};
 }};
 const transact=async(effect)=>{shared.depth++;try{return await effect(client);}finally{shared.depth--;}};
 const runState=()=>({binding,currentUntilMs:NOW+300000,phase:'active',sdkAdmitted:true,
  bashAdmitted:false,browserAdmitted:true,capabilityPolicySha256:'c'.repeat(64),browserPolicySha256:'a'.repeat(64),
  ...state.overrides});
 const request={schema:'meri-host-decide-request/1',allocation:a,binding:b,hostIdentity,nonce:'e'.repeat(64),
  request:originalRequest,deadlineMs:Math.min(originalRequest.expiresAtMs,a.leaseDeadlineMs,NOW+300000)};
 return {a,b,hostIdentity,client,transact,queries,shared,state,request,runState,
  fingerprint:'d'.repeat(64),peer:hostClientDnsName(a)};
}

function storeFor(f,decide){
 return createPostgresHostCurrentnessStore({transact:f.transact,
  readCanonicalRun:async()=>f.runState(),decideBrowserApproval:decide,maxLeaseMs:30000});
}

test('a canonical approved receipt is released and the callback runs outside any transaction',async()=>{
 const f=fixture();let seen=null,calls=0;
 const store=storeFor(f,async(input)=>{calls++;seen={...input,depth:f.shared.depth};
  return {permitted:true,receipt:receipt(NOW),
   terminal:'approved'};});
 const answer=await store.decideBrowserApproval({request:f.request,fingerprintSha256:f.fingerprint,
  peerDnsName:f.peer,onAdmitted:deadline=>{f.shared.admittedAt=deadline;}});
 assert.equal(answer.schema,HOST_DECIDE_RESPONSE_SCHEMA);
 assert.equal(answer.outcome,'approved');
 assert.equal(answer.receipt.proposalId,proposalId);
 assert.equal(calls,1);
 assert.equal(seen.depth,0,'no transaction is held while the approval wait runs');
 assert.equal(f.shared.admittedAt,Math.min(originalRequest.expiresAtMs,allocation.leaseDeadlineMs,NOW+300000));
 assert.equal(f.queries.filter(q=>q.startsWith('INSERT INTO meri_host_control.request_nonces')).length,1,
  'the nonce is consumed exactly once');
});

test('a non-approved outcome carries no receipt',async()=>{
 const f=fixture();
 const store=storeFor(f,async()=>({permitted:false,unknown:true,statusOnly:true}));
 const answer=await store.decideBrowserApproval({request:f.request,fingerprintSha256:f.fingerprint,peerDnsName:f.peer});
 assert.equal(answer.outcome,'unknown');
 assert.equal(answer.receipt,null);
});

test('a replayed nonce refuses before the callback runs',async()=>{
 const f=fixture({state:{replay:true}});let calls=0;
 const store=storeFor(f,async()=>{calls++;return {permitted:true,receipt:receipt(NOW)};});
 await assert.rejects(store.decideBrowserApproval({request:f.request,fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),
  /HOST_CONTROL_UNAVAILABLE/u);
 assert.equal(calls,0);
});

test('a foreign binding or peer refuses before admission',async()=>{
 const f=fixture();
 const store=storeFor(f,async()=>({permitted:false}));
 const foreign={...f.request,binding:{...binding,runId:'88888888-8888-4888-8888-888888888888'}};
 await assert.rejects(store.decideBrowserApproval({request:foreign,fingerprintSha256:f.fingerprint,peerDnsName:f.peer}),
  /HOST_CONTROL_UNAVAILABLE/u);
 await assert.rejects(store.decideBrowserApproval({request:f.request,fingerprintSha256:f.fingerprint,
  peerDnsName:'other.example'}),/HOST_CONTROL_UNAVAILABLE/u);
});

test('a canonical authority change before the grant refuses',async()=>{
 const f=fixture();
 f.state.overrides={};
 const store=storeFor(f,async()=>{
  // The browser policy changes while the human wait runs.
  f.state.overrides={browserPolicySha256:'b'.repeat(64)};
  return {permitted:true,receipt:receipt(NOW)};});
 await assert.rejects(store.decideBrowserApproval({request:f.request,fingerprintSha256:f.fingerprint,
  peerDnsName:f.peer}),/HOST_CONTROL_UNAVAILABLE/u);
});

test('an expired original window refuses before the callback',async()=>{
 const f=fixture();let calls=0;
 const expired={...f.request,deadlineMs:NOW-1};
 const store=storeFor(f,async()=>{calls++;return {permitted:false};});
 await assert.rejects(store.decideBrowserApproval({request:expired,fingerprintSha256:f.fingerprint,
  peerDnsName:f.peer}),/HOST_CONTROL_UNAVAILABLE/u);
 assert.equal(calls,0,'an already-elapsed window never reaches the owner');
});

test('a cancelled caller refuses and the callback sees no transaction',async()=>{
 const f=fixture();const controller=new AbortController();let depth=null;
 const store=storeFor(f,async(input)=>{depth=f.shared.depth;controller.abort();
  throw Object.assign(Error('ABORTED'),{code:'ABORTED'});});
 await assert.rejects(store.decideBrowserApproval({request:f.request,fingerprintSha256:f.fingerprint,
  peerDnsName:f.peer,signal:controller.signal}),/HOST_CONTROL_UNAVAILABLE/u);
 assert.equal(depth,0);
});
