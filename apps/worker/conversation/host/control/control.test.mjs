/** Offline protocol/store checks. The transaction fixture models commit acknowledgement but is not PostgreSQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createPostgresHostCurrentnessStore,HOST_CONTROL_SQL} from './postgres-store.mjs';
import {HOST_CONTROL_REQUEST_SCHEMA,hostClientDnsName,hostControlRequest,hostControlResponse,
 encodeHostControl,decodeHostControl} from './protocol.mjs';

const now=Date.now();
const allocation=Object.freeze({schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,
 leaseDeadlineMs:now+30000});
const hostIdentity=Object.freeze({schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',
 bootId:'00000001-0000-4000-8000-000000000000',conversationId:binding.conversationId,hostId:allocation.hostId});
const policySha256='a'.repeat(64),fingerprintSha256='b'.repeat(64);
const request=(nonce='c'.repeat(64),purpose='browser')=>({schema:HOST_CONTROL_REQUEST_SCHEMA,allocation,binding,hostIdentity,purpose,policySha256,nonce});
const code=expected=>error=>error?.code===expected;

function fixture(){
 const used=new Set(),trace=[];let state={binding,browserPolicySha256:policySha256,capabilityPolicySha256:'f'.repeat(64),
  sdkAdmitted:true,browserAdmitted:true,bashAdmitted:true,phase:'active',currentUntilMs:now+20000},
  host={allocation_json:allocation,allocation_sha256:canonicalSha256(allocation),host_identity_json:hostIdentity,
   host_identity_sha256:canonicalSha256(hostIdentity),client_cert_sha256:fingerprintSha256,
   client_dns_name:hostClientDnsName(allocation),client_cert_not_after_ms:String(now+25000),
   lease_deadline_ms:String(allocation.leaseDeadlineMs),state:'active'},commitFails=false;
 const transact=async fn=>{
  const pending=new Set(),client={async query(sql,args){trace.push([sql,args]);
   if(sql===HOST_CONTROL_SQL.lockHost)return {rows:host?[structuredClone(host)]:[]};
   if(sql===HOST_CONTROL_SQL.consumeNonce){const nonce=args[2];if(used.has(nonce)||pending.has(nonce))return {rows:[]};
    pending.add(nonce);return {rows:[{nonce_sha256:nonce}]};}
   if(sql===HOST_CONTROL_SQL.clock)return {rows:[{now_ms:String(now)}]};
   throw Error('unexpected SQL');}};
  const value=await fn(client);if(commitFails)throw Error('unknown commit');for(const nonce of pending)used.add(nonce);return value;
 };
 const store=()=>createPostgresHostCurrentnessStore({transact,readCanonicalRun:async(_client)=>structuredClone(state),maxLeaseMs:3000});
 const read=(q=request(),over={})=>store().readCurrent({request:q,fingerprintSha256,peerDnsName:hostClientDnsName(allocation),...over});
 return {read,store,used,trace,setState:value=>{state=value;},setHost:value=>{host=value;},setCommitFails:value=>{commitFails=value;}};
}

test('full identity and nonce are closed wire data; an echoed fresh active receipt binds exactly',()=>{
 const q=hostControlRequest(request()),decoded=hostControlRequest(decodeHostControl(encodeHostControl(q)));
 assert.deepEqual(decoded,q);
 const answer={schema:'meri-host-currentness-response/1',nonce:q.nonce,purpose:'browser',receipt:{allocation,binding,policySha256,
  phase:'active',checkedAtMs:now,currentUntilMs:now+1000}};
 assert.deepEqual(hostControlResponse(answer,q,{nowMs:now,maxFreshMs:3000}),answer.receipt);
 for(const change of [{nonce:'d'.repeat(64)},{purpose:'bash'},{receipt:{...answer.receipt,binding:{...binding,writerFence:2}}},
  {receipt:{...answer.receipt,phase:'revoked'}},{receipt:{...answer.receipt,currentUntilMs:now+5000}}])
  assert.throws(()=>hostControlResponse({...answer,...change},q,{nowMs:now,maxFreshMs:3000}),code('HOST_CONTROL_REFUSED'));
 for(const change of [{allocation:{...allocation,tenantId:'other'}},{binding:{...binding,tenantId:'other'}},
  {hostIdentity:{...hostIdentity,hostId:'00000002-0000-4000-8000-000000000000'}},
  {nonce:['c'.repeat(64)]},{purpose:'tool'}])assert.throws(()=>hostControlRequest({...request(),...change}),code('HOST_CONTROL_REFUSED'));
 assert.throws(()=>decodeHostControl(Buffer.alloc(32769)),code('HOST_CONTROL_REFUSED'));
});

test('the acknowledged transaction locks pinned host, consumes nonce once and clips receipt to all cutoffs',async()=>{
 const f=fixture(),q=request();const response=await f.read(q);
 assert.equal(response.receipt.currentUntilMs,now+3000);
 assert.equal(response.receipt.checkedAtMs,now);
 assert.deepEqual(f.trace.map(([sql])=>sql),[HOST_CONTROL_SQL.lockHost,HOST_CONTROL_SQL.consumeNonce,HOST_CONTROL_SQL.clock]);
 assert.equal(f.used.size,1);
 await assert.rejects(f.read(q),code('HOST_CONTROL_UNAVAILABLE'));
 assert.equal(f.used.size,1,'replay remains refused across new store objects');
 assert.equal((await f.read(request('d'.repeat(64)))).receipt.currentUntilMs,now+3000);
});

test('SDK, browser and Bash admission are distinct; browser-only SDK remains available while browser is held',async()=>{
 const f=fixture();
 const bash={...request('e'.repeat(64),'bash'),policySha256:'f'.repeat(64)};
 assert.equal((await f.read(bash)).purpose,'bash');
 await assert.rejects(f.read(request('d'.repeat(64),'bash')),code('HOST_CONTROL_UNAVAILABLE'),
  'browser digest cannot be presented as Bash policy');
 f.setState({binding,browserPolicySha256:policySha256,capabilityPolicySha256:'f'.repeat(64),
  sdkAdmitted:true,browserAdmitted:false,bashAdmitted:false,phase:'active',currentUntilMs:now+20000});
 await assert.rejects(f.read(request('a'.repeat(64))),code('HOST_CONTROL_UNAVAILABLE'));
 assert.equal((await f.read({...bash,nonce:'1'.repeat(64),purpose:'sdk'})).purpose,'sdk');
 await assert.rejects(f.read({...bash,nonce:'2'.repeat(64)}),code('HOST_CONTROL_UNAVAILABLE'));
});

test('credential mismatch, stale generation, policy/fence change, inactive host/run and expiry refuse',async()=>{
 for(const bad of [
  {peer:'e'.repeat(64)},{dns:'different.host.meri.internal'},
  {host:{state:'revoked'}},{host:{client_cert_sha256:'e'.repeat(64)}},
  {host:{allocation_json:{...allocation,generation:2}}},
  {host:{client_cert_not_after_ms:String(now)}},
  {state:{binding,browserPolicySha256:'e'.repeat(64),capabilityPolicySha256:'f'.repeat(64),sdkAdmitted:true,browserAdmitted:true,bashAdmitted:true,phase:'active',currentUntilMs:now+20000}},
  {state:{binding:{...binding,writerFence:2},browserPolicySha256:policySha256,capabilityPolicySha256:'f'.repeat(64),sdkAdmitted:true,browserAdmitted:true,bashAdmitted:true,phase:'active',currentUntilMs:now+20000}},
  {state:{binding,browserPolicySha256:policySha256,capabilityPolicySha256:'f'.repeat(64),sdkAdmitted:true,browserAdmitted:false,bashAdmitted:true,phase:'active',currentUntilMs:now+20000}},
  {state:{binding,browserPolicySha256:policySha256,capabilityPolicySha256:'f'.repeat(64),sdkAdmitted:false,browserAdmitted:true,bashAdmitted:true,phase:'active',currentUntilMs:now+20000}},
  {state:{binding,browserPolicySha256:policySha256,capabilityPolicySha256:'f'.repeat(64),sdkAdmitted:true,browserAdmitted:true,bashAdmitted:true,phase:'revoked',currentUntilMs:now+20000}},
 ]){
  const f=fixture();if(bad.host){const base={allocation_json:allocation,allocation_sha256:canonicalSha256(allocation),
   host_identity_json:hostIdentity,host_identity_sha256:canonicalSha256(hostIdentity),
   client_cert_sha256:fingerprintSha256,client_dns_name:hostClientDnsName(allocation),
   client_cert_not_after_ms:String(now+25000),lease_deadline_ms:String(allocation.leaseDeadlineMs),state:'active'};
   f.setHost({...base,...bad.host});}
  if(bad.state)f.setState(bad.state);
  await assert.rejects(f.read(request(),{fingerprintSha256:bad.peer??fingerprintSha256,
   peerDnsName:bad.dns??hostClientDnsName(allocation)}),code('HOST_CONTROL_UNAVAILABLE'));
  assert.equal(f.used.size,0);
 }
});

test('unacknowledged COMMIT, database failure and abort release no receipt; no in-memory fallback',async()=>{
 const f=fixture();f.setCommitFails(true);
 await assert.rejects(f.read(),code('HOST_CONTROL_UNAVAILABLE'));
 const aborted=new AbortController();aborted.abort();
 await assert.rejects(f.read(request('d'.repeat(64)),{signal:aborted.signal}),code('HOST_CONTROL_UNAVAILABLE'));
 assert.equal(f.used.size,0);
 assert.throws(()=>createPostgresHostCurrentnessStore({transact:async()=>{},readCanonicalRun:async()=>{},maxLeaseMs:30001}),code('HOST_CONTROL_UNAVAILABLE'));
});
