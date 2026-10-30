/** The COMPOSED hold callback and the composed workflow read, driven through the real protected store,
 * the real lifecycle owner and a full canonical allocation. Inert SQL/transaction boundaries only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createBrowserHostHoldCustody} from '../../../runtime/browser-host-composition.mjs';
import {createPostgresHostCurrentnessStore} from '../../../worker/conversation/host/control/postgres-store.mjs';
import {hostClientDnsName} from '../../../worker/conversation/host/control/protocol.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../../../worker/conversation/host/binding.mjs';
import {createBrowserCustodyJournal} from '../lifecycle/browser-custody.mjs';

const NOW=1700000000000;
const HOST_ID='11111111-1111-4111-8111-111111111111',GEN=3;
const CONTROL_ID='88888888-8888-4888-8888-888888888888',OWNER_ID='77777777-7777-4777-8777-777777777777';
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const allocation=assertHostAllocation({schema:'meri-conversation-host-allocation/1',tenantId:'tenant',
 conversationId:binding.conversationId,generation:GEN,hostId:HOST_ID,
 imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:NOW+600000});
const custody={schema:'meri-browser-custody/1',binding,controlId:CONTROL_ID,ownerInstanceId:OWNER_ID,
 hostId:HOST_ID,generation:GEN,leaseEpoch:2,policySha256:'f'.repeat(64),expiresAtMs:NOW+60000};

function environment({control={}}={}){
 const a=allocation,b=assertHostRunBinding(a,binding);
 const identity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',
  bootId:'99999999-9999-4999-8999-999999999999',conversationId:b.conversationId,hostId:a.hostId};
 let saves=0;
 const journal=createBrowserCustodyJournal({tx:async(_b,_c,effect)=>effect({}),
  verifyRun:async()=>({projection:{state:'paused',scopes},sequence_end:null,hold_control_id:CONTROL_ID}),
  lookup:async()=>({input:{intent:'takeover.begin',controlId:CONTROL_ID},state:'APPLIED',sourceBinding:binding,
   browserCustody:custody,proof:{checkpointSha256:'9'.repeat(64)},checkpointId:binding.runId,...control}),
  pins:()=>{},save:async()=>{saves++;},now:()=>NOW});
 const conversationStore={lifecycle:{browserCustody:journal}};
 const projection={binding,state:'paused',scopes,createdAt:new Date(NOW).toISOString(),policyRevision:'p1',
  versions:{imageDigest:`sha256:${'a'.repeat(64)}`,sdk:'0.1.0',cli:'0.1.0',contracts:'0.1.0',
   skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'}};
 const requestId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const client={async query(statement,values){
  if(statement.includes('lock_allocation'))return {rows:[{allocation_json:a,allocation_sha256:hash(a),
   host_identity_json:identity,host_identity_sha256:hash(identity),client_cert_sha256:'d'.repeat(64),
   client_dns_name:hostClientDnsName(a),client_cert_not_after_ms:NOW+300000,lease_deadline_ms:a.leaseDeadlineMs,state:'active'}]};
  if(statement.includes('meri_conversations.runs')&&values.length===3)
   return {rows:[{projection,projection_sha256:hash(projection),tenant_id:binding.tenantId,
    conversation_id:binding.conversationId,run_id:binding.runId,request_id:requestId,
    last_sequence:1,request:{requestId,siteWorkflow:undefined},request_sha256:hash({requestId})}]};
  if(statement.startsWith('INSERT INTO meri_host_control.request_nonces'))return {rows:[{nonce_sha256:values[2]}]};
  if(statement.includes('clock_timestamp'))return {rows:[{now_ms:NOW}]};
  return {rows:[]};
 }};
 const held={binding,browserPolicySha256:'f'.repeat(64),capabilityPolicySha256:'f'.repeat(64),
  sdkAdmitted:false,browserAdmitted:true,bashAdmitted:false,phase:'browser-held',
  currentUntilMs:NOW+60000,browserCustody:custody};
 const store=createPostgresHostCurrentnessStore({transact:async effect=>effect(client),
  readCanonicalRun:async()=>held,maxLeaseMs:30000,
  holdCustody:({client:caller,binding:target,allocation:given,check})=>
   createBrowserHostHoldCustody({store:conversationStore}).hold({client:caller,binding:target,allocation:given,check})});
 return {a,b,identity,client,store,journal,conversationStore,saves:()=>saves};
}
const request=env=>({schema:'meri-host-hold-request/1',allocation:env.a,binding:env.b,
 hostIdentity:env.identity,nonce:'e'.repeat(64)});

test('the composed hold callback accepts the FULL canonical allocation for unreturned APPLIED custody',async()=>{
 const env=environment();
 const answer=await env.store.holdBrowser({request:request(env),fingerprintSha256:'d'.repeat(64),
  peerDnsName:hostClientDnsName(env.a)});
 assert.equal(answer.outcome,'APPLIED');
 assert.deepEqual(answer.custody,custody);
 assert.equal(env.saves(),0,'read-only');
});

test('the same composed callback refuses a control whose browserReturn is already set',async()=>{
 const env=environment({control:{browserReturn:{ownerInstanceId:OWNER_ID,leaseEpoch:custody.leaseEpoch+1,
  snapshotSha256:'a'.repeat(64)}}});
 await assert.rejects(env.store.holdBrowser({request:request(env),fingerprintSha256:'d'.repeat(64),
  peerDnsName:hostClientDnsName(env.a)}),{message:'HOST_CONTROL_UNAVAILABLE'});
 assert.equal(env.saves(),0);
});

test('the composed callback refuses without a lifecycle hold owner and without a client',async()=>{
 const env=environment();
 await assert.rejects(createBrowserHostHoldCustody({}).hold({client:env.client,binding:env.b,allocation:env.a,check:()=>{}}),
  {message:'BROWSER_HOST_COMPOSITION'});
 await assert.rejects(createBrowserHostHoldCustody({store:env.conversationStore}).hold({client:null,binding:env.b,allocation:env.a,check:()=>{}}),
  {message:'BROWSER_HOST_COMPOSITION'});
});
