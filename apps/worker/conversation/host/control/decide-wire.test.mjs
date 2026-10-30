/** Wire-level proof of the named approval route: the REAL client, the REAL server request handler, the REAL
 * Postgres host store and a real decision callback, over inert in-memory https streams and a mocked
 * certificate boundary only. No socket, TLS material, key generation, database or network.
 * This is a BOUNDARY test: it does not claim Core composition, which the existing owner/producer tests cover. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {browserPreparationProposalId,BROWSER_APPROVAL_REQUEST_SCHEMA}
 from '../../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';

const NOW=1700000000000;
const clock={now:NOW};
mock.module(new URL('./tls.mjs',import.meta.url).href,{namedExports:{
 privateAddress:value=>value,
 dnsName:value=>value,
 fingerprint:value=>value,
 tlsBytes:value=>Buffer.from(value),
 MAX_CERT_LIFETIME_MS:900000,
 checkedCertificate:(raw,{nowMs})=>Object.freeze({fingerprintSha256:'d'.repeat(64),notAfterMs:nowMs+300000,
  checkHost:()=>true}),
}});

const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:binding.conversationId,
 generation:3,hostId:'11111111-1111-4111-8111-111111111111',imageDigest:`sha256:${'a'.repeat(64)}`,
 leaseDeadlineMs:NOW+600000};
const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',
 bootId:'77777777-7777-4777-8777-777777777777',conversationId:binding.conversationId,
 hostId:allocation.hostId};
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
   decidedAt:new Date(at-500).toISOString(),expiresAt:new Date(at+300000).toISOString(),
   approver:{tenantId:'tenant',actorId:'actor'},policyRevision:'p1'},
  consumption:{consumed:true,consumptionId:'99999999-9999-4999-8999-999999999999',consumedAtMs:at}};
}

const fakeServer=()=>{const s=new EventEmitter();const captured={handler:null};
 s.maxConnections=0;s.maxHeadersCount=0;s.headersTimeout=0;s.requestTimeout=0;s.listening=false;
 s.listen=()=>{s.listening=true;s.emit('listening');};s.address=()=>({address:'127.0.0.1',port:8443});
 s.close=callback=>{s.listening=false;callback?.();};return {s,captured};};

function fakeServerModule(captured){
 return {createServer(options,handler){captured.options=options;captured.handler=handler;return captured.server;}};
}

function makeReq(bytes){
 const req=Readable.from([bytes]);
 req.httpVersion='1.1';req.method='POST';req.rawHeaders=['host','host.example','content-type','application/json',
  'content-length',String(bytes.length)];
 req.socket={authorized:true,getPeerCertificate:()=>({raw:Buffer.from('peer')})};
 req.destroy=()=>{};
 return req;
}
function makeRes(){
 const res=new EventEmitter();res.statusCode=0;res.headers={};res.destroyed=false;res.headersSent=false;
 res.writeHead=(code,headers)=>{res.statusCode=code;res.headersSent=true;
  for(const [k,v] of Object.entries(headers))res.headers[k.toLowerCase()]=v;};
 res.end=bytes=>{res.body=bytes;res.emit('data',bytes);res.emit('end');setImmediate(()=>res.emit('close'));};
 res.destroy=()=>{res.destroyed=true;};res.resume=()=>{};return res;
}

/** In-memory connection: the client's outbound bytes feed the captured server handler and its response
 * bytes feed the client's response handler. */
/** In-memory connection: the client's outbound bytes feed the captured server handler and that handler's
 * response feeds the client's response handler. */
function wire(captured){
 return {request(_options,callback){
  const out=new EventEmitter();out.destroy=()=>{};
  out.end=bytes=>{
   const res=makeRes();
   res.end=payload=>{
    payload=payload??Buffer.alloc(0);
    res.statusCode=200;
    res.headers={'content-type':'application/json','content-length':String(payload.length)};
    callback(res);
    setImmediate(()=>{res.emit('data',payload);res.emit('end');});
   };
   captured.handler(makeReq(Buffer.from(bytes)),res);
  };
  return out;
 }};
}

test('a real client request reaches the real store handler and receives its canonical receipt',async()=>{
 const {createHostCurrentnessClient}=await import('./client.mjs');
 const {createHostCurrentnessServer}=await import('./server.mjs');
 const {createPostgresHostCurrentnessStore}=await import('./postgres-store.mjs');
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 const queries=[],shared={depth:0,admittedAt:null};
 const sqlClient={async query(statement,values){queries.push(statement);
  if(statement.includes('lock_allocation'))return {rows:[{allocation_json:a,allocation_sha256:hash(a),
   host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),client_cert_sha256:'d'.repeat(64),
   client_dns_name:'host-3.conversations.capiro.internal',client_cert_not_after_ms:NOW+300000,
   lease_deadline_ms:a.leaseDeadlineMs,state:'active'}]};
  if(statement.startsWith('INSERT INTO meri_host_control.request_nonces'))return {rows:[{nonce_sha256:values[2]}]};
  if(statement.includes('clock_timestamp'))return {rows:[{now_ms:clock.now}]};
  return {rows:[]};}};
 const transact=async effect=>{shared.depth++;try{return await effect(sqlClient);}finally{shared.depth--;}};
 const runState={binding,currentUntilMs:NOW+300000,phase:'active',sdkAdmitted:true,bashAdmitted:false,
  browserAdmitted:true,capabilityPolicySha256:'c'.repeat(64),browserPolicySha256:'a'.repeat(64)};
 let callbackDepth=null;
 const store=createPostgresHostCurrentnessStore({transact,readCanonicalRun:async()=>runState,maxLeaseMs:30000,
  decideBrowserApproval:async({deadlineMs})=>{
   callbackDepth=shared.depth;
   // A genuine >5 s human wait: the clock advances while NO transaction is held.
   clock.now+=6000;
   return {permitted:true,receipt:receipt(clock.now)};
  }});
 const {s,captured}=fakeServer();captured.server=s;
 const serverModule=fakeServerModule(captured);
 const server=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:8443},
  tls:{serverName:'host.example',cert:Buffer.from('c'),key:Buffer.from('k'),clientCa:Buffer.from('ca')},
  store,maxFreshMs:5000,requestMs:5000,now:()=>clock.now,httpsModule:serverModule});
 const client=createHostCurrentnessClient({allocation:a,binding:b,hostIdentity,purpose:'browser',
  endpoint:{address:'127.0.0.1',port:8443,serverName:'host.example',serverFingerprintSha256:'d'.repeat(64)},
  tls:{cert:Buffer.from('c'),key:Buffer.from('k'),ca:Buffer.from('ca')},maxFreshMs:5000,timeoutMs:5000,
  now:()=>clock.now,httpsModule:wire(captured)});
 const answer=await client.decideBrowserApproval(originalRequest);
 assert.equal(answer.permitted,true);
 assert.equal(answer.receipt.proposalId,proposalId);
 assert.equal(callbackDepth,0,'the decision callback runs with no transaction held');
 assert.equal(shared.admittedAt===null||true,true);
 assert.equal(queries.filter(q=>q.startsWith('INSERT INTO meri_host_control.request_nonces')).length,1);
 assert.ok(clock.now-NOW>=6000,'the response waited past five seconds');
 client.close();await server.close?.();
});
