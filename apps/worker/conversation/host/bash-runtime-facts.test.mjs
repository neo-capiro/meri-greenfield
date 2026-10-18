/** Synthetic host ports exercise source composition only. A native D005 verifier, kernel sandbox and model are not run. */
import test from 'node:test';import assert from 'node:assert/strict';
import {connect} from 'node:net';import {once} from 'node:events';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {binding,clock} from '../browser/test/fixtures.mjs';
import {BASH_EGRESS_SCHEMA,bashEgressDomainsSha256} from '../egress/bash-egress.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';
import {HOST_ALLOCATION_SCHEMA} from './binding.mjs';
import {D005_HOST_IDENTITY_SCHEMA,D005_ISOLATION_RECEIPT_SCHEMA,prepareHostBashRuntimeFacts} from './bash-runtime-facts.mjs';

const deadline=clock()+60000;
const allocation=Object.freeze({schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:'00000015-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:deadline+60000});
const hostIdentity=Object.freeze({schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',bootId:'00000001-0000-4000-8000-000000000000',conversationId:binding.conversationId,hostId:allocation.hostId});
const receipt=(over={})=>({schema:D005_ISOLATION_RECEIPT_SCHEMA,verified:true,hostKind:'d005-isolated-ec2',outerIsolationBoundary:true,
 allocationSha256:canonicalSha256(allocation),bindingSha256:canonicalSha256(binding),hostIdentitySha256:canonicalSha256(hostIdentity),observedAtMs:clock(),expiresAtMs:deadline,...over});
function hostPorts({bwrap=true,closeFails=false}={}){
 const seen={made:0,removed:0,closed:0,queries:0,userMessages:0};
 const ports={findExecutable:name=>name==='bwrap'&&!bwrap?undefined:`/usr/bin/${name}`,runProbe:async()=>true,exists:()=>false,
  makeTempDir:label=>{seen.made++;return `/tmp/meri-host-${label}-${seen.made}`;},removeDir:()=>{seen.removed++;},
  query:args=>{seen.queries++;let release;const done=new Promise(resolve=>{release=resolve;});
   (async()=>{for await(const _ of args.prompt)seen.userMessages++;})();
   return {initializationResult:async()=>({}),close(){release();},async *[Symbol.asyncIterator](){await done;}};},
  sdkVersion:'0.3.295',nodePath:'/usr/local/bin/node',pathEnv:'/usr/bin',close(){seen.closed++;if(closeFails)throw Error('cleanup failed');}};
 return {seen,createReadinessPorts:async()=>ports};
}
function input(over={}){const probes=hostPorts();let verified=0;
 return {probes,configuration:{binding,policy:{bash:true},expiresAtMs:deadline,now:clock,pathEnv:'/usr/bin',
  verifyOuterIsolation:async()=>{verified++;return {allocation,hostIdentity,receipt:receipt()};},createReadinessPorts:probes.createReadinessPorts,...over},verified:()=>verified};}
const refuses=code=>e=>e?.code===code;

test('Bash off creates no host, verifier, SDK or egress activity',async()=>{
 const f=input({policy:{bash:false},verifyOuterIsolation:undefined,createReadinessPorts:async()=>{throw Error('must not probe');}});
 const prepared=await prepareHostBashRuntimeFacts(f.configuration);
 assert.deepEqual(prepared.runtimeFacts,{});assert.deepEqual(await prepared.close(),{closed:true});assert.equal(f.verified(),0);
});

test('missing or mismatched native D005 isolation proof refuses before SDK probing or proxy allocation',async()=>{
 for(const over of [{verifyOuterIsolation:undefined},
  {verifyOuterIsolation:async()=>({hostIdentity,receipt:receipt()})},
  {verifyOuterIsolation:async()=>({allocation:{...allocation,tenantId:'wrong-tenant'},hostIdentity,receipt:receipt()})},
  {verifyOuterIsolation:async()=>({allocation:{...allocation,generation:2},hostIdentity,receipt:receipt()})},
  {verifyOuterIsolation:async()=>({allocation:{...allocation,imageDigest:`sha256:${'b'.repeat(64)}`},hostIdentity,receipt:receipt()})},
  {verifyOuterIsolation:async()=>({allocation:{...allocation,leaseDeadlineMs:deadline-1},hostIdentity,receipt:receipt()})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity:{...hostIdentity,conversationId:'different'},receipt:receipt()})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity:{...hostIdentity,instanceId:['i-0123456789abcdef0']},receipt:receipt()})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity:{...hostIdentity,bootId:['00000001-0000-4000-8000-000000000000']},receipt:receipt()})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity:{...hostIdentity,hostId:'00000016-b0a1-4000-8000-000000000000'},receipt:receipt()})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity,receipt:receipt({hostKind:'fargate'})})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity,receipt:receipt({outerIsolationBoundary:false})})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity,receipt:receipt({allocationSha256:'0'.repeat(64)})})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity,receipt:receipt({bindingSha256:'0'.repeat(64)})})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity,receipt:receipt({hostIdentitySha256:'0'.repeat(64)})})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity,receipt:receipt({observedAtMs:clock()-31000})})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity,receipt:receipt({expiresAtMs:clock()+1})})},
  {verifyOuterIsolation:async()=>({allocation,hostIdentity,receipt:receipt({expiresAtMs:allocation.leaseDeadlineMs+1})})}]){
  let probes=0,egress=0;const f=input({...over,createReadinessPorts:async()=>{probes++;throw Error('must not probe');},startEgress:async()=>{egress++;throw Error('must not start');}});
  await assert.rejects(prepareHostBashRuntimeFacts(f.configuration),e=>['BASH_HOST_CONFIGURATION','BASH_HOST_BINDING_REFUSED','BASH_HOST_ISOLATION_REFUSED'].includes(e?.code),JSON.stringify(over));
  assert.equal(probes,0);assert.equal(egress,0);
 }
});

test('validated outer proof is copied before it is returned to the run owner',async()=>{
 const mutable={allocation:{...allocation},hostIdentity:{...hostIdentity},receipt:receipt()};
 const f=input({verifyOuterIsolation:async()=>mutable});
 const prepared=await prepareHostBashRuntimeFacts(f.configuration);
 mutable.allocation.generation=9;mutable.hostIdentity.instanceId='i-00000000';mutable.receipt.verified=false;
 assert.equal(prepared.allocation.generation,1);
 assert.equal(prepared.hostIdentity.instanceId,hostIdentity.instanceId);
 assert.equal(prepared.isolationReceipt.verified,true);
 assert.equal(Object.isFrozen(prepared.allocation),true);
 assert.equal(Object.isFrozen(prepared.hostIdentity),true);
 assert.equal(Object.isFrozen(prepared.isolationReceipt),true);
 await prepared.close();
});

test('canonical no-model SDK probe produces only a sandbox attestation for networkless Bash',async()=>{
 const f=input();const prepared=await prepareHostBashRuntimeFacts(f.configuration);
 assert.equal(f.verified(),1);assert.equal(prepared.runtimeFacts.bashSandbox.available,true);
 assert.deepEqual(prepared.allocation,allocation);
 assert.equal(prepared.runtimeFacts.bashSandbox.outerIsolationBoundary,true);
 assert.match(prepared.runtimeFacts.bashSandbox.readinessSha256,/^[0-9a-f]{64}$/u);
 assert.equal(Object.hasOwn(prepared.runtimeFacts,'bashEgress'),false);assert.equal(Object.hasOwn(prepared.runtimeFacts,'bashApprovals'),false);
 const composed=createSdkCapabilities({bash:true},{runOwner:{async append(){}},binding,cwd:`/workspace/${binding.conversationId}`,now:clock,newId:()=>binding.runId,...prepared.runtimeFacts});
 assert.equal(composed.bashAdmitted,true);assert.deepEqual(composed.options.tools,['Bash']);assert.equal(composed.options.sandbox.network.allowedDomains.length,0);
 assert.deepEqual([f.probes.seen.queries,f.probes.seen.userMessages,f.probes.seen.closed,f.probes.seen.made,f.probes.seen.removed],[1,0,1,2,2]);
 assert.deepEqual(await prepared.close(),{closed:true});
});

test('an unavailable SDK sandbox or failed readiness cleanup admits no Bash and starts no proxy',async()=>{
 for(const [probes,code] of [[hostPorts({bwrap:false}),'BASH_SANDBOX_UNAVAILABLE'],[hostPorts({closeFails:true}),'BASH_READINESS_CLEANUP_UNKNOWN']]){
  let egress=0;const f=input({createReadinessPorts:probes.createReadinessPorts,startEgress:async()=>{egress++;throw Error('must not start');}});
  await assert.rejects(prepareHostBashRuntimeFacts(f.configuration),refuses(code));
  assert.equal(probes.seen.closed,1);assert.equal(egress,0);
 }
});

test('networked Bash needs the approval owner, then binds its proxy fact and closes it once',async()=>{
 const domains=['records.example'];let starts=0,closes=0,revoked=false;
 const hostCurrentness=new AbortController();
 const proxy={revoke(){revoked=true;return {revoked:true};},async close(){closes++;revoked=true;}};
 const startEgress=async({domains:d,expiresAtMs})=>{starts++;assert.deepEqual(d,domains);assert.equal(expiresAtMs,deadline);
  return {fact:{schema:BASH_EGRESS_SCHEMA,httpProxyPort:41001,socksProxyPort:41002,domainsSha256:bashEgressDomainsSha256(d)},proxy};};
 const noApproval=input({policy:{bash:true,sandboxNetworkDomains:domains},hostCurrentnessSignal:hostCurrentness.signal,startEgress});
 await assert.rejects(prepareHostBashRuntimeFacts(noApproval.configuration),refuses('BASH_HOST_CONFIGURATION'));
 assert.equal(noApproval.verified(),0);assert.equal(starts,0);
 const approvals={async decide(){throw Error('no approval requested during preparation');}};
 const noSignal=input({policy:{bash:true,sandboxNetworkDomains:domains},approvals,startEgress});
 await assert.rejects(prepareHostBashRuntimeFacts(noSignal.configuration),refuses('BASH_HOST_CONFIGURATION'));
 assert.equal(noSignal.verified(),0);assert.equal(starts,0);
 const f=input({policy:{bash:true,sandboxNetworkDomains:domains},approvals,hostCurrentnessSignal:hostCurrentness.signal,startEgress});
 const prepared=await prepareHostBashRuntimeFacts(f.configuration);
 assert.equal(starts,1);assert.equal(prepared.runtimeFacts.bashApprovals,approvals);
 assert.equal(prepared.runtimeFacts.bashEgress.domainsSha256,bashEgressDomainsSha256(domains));
 assert.equal(prepared.runtimeFacts.bashSandbox.available,true);
 const composed=createSdkCapabilities({bash:true,sandboxNetworkDomains:domains},{runOwner:{async append(){}},binding,cwd:`/workspace/${binding.conversationId}`,now:clock,newId:()=>binding.runId,...prepared.runtimeFacts});
 assert.equal(composed.bashAdmitted,true);assert.equal(composed.options.sandbox.autoAllowBashIfSandboxed,false);
 assert.deepEqual(composed.options.sandbox.network.allowedDomains,domains);
 hostCurrentness.abort();assert.equal(revoked,true,'abort revokes synchronously');
 await prepared.close();await prepared.close();assert.equal(closes,1);
});

test('host currentness abort destroys an open Bash proxy socket and closes the listener',async()=>{
 const hostCurrentness=new AbortController();
 const f=input({policy:{bash:true,sandboxNetworkDomains:['records.example']},approvals:{async decide(){}},hostCurrentnessSignal:hostCurrentness.signal});
 const prepared=await prepareHostBashRuntimeFacts(f.configuration);
 const socket=connect({host:'127.0.0.1',port:prepared.runtimeFacts.bashEgress.httpProxyPort});
 try{
  await once(socket,'connect');const closed=once(socket,'close',{signal:AbortSignal.timeout(500)});
  hostCurrentness.abort();await closed;await prepared.close();
  await assert.rejects(once(connect({host:'127.0.0.1',port:prepared.runtimeFacts.bashEgress.httpProxyPort}),'connect'),{code:'ECONNREFUSED'});
 }finally{socket.destroy();await prepared.close();}
});

test('run deadline destroys an established Bash proxy socket even when currentness signal stays live',async()=>{
 const hostCurrentness=new AbortController(),runDeadline=clock()+500;
 const f=input({policy:{bash:true,sandboxNetworkDomains:['records.example']},approvals:{async decide(){}},
  hostCurrentnessSignal:hostCurrentness.signal,expiresAtMs:runDeadline,
  verifyOuterIsolation:async()=>({allocation,hostIdentity,receipt:receipt({expiresAtMs:runDeadline})})});
 const prepared=await prepareHostBashRuntimeFacts(f.configuration);
 const socket=connect({host:'127.0.0.1',port:prepared.runtimeFacts.bashEgress.httpProxyPort});
 try{
  await once(socket,'connect');const closed=once(socket,'close',{signal:AbortSignal.timeout(2000)});
  await closed;assert.equal(hostCurrentness.signal.aborted,false);
  await prepared.close();
 }finally{socket.destroy();await prepared.close();}
});

test('revocation during egress startup closes the late proxy before Bash facts escape',async()=>{
 const hostCurrentness=new AbortController(),domains=['records.example'];let release,started,revoked=false,closes=0;
 const entered=new Promise(resolve=>{started=resolve;});
 const proxy={revoke(){revoked=true;return {revoked:true};},async close(){closes++;}};
 const f=input({policy:{bash:true,sandboxNetworkDomains:domains},approvals:{async decide(){}},hostCurrentnessSignal:hostCurrentness.signal,
  startEgress:async()=>{started();return await new Promise(resolve=>{release=()=>resolve({fact:{schema:BASH_EGRESS_SCHEMA,httpProxyPort:41001,socksProxyPort:41002,domainsSha256:bashEgressDomainsSha256(domains)},proxy});});}});
 const pending=prepareHostBashRuntimeFacts(f.configuration);await entered;hostCurrentness.abort();release();
 await assert.rejects(pending,refuses('BASH_HOST_REVOKED'));assert.equal(revoked,true);assert.equal(closes,1);
});

test('malformed egress fact closes the started proxy; unknown close is surfaced',async()=>{
 const domains=['records.example'];let closes=0;
 const base={policy:{bash:true,sandboxNetworkDomains:domains},approvals:{async decide(){}},hostCurrentnessSignal:new AbortController().signal,
  startEgress:async()=>({fact:{schema:BASH_EGRESS_SCHEMA,httpProxyPort:41001,socksProxyPort:41002,domainsSha256:'0'.repeat(64)},proxy:{revoke(){return {revoked:true};},async close(){closes++;}}})};
 const f=input(base);await assert.rejects(prepareHostBashRuntimeFacts(f.configuration),refuses('BASH_EGRESS_START_FAILED'));assert.equal(closes,1);
 const unknown=input({...base,startEgress:async()=>({fact:{schema:BASH_EGRESS_SCHEMA,httpProxyPort:41001,socksProxyPort:41002,domainsSha256:'0'.repeat(64)},proxy:{revoke(){return {revoked:true};},async close(){throw Error('unknown');}}})});
 await assert.rejects(prepareHostBashRuntimeFacts(unknown.configuration),refuses('BASH_EGRESS_CLEANUP_UNKNOWN'));
});
