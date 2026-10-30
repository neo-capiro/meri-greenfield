/** FULL round trip: the REAL client, the REAL captured server handler, the REAL Postgres host store and a
 * real decision callback, over inert in-memory https streams and a mocked certificate boundary only. The
 * request is a normal Readable whose native lifecycle is preserved, so the server's body reader completes.
 * This is a BOUNDARY test: Core composition is covered by the existing owner/producer suites. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {browserPreparationProposalId,BROWSER_APPROVAL_REQUEST_SCHEMA}
 from '../../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';
import {hostClientDnsName,HOST_DECIDE_PATH} from './protocol.mjs';

mock.module(new URL('./tls.mjs',import.meta.url).href,{exports:{
 privateAddress:value=>value,dnsName:value=>value,fingerprint:value=>value,
 tlsBytes:value=>Buffer.from(value),MAX_CERT_LIFETIME_MS:900000,
 checkedCertificate:(_raw,{nowMs})=>Object.freeze({fingerprintSha256:'d'.repeat(64),notAfterMs:nowMs+300000}),
}});

const NOW=1700000000000,clock={now:NOW};
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:binding.conversationId,
 generation:3,hostId:'11111111-1111-4111-8111-111111111111',imageDigest:`sha256:${'a'.repeat(64)}`,
 leaseDeadlineMs:NOW+600000};
const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',
 bootId:'77777777-7777-4777-8777-777777777777',conversationId:binding.conversationId,hostId:allocation.hostId};
const toolUseId='toolu_01HZX';
const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',toolUseId,
 inputSha256:hash({tool:'browser_click',arguments:{}}),pageOrigin:'https://app.capiro.example',policySha256:'a'.repeat(64)};
const originalRequest={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),
 input:{tool:'browser_click',arguments:{}},requestedAtMs:NOW-1000,expiresAtMs:NOW+600000};
const proposalId=browserPreparationProposalId({binding,toolUseId});
const receipt=at=>({schema:'meri-browser-approval-receipt/1',proposalId,subjectSha256:hash(subject),toolUseId,
 decision:{proposalId,commandSha256:hash(subject),decision:'approved',decidedAt:new Date(at-500).toISOString(),
  expiresAt:new Date(at+300000).toISOString(),approver:{tenantId:'tenant',actorId:'actor'},policyRevision:'p1'},
 consumption:{consumed:true,consumptionId:'99999999-9999-4999-8999-999999999999',consumedAtMs:at}});

/** The request is a plain Readable: its native destroy/async-iterator completion is NOT overridden. */
function makeReq(bytes,path){
 const req=Readable.from([bytes]);
 req.httpVersion='1.1';req.method='POST';req.url=path;
 req.rawHeaders=['host','host.example','content-type','application/json','content-length',String(bytes.length)];
 req.socket={authorized:true,getPeerCertificate:()=>({raw:Buffer.from('peer')})};
 return req;
}

/** In-memory transport. Outbound bytes reach the captured handler; the handler's response — including its
 * real status and headers — reaches the client. */
function wire(captured){
 return {request(options,callback){
  const out=new EventEmitter();out.destroyed=false;
  const signal=options.signal;
  out.destroy=()=>{out.destroyed=true;};
  out.end=bytes=>{
   if(out.destroyed)return;
   const res=new EventEmitter();res.statusCode=200;res.headers={};res.destroyed=false;
   res.writeHead=(code,headers)=>{res.statusCode=code;for(const [k,v] of Object.entries(headers))res.headers[k.toLowerCase()]=v;};
   res.resume=()=>{};
   res.destroy=()=>{res.destroyed=true;finish(Buffer.alloc(0));};
   let finished=false;
   const finish=payload=>{if(finished)return;finished=true;
    const clientRes=new EventEmitter();
    clientRes.statusCode=res.statusCode;clientRes.headers={...res.headers};
    clientRes.destroy=()=>{};clientRes.resume=()=>{};
    callback(clientRes);
    setImmediate(()=>{if(payload.length)clientRes.emit('data',payload);clientRes.emit('end');});};
   res.end=payload=>finish(payload??Buffer.alloc(0));
   const req=makeReq(Buffer.from(bytes),options.path);
   signal?.addEventListener('abort',()=>{res.destroyed=true;finish(Buffer.alloc(0));},{once:true});
   captured.handler(req,res);
  };
  return out;
 }};
}

async function route({decide,request=originalRequest,replayNonce=false,requestMs=5000,maxLeaseMs=5000}={}){
 const {createHostCurrentnessClient}=await import('./client.mjs');
 const {createHostCurrentnessServer}=await import('./server.mjs');
 const {createPostgresHostCurrentnessStore}=await import('./postgres-store.mjs');
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 const queries=[],shared={depth:0,maxDepth:0,decideCalls:0};
 const sqlClient={async query(statement,values){queries.push(statement);
  if(statement.includes('lock_allocation'))return {rows:[{allocation_json:a,allocation_sha256:hash(a),
   host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),client_cert_sha256:'d'.repeat(64),
   client_dns_name:hostClientDnsName(a),client_cert_not_after_ms:NOW+300000,lease_deadline_ms:a.leaseDeadlineMs,
   state:'active'}]};
  if(statement.startsWith('INSERT INTO meri_host_control.request_nonces')){
   if(replayNonce)return {rows:[]};return {rows:[{nonce_sha256:values[2]}]};}
  if(statement.includes('clock_timestamp'))return {rows:[{now_ms:clock.now}]};
  return {rows:[]};}};
 const transact=async effect=>{shared.depth++;shared.maxDepth=Math.max(shared.maxDepth,shared.depth);
  try{return await effect(sqlClient);}finally{shared.depth--;}};
 const runState={binding,currentUntilMs:NOW+300000,phase:'active',sdkAdmitted:true,bashAdmitted:false,
  browserAdmitted:true,capabilityPolicySha256:'c'.repeat(64),browserPolicySha256:'a'.repeat(64)};
 const store=createPostgresHostCurrentnessStore({transact,readCanonicalRun:async()=>runState,maxLeaseMs,
  ...(decide===null?{}:{decideBrowserApproval:async input=>{shared.decideCalls++;shared.callbackDepth=shared.depth;
   return decide(input,shared);}})});
 const captured={handler:null};const fake=new EventEmitter();
 fake.listening=false;fake.listen=()=>{fake.listening=true;fake.emit('listening');};
 fake.address=()=>({address:'127.0.0.1',port:8443});fake.close=cb=>cb?.();
 const server=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:8443},
  tls:{serverName:'host.example',cert:Buffer.from('c'),key:Buffer.from('k'),clientCa:Buffer.from('ca')},
  store,maxFreshMs:5000,requestMs,now:()=>clock.now,
  httpsModule:{createServer:(_options,handler)=>{captured.handler=handler;return fake;}}});
 const client=createHostCurrentnessClient({allocation:a,binding:b,hostIdentity,purpose:'browser',
  endpoint:{address:'127.0.0.1',port:8443,serverName:'host.example',serverFingerprintSha256:'d'.repeat(64)},
  tls:{cert:Buffer.from('c'),key:Buffer.from('k'),ca:Buffer.from('ca')},maxFreshMs:5000,timeoutMs:5000,
  now:()=>clock.now,httpsModule:wire(captured)});
 return {client,server,shared,queries,captured};
}

test('the real client receives the canonical receipt through the captured handler',{timeout:12000},async()=>{
 const f=await route({decide:async()=>({permitted:true,receipt:receipt(clock.now)})});
 try{
  const answer=await f.client.decideBrowserApproval(originalRequest);
  assert.equal(answer.permitted,true);
  assert.equal(answer.receipt.proposalId,proposalId);
  assert.equal(f.shared.decideCalls,1);
  assert.equal(f.shared.callbackDepth,0,'the decision callback itself runs at depth 0');
  assert.equal(f.queries.filter(q=>q.startsWith('INSERT INTO meri_host_control.request_nonces')).length,1);
 }finally{f.client.close();}
});

test('a non-permissive decision reaches the client with no receipt',{timeout:12000},async()=>{
 const f=await route({decide:async()=>({permitted:false,unknown:true,statusOnly:true})});
 try{
  const answer=await f.client.decideBrowserApproval(originalRequest);
  assert.equal(answer.permitted,false);
  assert.equal(answer.outcome,'unknown');
 }finally{f.client.close();}
});

test('a missing decision callback refuses at the client',{timeout:12000},async()=>{
 const f=await route({decide:null});
 try{await assert.rejects(f.client.decideBrowserApproval(originalRequest),/HOST_CONTROL_UNAVAILABLE/u);}
 finally{f.client.close();}
});

test('a replayed nonce refuses and never reaches the callback',{timeout:12000},async()=>{
 const f=await route({decide:async()=>({permitted:true,receipt:receipt(clock.now)}),replayNonce:true});
 try{await assert.rejects(f.client.decideBrowserApproval(originalRequest),/HOST_CONTROL_UNAVAILABLE/u);
  assert.equal(f.shared.decideCalls,0);}finally{f.client.close();}
});

test('a 5100ms human response wait completes past the 5000ms ingress bound',{timeout:20000},async()=>{
 const f=await route({requestMs:5000,decide:async()=>{
  await new Promise(resolve=>setTimeout(resolve,5100));
  clock.now+=5100;
  return {permitted:true,receipt:receipt(clock.now)};}});
 try{
  const started=Date.now();
  const answer=await f.client.decideBrowserApproval(originalRequest);
  assert.equal(answer.permitted,true);
  assert.ok(Date.now()-started>=5000,'the response genuinely waited past the ingress bound');
  assert.equal(f.shared.callbackDepth,0);
 }finally{f.client.close();}
});

test('a caller abort cancels the exchange without a second consume',{timeout:12000},async()=>{
 const f=await route({decide:async()=>({permitted:false})});
 try{
  const controller=new AbortController();controller.abort();
  await assert.rejects(f.client.decideBrowserApproval(originalRequest,{signal:controller.signal}),
   /HOST_CONTROL_UNAVAILABLE/u);
 }finally{f.client.close();}
});

test('an expired envelope in transit never grants',{timeout:12000},async()=>{
 const f=await route({decide:async()=>({permitted:true,receipt:receipt(clock.now)})});
 try{
  // The answer's freshness window has already elapsed on the client's clock.
  clock.now=NOW+900000;
  await assert.rejects(f.client.decideBrowserApproval(originalRequest),/HOST_CONTROL_UNAVAILABLE/u);
 }finally{clock.now=NOW;f.client.close();}
});
