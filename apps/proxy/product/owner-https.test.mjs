/** Offline boundary controls; no certificate generation, listener or AWS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {assertProductServiceTaskLease,productOwnerRoute,encodeProductPlacement,
 createProductOwnerHttpsServer,acquireProductOwnerRequest,retireProductOwnerRequests,
 createProductOwnerListenerLifecycle,consumeProductPlacementRead} from './owner-https.mjs';
import {OWNER_PATHS,createProductOwnerServiceGate} from './owner-channel.mjs';

const policy={deploymentRevision:'reviewed-v1',ownerTaskArn:'owner',proxyTaskArn:'proxy',clientCertSha256:'b'.repeat(64)};
const tls={certSha256:'a'.repeat(64)};
function proof(){return {schemaVersion:1,deploymentRevision:'reviewed-v1',ownerTaskArn:'owner',proxyTaskArn:'proxy',
 ownerPrivateIpv4Address:'10.1.2.3',proxyPrivateIpv4Address:'10.1.2.4',ownerCertSha256:'a'.repeat(64),
 proxyCertSha256:'b'.repeat(64),checkedAtMs:1001,expiresAtMs:2000};}
const input={policy,tls,localAddress:'10.1.2.3',remoteAddress:'10.1.2.4',started:1000,at:1002,deadline:2000};
test('lease joins exact current native task pair to actual accepted socket endpoints',()=>{
 assert.equal(assertProductServiceTaskLease(proof(),input),2000);
 for(const [key,value]of Object.entries({ownerTaskArn:'other',proxyTaskArn:'other',deploymentRevision:'other',
  ownerCertSha256:'c'.repeat(64),proxyCertSha256:'d'.repeat(64),ownerPrivateIpv4Address:'10.1.2.8',
  proxyPrivateIpv4Address:'10.1.2.9',checkedAtMs:999,expiresAtMs:1002})){
  assert.throws(()=>assertProductServiceTaskLease({...proof(),[key]:value},input));
 }
 assert.throws(()=>assertProductServiceTaskLease({...proof(),extra:true},input));
 assert.throws(()=>assertProductServiceTaskLease(true,input));
});
test('HTTP path/method cannot select another endpoint, query or carrier',()=>{
 for(const path of Object.values(OWNER_PATHS))assert.equal(productOwnerRoute('POST',path),path);
 for(const path of ['/health/live','/health/ready']){
  assert.equal(productOwnerRoute('GET',path),path);
  assert.throws(()=>productOwnerRoute('GET',path+'?public=true'));
  assert.throws(()=>productOwnerRoute('POST',path));
 }
 for(const path of ['/','/v1/internal/product-model/owner/operation?carrier=capture',
  '/v1/internal/product-model/owner/%6fperation','//v1/internal/product-model/owner/operation']){
  assert.throws(()=>productOwnerRoute('POST',path));
 }
 assert.throws(()=>productOwnerRoute('GET',OWNER_PATHS.operation));
});
test('private placement wire contains only existing constructor facts in fixed order',()=>{
 const b={tenantId:'tenant',actorId:'actor',conversationId:'c',runId:'r',attemptId:'a',workerId:'w',writerFence:1};
 const issuedTaskNetwork={binding:{run_id:'r',attempt:1,worker_arn:'task',fence:1,policy_revision:'p'},
  grant_id:'g',cluster_arn:'cluster',task_definition_arn:'definition',container_name:'worker',image_digest:'sha256:image',
  execution_binding:b,started_by:'start',group:'group',created_at_ms:1,expires_at_ms:20,
  vpc_id:'vpc',subnet_id:'subnet',security_group_ids:['sg'],tags:[['key','value']]};
 const encoded=encodeProductPlacement({issuedTaskNetwork,checkedAtMs:10,effectiveExpiresAtMs:15});
 assert.equal(encoded.length,15);assert.deepEqual(encoded[0],['r',1,'task',1,'p']);
 assert.deepEqual(encoded[6],['tenant','actor','c','r','a','w',1]);
 assert.throws(()=>encodeProductPlacement({issuedTaskNetwork:{...issuedTaskNetwork,credential:'forbidden'},checkedAtMs:10,effectiveExpiresAtMs:15}));
});
test('default construction never builds or opens a TLS server',async()=>{
 const value=createProductOwnerHttpsServer({tlsMaterial:null,clientPolicy:null,persistedFacts:null,
  ownerPorts:null,placement:null,taskLeaseReader:null,serviceGate:null,now:Date.now});
 assert.equal(value.available,false);await assert.rejects(value.listen());await value.close();
});
test('rejected pipelined contenders cannot release the pending connection owner',async()=>{
 const state={busy:false},entered=[];let finishFirst;
 const waiting=new Promise(resolve=>{finishFirst=resolve;});
 async function request(id,pending){let release;
  try{release=acquireProductOwnerRequest(state);entered.push(id);await pending;}
  finally{release?.();}
 }
 const first=request(1,waiting);await Promise.resolve();
 await assert.rejects(request(2,Promise.resolve()),/PRODUCT_OWNER_HTTPS_UNAVAILABLE/u);
 assert.equal(state.busy,true);
 await assert.rejects(request(3,Promise.resolve()),/PRODUCT_OWNER_HTTPS_UNAVAILABLE/u);
 assert.deepEqual(entered,[1]);assert.equal(state.busy,true);
 finishFirst();await first;assert.equal(state.busy,false);
 await request(4,Promise.resolve());assert.deepEqual(entered,[1,4]);
});
test('close revokes a fully read request that is still awaiting owner work',async()=>{
 const gate=createProductOwnerServiceGate(),controller=new AbortController(),controllers=new Set([controller]);
 let finish;const work=new Promise(resolve=>{finish=resolve;});
 const request=work.finally(()=>controllers.delete(controller));
 assert.equal(retireProductOwnerRequests(gate,controllers),1);
 assert.equal(gate.available,false);assert.equal(controller.signal.aborted,true);
 assert.equal(controllers.size,1,'unsettled borrowed work must remain visible');
 assert.throws(()=>gate.begin());finish();await request;
 assert.equal(controllers.size,0);assert.equal(gate.available,false,'late settlement cannot revive the gate');
});
test('close owns pending listen and denies a late bind callback without reopening',async()=>{
 class NativeServer extends EventEmitter{
  listen(options,callback){this.options=options;this.bound=callback;}
  close(callback){this.stops=(this.stops??0)+1;queueMicrotask(()=>callback());}
 }
 const server=new NativeServer(),gate=createProductOwnerServiceGate(),controller=new AbortController();
 const life=createProductOwnerListenerLifecycle(server,{retire:()=>retireProductOwnerRequests(gate,new Set([controller])),
  pendingRequests:()=>1,maxCloseMs:100});
 const start=life.listen();const rejected=assert.rejects(start,/PRODUCT_OWNER_HTTPS_UNAVAILABLE/u);
 const closed=await life.close();await rejected;
 assert.equal(gate.available,false);assert.equal(controller.signal.aborted,true);
 assert.equal(server.options.signal.aborted,true);assert.equal(closed.listenerStopped,true);
 assert.equal(closed.pendingRequests,1);assert.equal(closed.physicalStopProven,false);
 server.bound();await Promise.resolve();assert.equal(server.stops,2);
 await assert.rejects(life.listen());
});
test('placement replay capacity exhaustion retires readiness without evicting IDs',()=>{
 const reads=new Set(Array.from({length:4096},(_,i)=>'read_'+i)),gate=createProductOwnerServiceGate();
 assert.throws(()=>consumeProductPlacementRead(reads,'new_read',gate));
 assert.equal(gate.available,false);assert.equal(reads.size,4096);
 assert.ok(reads.has('read_0'),'old IDs cannot become usable again');
});
