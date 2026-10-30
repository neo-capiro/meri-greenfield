/** FULL receipt round trip: real client -> captured server handler -> real authenticated host store ->
 * createBrowserReceiptProducer -> real createPostgresConversationStore/appendEvent over the inert store
 * fixture -> genuine event acknowledgement -> real client. Only SQL/HTTPS/certificate boundaries are faked. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';
import {hostClientDnsName,HOST_RECEIPT_PATH} from './protocol.mjs';
import {createBrowserReceiptProducer} from '../../../../control/browser-hosts/browser-receipts.mjs';
import {createPostgresConversationStore} from '../../../../control/conversations/postgres-store.mjs';
import {storeFixture,binding,scopes,versions} from '../../../../control/conversations/test/store-fixture.mjs';
import {MODEL_CATALOG} from '../../../../../packages/contracts/test/model-selection-fixture.mjs';
import {browserActionReceiptEventId} from '../../../../../packages/contracts/runtime-0.2/browser-receipt.mjs';
import {createBrowserHostRunFacts} from '../../../../runtime/browser-host-run-facts.mjs';
import {DEFAULT_BROWSER_POLICY} from '../../browser/policy.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';

mock.module(new URL('./tls.mjs',import.meta.url).href,{exports:{
 privateAddress:v=>v,dnsName:v=>v,fingerprint:v=>v,tlsBytes:v=>Buffer.from(v),MAX_CERT_LIFETIME_MS:900000,
 checkedCertificate:(_raw,{nowMs})=>Object.freeze({fingerprintSha256:'d'.repeat(64),notAfterMs:nowMs+300000})}});

const NOW=1700000000000,clock={now:NOW},SESSION='77777777-7777-4777-8777-777777777777';
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,
 conversationId:binding.conversationId,generation:3,hostId:'11111111-1111-4111-8111-111111111111',
 imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:NOW+600000};
const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',
 bootId:'77777777-7777-4777-8777-777777777777',conversationId:binding.conversationId,hostId:allocation.hostId};
const receiptFor=(overrides={})=>({schema:'meri-browser-receipt/1',kind:'browser.action',binding,
 sessionId:SESSION,toolUseId:'toolu_01',action:'click',urlHost:'app.example',atMs:NOW,reference:null,
 outcome:'ok',...overrides});

function conversationStore(){
 const f=storeFixture();
 const projection={binding,scopes,versions,state:'running',createdAt:new Date(NOW).toISOString(),policyRevision:'policy1'};
 const request={requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',prompt:'go'};
 f.state.runs.set(`${binding.tenantId}:${binding.conversationId}:${binding.runId}`,{tenant_id:binding.tenantId,
  conversation_id:binding.conversationId,run_id:binding.runId,request_id:request.requestId,projection,
  projection_sha256:hash(projection),request,request_sha256:hash(request),last_sequence:3,hold_control_id:null,
  sequence_end:null});
 return createPostgresConversationStore({pool:f.pool,modelCatalog:MODEL_CATALOG});
}

async function route({currentnessOverrides={}}={}){
 const {createHostCurrentnessClient}=await import('./client.mjs');
 const {createHostCurrentnessServer}=await import('./server.mjs');
 const {createPostgresHostCurrentnessStore}=await import('./postgres-store.mjs');
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 const queries=[],shared={depth:0,appendDepth:null,appends:0};
 const sqlClient={async query(statement,values){queries.push(statement);
  if(statement.includes('lock_allocation'))return {rows:[{allocation_json:a,allocation_sha256:hash(a),
   host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),client_cert_sha256:'d'.repeat(64),
   client_dns_name:hostClientDnsName(a),client_cert_not_after_ms:NOW+300000,lease_deadline_ms:a.leaseDeadlineMs,
   state:'active'}]};
  if(statement.startsWith('INSERT INTO meri_host_control.request_nonces'))return {rows:[{nonce_sha256:values[2]}]};
  if(statement.includes('clock_timestamp'))return {rows:[{now_ms:clock.now}]};
  return {rows:[]};}};
 const transact=async effect=>{shared.depth++;try{return await effect(sqlClient);}finally{shared.depth--;}};
 const browserPolicy={...DEFAULT_BROWSER_POLICY,enabled:true};
 const capabilityPolicy=assertCapabilityPolicy({});
 const state={binding,currentUntilMs:NOW+300000,phase:'active',sdkAdmitted:true,bashAdmitted:false,
  browserAdmitted:true,capabilityPolicySha256:hash(capabilityPolicy),
  browserPolicySha256:hash(browserPolicy),...currentnessOverrides};
 // The REAL facts producer normalizes the currentness projection; a hand-copied DTO is never used.
 const factsProducer=createBrowserHostRunFacts({currentness:{readFacts:async()=>Object.freeze({binding,scopes,
  deadlineMs:NOW+300000,currentUntilMs:NOW+300000,phase:'active',sdkAdmitted:true,bashAdmitted:false,
  browserAdmitted:true,capabilityPolicy,browserPolicy})}});
 const facts=await factsProducer.readCanonicalFacts({query:async()=>({rows:[]})},
  {allocation:{hostId:allocation.hostId,generation:allocation.generation},binding});
 const producer=createBrowserReceiptProducer({store:conversationStore(),now:()=>clock.now});
 const store=createPostgresHostCurrentnessStore({transact,readCanonicalRun:async()=>state,
  readCanonicalFacts:async()=>facts,maxLeaseMs:5000,
  recordBrowserReceipt:async value=>{shared.appends++;shared.appendDepth=shared.depth;return producer.appendAction(value);}});
 const captured={handler:null};const fake=new EventEmitter();
 fake.listening=false;fake.listen=()=>{fake.listening=true;fake.emit('listening');};
 fake.address=()=>({address:'127.0.0.1',port:8443});fake.close=cb=>cb?.();
 const server=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:8443},
  tls:{serverName:'host.example',cert:Buffer.from('c'),key:Buffer.from('k'),clientCa:Buffer.from('ca')},
  store,maxFreshMs:5000,requestMs:5000,now:()=>clock.now,
  httpsModule:{createServer:(_o,h)=>{captured.handler=h;return fake;}}});
 const wire=()=>({request(options,callback){const out=new EventEmitter();out.destroyed=false;
  out.destroy=()=>{out.destroyed=true;};
  out.end=bytes=>{if(out.destroyed)return;
   const res=new EventEmitter();res.statusCode=200;res.headers={};
   res.writeHead=(code,headers)=>{res.statusCode=code;for(const [k,v] of Object.entries(headers))res.headers[k.toLowerCase()]=v;};
   res.resume=()=>{};let done=false;
   const finish=payload=>{if(done)return;done=true;const c=new EventEmitter();
    c.statusCode=res.statusCode;c.headers={...res.headers};c.destroy=()=>{};c.resume=()=>{};
    callback(c);setImmediate(()=>{if(payload.length)c.emit('data',payload);c.emit('end');});};
   res.destroy=()=>finish(Buffer.alloc(0));
   res.end=payload=>finish(payload??Buffer.alloc(0));
   const req=Readable.from([Buffer.from(bytes)]);
   req.httpVersion='1.1';req.method='POST';req.url=options.path;
   req.rawHeaders=['host','h','content-type','application/json','content-length',String(Buffer.byteLength(bytes))];
   req.socket={authorized:true,getPeerCertificate:()=>({raw:Buffer.from('peer')})};
   captured.handler(req,res);};
  return out;}});
 const client=createHostCurrentnessClient({allocation:a,binding:b,hostIdentity,purpose:'browser',
  endpoint:{address:'127.0.0.1',port:8443,serverName:'host.example',serverFingerprintSha256:'d'.repeat(64)},
  tls:{cert:Buffer.from('c'),key:Buffer.from('k'),ca:Buffer.from('ca')},maxFreshMs:5000,timeoutMs:5000,
  now:()=>clock.now,httpsModule:wire()});
 return {client,shared,queries,server};
}

test('the real client records an action receipt and receives the durable event',{timeout:12000},async()=>{
 const f=await route();
 try{
  const ack=await f.client.recordBrowserReceipt(receiptFor());
  assert.equal(ack.eventId,browserActionReceiptEventId({binding,sessionId:SESSION,toolUseId:'toolu_01'}));
  assert.equal(ack.event.type,'browser.receipt');
  assert.equal(f.shared.appends,1);
  assert.equal(f.shared.appendDepth,0,'the producer appends with no host transaction held');
 }finally{f.client.close();}
});

test('an equal retry reuses the same event identity',{timeout:12000},async()=>{
 const f=await route();
 try{
  const first=await f.client.recordBrowserReceipt(receiptFor());
  const second=await f.client.recordBrowserReceipt(receiptFor());
  assert.equal(second.eventId,first.eventId);
  assert.equal(second.event.createdAt,first.event.createdAt,'stored time is preserved');
 }finally{f.client.close();}
});

test('a changed payload under the same identity conflicts',{timeout:12000},async()=>{
 const f=await route();
 try{
  await f.client.recordBrowserReceipt(receiptFor());
  await assert.rejects(f.client.recordBrowserReceipt(receiptFor({outcome:'error'})),/HOST_CONTROL_UNAVAILABLE/u);
 }finally{f.client.close();}
});

test('a receipt claiming another binding is refused before the append',{timeout:12000},async()=>{
 const f=await route();
 try{
  const foreign=receiptFor({binding:{...binding,runId:'88888888-8888-4888-8888-888888888888'}});
  await assert.rejects(f.client.recordBrowserReceipt(foreign),/HOST_CONTROL_UNAVAILABLE/u);
  assert.equal(f.shared.appends,0);
 }finally{f.client.close();}
});
