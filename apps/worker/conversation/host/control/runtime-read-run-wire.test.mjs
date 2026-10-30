/** CONNECTED proof: REAL client -> REAL captured server handler -> REAL Postgres host currentness store
 * over inert in-memory https streams, a mocked certificate boundary and a fake SQL transaction. The
 * helper builds the REAL runtime port per readRun. Nothing here opens a socket, TLS connection or database.
 */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {assertBrowserHostFacts} from '../../../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {validateSiteWorkflowManifest,SITE_WORKFLOW_MANIFEST_SCHEMA}
 from '../../browser/site-workflows/manifest.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';
import {BROWSER_APPROVAL_REQUEST_SCHEMA}
 from '../../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {hostClientDnsName} from './protocol.mjs';
import {binding as fixtureBinding,installation,sourceScopes,enabledPolicy,clock as nowFn}
 from '../../browser/test/fixtures.mjs';

mock.module(new URL('./tls.mjs',import.meta.url).href,{exports:{
 privateAddress:value=>value,dnsName:value=>value,fingerprint:value=>value,
 tlsBytes:value=>Buffer.from(value),MAX_CERT_LIFETIME_MS:900000,
 checkedCertificate:(_raw,{nowMs})=>Object.freeze({fingerprintSha256:'d'.repeat(64),notAfterMs:nowMs+300000}),
}});

const NOW=1700000000000,clock={now:NOW};
const binding={...fixtureBinding};
const allocation=assertHostAllocation({schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,
 conversationId:binding.conversationId,generation:3,hostId:'11111111-1111-4111-8111-111111111111',
 imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:NOW+600000});
const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',
 bootId:'77777777-7777-4777-8777-777777777777',conversationId:binding.conversationId,hostId:allocation.hostId};
const cwd='/workspace/conversations/'+binding.conversationId;
// host-owned model transport takes the CONTEXT-ONLY installation (no launch shim).
const {launch,...contextInstallation}=installation;
const MAX=['https://records.example','https://idp.example'];
const manifest=(over={})=>({schema:SITE_WORKFLOW_MANIFEST_SCHEMA,siteId:'synthetic-records',
 workflowId:'download-filings',version:1,taskSummary:'Synthetic: sign in and download the filings list',
 origins:['https://records.example'],idpOrigins:['https://idp.example'],
 signInUrl:'https://records.example/login',signedInProbe:{kind:'selector',value:'#account-menu'},
 sensitiveSelectors:['#security-answer'],
 tools:['browser_navigate','browser_snapshot','browser_click','browser_type'],
 approvalRequired:['browser_click','browser_type'],
 downloads:{formats:['pdf','xlsx'],maxBytes:1048576,maxFiles:3},sessionTtlMs:28800000,
 logoutUrl:'https://records.example/logout',tosReviewRef:null,qualificationEvidenceRef:null,...over});
function makeReq(bytes,path){
 const req=Readable.from([bytes]);
 req.httpVersion='1.1';req.method='POST';req.url=path;
 req.rawHeaders=['host','host.example','content-type','application/json','content-length',String(bytes.length)];
 req.socket={authorized:true,getPeerCertificate:()=>({raw:Buffer.from('peer')})};
 return req;
}
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
   let finished=false;
   const finish=payload=>{if(finished)return;finished=true;
    const clientRes=new EventEmitter();
    clientRes.statusCode=res.statusCode;clientRes.headers={...res.headers};
    clientRes.destroy=()=>{};clientRes.resume=()=>{};
    callback(clientRes);
    setImmediate(()=>{if(payload.length)clientRes.emit('data',payload);clientRes.emit('end');});};
   res.destroy=()=>{res.destroyed=true;finish(Buffer.alloc(0));};
   res.end=payload=>finish(payload??Buffer.alloc(0));
   captured.handler(makeReq(Buffer.from(bytes),options.path),res);
  };
  return out;
 }};
}
/** The canonical host store over a fake SQL transaction; policies and hashes are REAL. */
async function compose({factOverrides={},workflowOverrides={},decide=null,expired=false,rolling=null}={}){
 const {createHostCurrentnessClient}=await import('./client.mjs');
 const {createHostCurrentnessServer}=await import('./server.mjs');
 const {createPostgresHostCurrentnessStore}=await import('./postgres-store.mjs');
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 const capabilityPolicy={},browserPolicy={...enabledPolicy(),allowedOrigins:[...MAX]};
 const siteWorkflow={siteId:'synthetic-records',workflowId:'download-filings',version:1,
  manifestSha256:hash(validateSiteWorkflowManifest(manifest(),{platformMaximumOrigins:MAX}))};
 const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];
 const facts=()=>assertBrowserHostFacts({schema:'meri-browser-host-facts/3',binding:b,scopes,
  deadlineMs:expired?NOW-1000:NOW+900000,currentUntilMs:expired?NOW-2000:(rolling?rolling.now:NOW+300000),phase:'active',admitted:{sdk:true,bash:false,browser:true},
  capabilityPolicy,capabilityPolicySha256:hash(capabilityPolicy),
  browserPolicy,browserPolicySha256:hash(browserPolicy),siteWorkflow,...factOverrides},{binding:b});
 const runState={binding:b,currentUntilMs:NOW+300000,phase:'active',sdkAdmitted:true,bashAdmitted:false,
  browserAdmitted:true,capabilityPolicySha256:hash(capabilityPolicy),browserPolicySha256:hash(browserPolicy)};
 const workflow=(()=>{const saved=siteWorkflow;
  return {enabled:true,manifest:manifest(),manifestSha256:saved.manifestSha256,...workflowOverrides};})();
 const sqlClient={async query(statement,values){
  if(statement.includes('lock_allocation'))return {rows:[{allocation_json:a,allocation_sha256:hash(a),
   host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),client_cert_sha256:'d'.repeat(64),
   client_dns_name:hostClientDnsName(a),client_cert_not_after_ms:NOW+300000,lease_deadline_ms:a.leaseDeadlineMs,
   state:'active'}]};
  if(statement.startsWith('INSERT INTO meri_host_control.request_nonces'))return {rows:[{nonce_sha256:values[2]}]};
  if(statement.includes('clock_timestamp'))return {rows:[{now_ms:clock.now}]};
  return {rows:[]};}};
 const store=createPostgresHostCurrentnessStore({transact:async effect=>effect(sqlClient),
  readCanonicalRun:async()=>runState,readCanonicalFacts:async()=>facts(),
  resolveWorkflow:async()=>workflow,maxLeaseMs:5000,...(decide===null?{}:{decideBrowserApproval:decide})});
 const captured={handler:null};const fake=new EventEmitter();
 fake.listening=false;fake.listen=()=>{fake.listening=true;fake.emit('listening');};
 fake.address=()=>({address:'127.0.0.1',port:8443});fake.close=cb=>cb?.();
 const server=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:8443},
  tls:{serverName:'host.example',cert:Buffer.from('c'),key:Buffer.from('k'),clientCa:Buffer.from('ca')},
  store,maxFreshMs:5000,requestMs:5000,now:()=>clock.now,
  httpsModule:{createServer:(_options,handler)=>{captured.handler=handler;return fake;}}});
 const client=createHostCurrentnessClient({allocation:a,binding:b,hostIdentity,purpose:'browser',
  endpoint:{address:'127.0.0.1',port:8443,serverName:'host.example',serverFingerprintSha256:'d'.repeat(64)},
  tls:{cert:Buffer.from('c'),key:Buffer.from('k'),ca:Buffer.from('ca')},maxFreshMs:5000,timeoutMs:5000,
  now:()=>clock.now,httpsModule:wire(captured)});
 return {client,server,store,workflow,facts,siteWorkflow};
}

test('readRun and every retained callback work through the REAL client, server and store',{timeout:12000},async()=>{
 const {client,server,siteWorkflow}=await compose();
 const {createBrowserHostReadRun}=await import('./runtime-read-run.mjs');
 const run=createBrowserHostReadRun({allocation,binding,cwd,client,installation:contextInstallation,
  egress:{endpoint:installation.egressProxy,async grant(){},async revoke(){}},
  processes:{async waitForExit(){return {exited:false};}},artifacts:{async ingest(){return {stored:false};}}});
 const prepare=new AbortController();
const prepared=await run.readRun({binding,signal:prepare.signal});
 assert.equal(prepared.deadlineMs,NOW+900000,'the ORIGINAL run deadline, not the rolling cutoff');
 assert.equal(prepared.binding.runId,binding.runId);
 assert.equal(prepared.port.modelTransport,'host-owned');
 prepare.abort(); // the preparation operation is over: retained callbacks must NOT depend on it
const policy=await run.policy({binding,signal:new AbortController().signal});
 assert.equal(policy.enabled,true);
const workflow=await run.siteWorkflows.resolve({binding,signal:new AbortController().signal});
 assert.equal(workflow.manifest.siteId,siteWorkflow.siteId);
 assert.equal(workflow.manifestSha256,siteWorkflow.manifestSha256);
 assert.equal(workflow.enabled,true);
 const dead=new AbortController();dead.abort();
 await assert.rejects(()=>run.siteWorkflows.resolve({binding,signal:dead.signal}),
  /BROWSER_HOST_READ_RUN_REFUSED/u);
 client.close();server.close();
});

test('a foreign binding, a bad digest, an out-of-policy origin and a changed selection are refused',{timeout:12000},async()=>{
 const {client}=await compose();
 const {createBrowserHostReadRun}=await import('./runtime-read-run.mjs');
 const run=createBrowserHostReadRun({allocation,binding,cwd,client,installation:contextInstallation,
  egress:{endpoint:installation.egressProxy,async grant(){},async revoke(){}},
  processes:{async waitForExit(){}},artifacts:{async ingest(){}}});
 await assert.rejects(()=>run.readRun({binding:{...binding,runId:'99999999-9999-4999-8999-999999999999'}}),
  /BROWSER_HOST_READ_RUN_REFUSED/u);
 await assert.rejects(()=>run.policy({binding:{...binding,writerFence:binding.writerFence+1}}),
  /BROWSER_HOST_READ_RUN_REFUSED/u);
 await assert.rejects(()=>run.siteWorkflows.resolve({binding:{...binding,attemptId:'99999999-9999-4999-8999-999999999999'}}),
  /BROWSER_HOST_READ_RUN_REFUSED/u);
 client.close();
 // The saved selection digest is the only one admitted: an answered digest that differs from it refuses.
 const tampered=await compose({workflowOverrides:{manifestSha256:'e'.repeat(64)}});
 await assert.rejects(()=>tampered.client.resolveBrowserWorkflow({binding}),/HOST_CONTROL_UNAVAILABLE/u);
 tampered.client.close();
 // A manifest origin outside the fresh canonical policy is refused by the real validator itself.
 const outsideManifest={...manifest(),origins:['https://not-approved.example']};
 assert.throws(()=>validateSiteWorkflowManifest(outsideManifest,{platformMaximumOrigins:MAX}),
  /SITE_WORKFLOW_/u);
});

test('the receipt closure forwards the ORIGINAL receipt and its own signal',async()=>{
 const seen=[];
 const fakeClient={readFacts(){},resolveBrowserWorkflow(){},decideBrowserApproval(){},
  async recordBrowserReceipt(receipt,options){seen.push([receipt,options?.signal]);return {eventId:'e',recorded:true};}};
 const {createBrowserHostReadRun}=await import('./runtime-read-run.mjs');
 const run=createBrowserHostReadRun({allocation,binding,cwd,client:fakeClient,installation:contextInstallation,
  egress:{endpoint:installation.egressProxy,async grant(){},async revoke(){}},
  processes:{async waitForExit(){}},artifacts:{async ingest(){}}});
 const receipt=Object.freeze({schema:'meri-browser-action-receipt/1',toolUseId:'toolu_01HZX'});
 const signal=new AbortController().signal;
 const ack=await run.receipts.record(receipt,{signal});
 assert.equal(seen.length,1);assert.equal(seen[0][0],receipt,'the original receipt object is forwarded unchanged');
 assert.equal(seen[0][1],signal,"the caller's own signal is forwarded");
 assert.equal(ack.recorded,true);
 const dead=new AbortController();dead.abort();
 await assert.rejects(()=>run.receipts.record(receipt,{signal:dead.signal}),/BROWSER_HOST_READ_RUN_REFUSED/u);
 assert.equal(seen.length,1,'a cancelled callback never reaches the client');
});

test('a non-permitted decision never becomes a receipt through the helper',{timeout:12000},async()=>{
 const {client}=await compose({decide:async()=>({permitted:false,unknown:true,statusOnly:true})});
 const {createBrowserHostReadRun}=await import('./runtime-read-run.mjs');
 const run=createBrowserHostReadRun({allocation,binding,cwd,client,installation:contextInstallation,
  egress:{endpoint:installation.egressProxy,async grant(){},async revoke(){}},
  processes:{async waitForExit(){}},artifacts:{async ingest(){}}});
 const toolUseId='toolu_01HZX';
 const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',
  toolUseId,inputSha256:hash({tool:'browser_click',arguments:{}}),pageOrigin:'https://app.capiro.example',
  policySha256:'a'.repeat(64)};
 const request={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),
  input:{tool:'browser_click',arguments:{}},requestedAtMs:NOW-1000,expiresAtMs:NOW+600000};
 await assert.rejects(()=>run.approvals.decide(request,{signal:new AbortController().signal}),
  /BROWSER_HOST_READ_RUN_REFUSED/u,'a non-permitted answer yields no receipt');
 client.close();
});

test('expired facts are refused, and construction requires every trusted owner',{timeout:12000},async()=>{
 const expired=await compose({expired:true});
 await assert.rejects(()=>expired.client.readFacts({allocation,binding}),/HOST_CONTROL_UNAVAILABLE/u);
 expired.client.close();
 const {createBrowserHostReadRun}=await import('./runtime-read-run.mjs');
 const base={allocation,binding,cwd,installation:contextInstallation,
  egress:{endpoint:installation.egressProxy,async grant(){},async revoke(){}},
  processes:{async waitForExit(){}},artifacts:{async ingest(){}}};
 const client={readFacts(){},resolveBrowserWorkflow(){},decideBrowserApproval(){},recordBrowserReceipt(){}};
 const noArtifacts={...base,client};delete noArtifacts.artifacts;
 assert.throws(()=>createBrowserHostReadRun(noArtifacts),/BROWSER_HOST_READ_RUN_REFUSED/u,
  'the artifact owner is required');
 const noClient={...base};delete noClient.client;
 assert.throws(()=>createBrowserHostReadRun(noClient),/BROWSER_HOST_READ_RUN_REFUSED/u);
 const {createBrowserHostReadRun:make}=await import('./runtime-read-run.mjs');
 assert.throws(()=>make({...base,cwd:'relative/path',client}),/BROWSER_HOST_READ_RUN_REFUSED/u);
 assert.throws(()=>make({...base,client:{readFacts(){}}}),/BROWSER_HOST_READ_RUN_REFUSED/u,
  'the currentness client must expose every mapped callback');
});

test('a rolling currentUntilMs never changes the pinned deadline or binding',{timeout:12000},async()=>{
 const rolling={now:NOW+300000};
 const {client,server}=await compose({rolling});
 const {createBrowserHostReadRun}=await import('./runtime-read-run.mjs');
 const run=createBrowserHostReadRun({allocation,binding,cwd,client,installation:contextInstallation,
  egress:{endpoint:installation.egressProxy,async grant(){},async revoke(){}},
  processes:{async waitForExit(){}},artifacts:{async ingest(){}}});
 const first=await run.readRun({binding});
 rolling.now=NOW+330000;
 const second=await run.readRun({binding});
 assert.equal(first.deadlineMs,second.deadlineMs,'the ORIGINAL run deadline is stable');
 assert.equal(hash(first.binding),hash(second.binding));
 assert.notEqual(second.deadlineMs,rolling.now);
 client.close();server.close();
});
