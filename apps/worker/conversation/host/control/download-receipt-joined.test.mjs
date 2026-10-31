/** JOINED proof: createDownloadPort file -> client artifact port -> real client -> captured server handler ->
 * real host store -> REAL canonical artifact publisher (PG adapter over inert SQL + real publication journal) ->
 * named download receipt through the REAL producer/real conversation store -> durable ACK.
 * Only TLS/SQL/Core/object transport boundaries are inert; no target owner is replaced. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {mkdtemp,writeFile,readdir,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';
import {hostClientDnsName,HOST_DOWNLOAD_RECEIPT_PATH,HOST_INGEST_PATH} from './protocol.mjs';
import {createBrowserReceiptProducer} from '../../../../control/browser-hosts/browser-receipts.mjs';
import {createPostgresConversationStore} from '../../../../control/conversations/postgres-store.mjs';
import {storeFixture,binding,scopes,versions as runVersions} from '../../../../control/conversations/test/store-fixture.mjs';
import {MODEL_CATALOG} from '../../../../../packages/contracts/test/model-selection-fixture.mjs';
import {browserDownloadReceiptEventId} from '../../../../../packages/contracts/runtime-0.2/browser-receipt.mjs';
import {createBrowserHostRunFacts} from '../../../../runtime/browser-host-run-facts.mjs';
import {DEFAULT_BROWSER_POLICY} from '../../browser/policy.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
import {createBrowserArtifactPublication} from '../../../../runtime/browser-artifact-publication.mjs';
import {createBrowserDownloadReceiptRecorder} from '../../../../runtime/browser-download-receipt.mjs';
import {clientArtifactPort} from '../../../../runtime/browser-host-service/read-run.mjs';
import {createDownloadPort} from '../../browser/downloads.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {createLocalArtifactStore} from '../../../../artifacts/local-store.mjs';
import {createPostgresIntentJournalStore} from '../../../../control/intents/postgres-journal.mjs';
import {createBrowserDownloadReservations} from '../../../../control/intents/browser-download-reservations.mjs';
import {sqlFixture,NOW} from '../../../../artifacts/storage/test/sql-fixture.mjs';
import {publicationFixture} from '../../../../artifacts/storage/test/publication-fixture.mjs';
import {createPostgresArtifactVersions} from '../../../../artifacts/storage/postgres-versions.mjs';
import {validators} from '../../../../artifacts/test/artifact-harness.mjs';

mock.module(new URL('./tls.mjs',import.meta.url).href,{exports:{
 privateAddress:v=>v,dnsName:v=>v,fingerprint:v=>v,tlsBytes:v=>Buffer.from(v),MAX_CERT_LIFETIME_MS:900000,
 checkedCertificate:(_raw,{nowMs})=>Object.freeze({fingerprintSha256:'d'.repeat(64),notAfterMs:nowMs+300000})}});

const clock={now:NOW};
const SESSION='77777777-7777-4777-8777-777777777777';
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,
 conversationId:binding.conversationId,generation:3,hostId:'11111111-1111-4111-8111-111111111111',
 imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:NOW+600000};
const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',
 bootId:SESSION,conversationId:binding.conversationId,hostId:allocation.hostId};
const fileBytes=Buffer.from('downloaded filing bytes\n');

function conversationStore(){
 const f=storeFixture();
 const projection={binding,scopes,versions:runVersions,state:'running',createdAt:new Date(NOW).toISOString(),policyRevision:'policy1'};
 const request={requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',prompt:'go'};
 f.state.runs.set(`${binding.tenantId}:${binding.conversationId}:${binding.runId}`,{tenant_id:binding.tenantId,
  conversation_id:binding.conversationId,run_id:binding.runId,request_id:request.requestId,projection,
  projection_sha256:hash(projection),request,request_sha256:hash(request),last_sequence:3,hold_control_id:null,
  sequence_end:null});
 return {store:createPostgresConversationStore({pool:f.pool,modelCatalog:MODEL_CATALOG}),fixture:f};
}


/** Real intent-journal adapter over a serialized in-process SQL double (same table, no DB). */
function createJournalOwner(){
 const rows=new Map();let tail=Promise.resolve();
 const pool={async connect(){let local,unlock;
  return {async query(sql,p=[]){
   const out=x=>({rows:structuredClone(x),rowCount:x.length});
   if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return out([]);
   if(sql==='COMMIT'){tail=Promise.resolve();return out([]);}
   if(sql==='ROLLBACK')return out([]);
   if(!local){const prior=tail;tail=new Promise(r=>unlock=r);await prior;local=new Map([...rows].map(([k,v])=>[k,structuredClone(v)]));}
   if(sql.startsWith('SELECT pg_advisory_xact_lock'))return out([]);
   if(sql.includes("run_id IS NULL"))return out([{n:0}]);
   if(sql.includes('count(*)::int')){const n=[...new Map([...rows,...local]).values()].filter(r=>r.tenant===p[0]&&r.actor===p[1]&&r.conv===p[2]&&r.run_id===p[3]&&r.record.operation.id==='browser_download'&&r.state!=='FAILED').length;return out([{n}]);}
   const key=JSON.stringify(p.slice(0,4));
   if(sql.startsWith('INSERT')){if(local.has(key))return out([]);const row={tenant:p[0],actor:p[1],conv:p[2],delivery_id:p[3],record:p[4],record_sha256:p[5],state:'PENDING',outcome:null,settled_at:null,run_id:p[6]};local.set(key,row);rows.set(key,row);return out([row]);}
   if(sql.startsWith('SELECT'))return out(local.has(key)?[local.get(key)]:[]);
   if(sql.startsWith('UPDATE')){const row=local.get(key);if(!row||row.state!=='PENDING'||row.record_sha256!==p[4])return out([]);row.state=p[5];row.outcome=p[6]??null;row.settled_at=new Date();rows.set(key,row);return out([row]);}
   return out([]);
  },release(){unlock?.();}};}};
 return createBrowserDownloadReservations({store:createPostgresIntentJournalStore({pool})});
}

async function joinedFixture(t,{dropFirstReceiptResponse=false,dropFirstIngestResponse=false,onResolve=null,onRecheck=null,reservations=false,maxFiles=20}={}){
 const {createHostCurrentnessClient}=await import('./client.mjs');
 const {createHostCurrentnessServer}=await import('./server.mjs');
 const {createPostgresHostCurrentnessStore}=await import('./postgres-store.mjs');
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 const dir=await realpath(await mkdtemp(join(tmpdir(),'meri-joined-download-'))),root=join(dir,'store');
 const objects=await createLocalArtifactStore({root,canonicalSha256:hash});
 t.after(async()=>{await objects.dispose();await rm(dir,{recursive:true,force:true});});
 const sql=sqlFixture();
 const durable=publicationFixture(binding.tenantId,()=>clock.now);
 const artifactVersions=createPostgresArtifactVersions({pool:sql.pool,now:()=>clock.now,maxRequestMs:100,
  journal:sql.journal,retention:sql.retention,publication:durable.publication,tenantId:binding.tenantId});
 const authorize=async({action,resource,binding:rb,scopes:rs,requestSha256,deadlineMs})=>({receiptId:'synthetic-authority',
  decision:'allow',action,binding:rb,scopesSha256:hash(rs),resourceSha256:hash(resource),requestSha256,
  expiresAtMs:Math.min(deadlineMs,clock.now+30000)});
 const checks=[];
 const resolve=async input=>{if(onResolve)onResolve(input);return ({documentOptions:{artifactOptions:{context:{binding,scopes,evidence:[],assets:[],
  deadlineMs:clock.now+600000,maxBytes:8388608},validators,authorize,versions:artifactVersions,objects:objects.objects,
  executor:{async execute(){throw Error('synthetic: ingest never renders')}},now:()=>clock.now,
  ids:()=>({artifactId:'synthetic',versionId:'synthetic',objectId:'synthetic'})}},
  async recheck(value){checks.push({...value});await onRecheck?.(value);}});};
 const credentialCalls=[];
 const sessions={nativeCredentialFor:args=>{credentialCalls.push(args);return {credential:'synthetic-bearer',expiresAtMs:clock.now+30000};}};
 const publication=createBrowserArtifactPublication({resolve,sessions,now:()=>clock.now,requestMs:30000});
 const conversation=conversationStore();
 const producer=createBrowserReceiptProducer({store:conversation.store,now:()=>clock.now});
 const journalReservations=(()=>{let value=null;return()=>value??=createJournalOwner();})();
 const receiptRecorder=createBrowserDownloadReceiptRecorder({resolve,sessions,
  append:value=>producer.appendDownload(value),now:()=>clock.now,
  read:async({binding,eventId},signal)=>conversation.store.read(binding,{after:3,limit:100},()=>{
   if(signal?.aborted)throw Object.assign(Error('CANCELLED'),{code:'CANCELLED'});}).then(state=>
    state.events.find(event=>event.eventId===eventId)??null)});
 const shared={appends:0,dropped:false};
 const appendDownload=async value=>{shared.appends++;return receiptRecorder.record(value);};
 const sqlClient={async query(statement,values){
  if(statement.includes('lock_allocation'))return {rows:[{allocation_json:a,allocation_sha256:hash(a),
   host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),client_cert_sha256:'d'.repeat(64),
   client_dns_name:hostClientDnsName(a),client_cert_not_after_ms:clock.now+300000,lease_deadline_ms:a.leaseDeadlineMs,
   state:'active'}]};
  if(statement.startsWith('INSERT INTO meri_host_control.request_nonces'))return {rows:[{nonce_sha256:values[2]}]};
  if(statement.includes('clock_timestamp'))return {rows:[{now_ms:clock.now}]};
  return {rows:[]};}};
 const transact=async effect=>effect(sqlClient);
 const browserPolicy={...DEFAULT_BROWSER_POLICY,enabled:true,allowedOrigins:['https://files.example'],downloads:{...DEFAULT_BROWSER_POLICY.downloads,maxFiles}};
 const capabilityPolicy=assertCapabilityPolicy({});
 const state={binding,currentUntilMs:NOW+900000,phase:'active',sdkAdmitted:true,bashAdmitted:false,
  browserAdmitted:true,capabilityPolicySha256:hash(capabilityPolicy),browserPolicySha256:hash(browserPolicy)};
 const factsProducer=createBrowserHostRunFacts({currentness:{readFacts:async()=>Object.freeze({binding,scopes,
  deadlineMs:NOW+300000,currentUntilMs:NOW+900000,phase:'active',sdkAdmitted:true,bashAdmitted:false,
  browserAdmitted:true,capabilityPolicy,browserPolicy})}});
 const facts=await factsProducer.readCanonicalFacts({query:async()=>({rows:[]})},
  {allocation:{hostId:allocation.hostId,generation:allocation.generation},binding});
 const store=createPostgresHostCurrentnessStore({transact,readCanonicalRun:async()=>state,
  readCanonicalFacts:async()=>facts,maxLeaseMs:5000,
  ingestBrowserArtifact:value=>publication.ingest(value),
  recordBrowserDownloadReceipt:value=>appendDownload(value),
  reconcileBrowserDownload:value=>receiptRecorder.reconcile(value),
  ...(reservations?{downloadReservations:journalReservations(),reconcileDownload:value=>receiptRecorder.reconcile(value)}:{})});
 const captured={handler:null};const fake=new EventEmitter();
 fake.listening=false;fake.listen=()=>{fake.listening=true;fake.emit('listening');};
 fake.address=()=>({address:'127.0.0.1',port:8443});fake.close=cb=>cb?.();
 const server=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:8443},
  tls:{serverName:'host.example',cert:Buffer.from('c'),key:Buffer.from('k'),clientCa:Buffer.from('ca')},
  store,maxFreshMs:5000,requestMs:5000,now:()=>clock.now,
  httpsModule:{createServer:(_o,h)=>{captured.handler=h;return fake;}}});
 const wire={request(options,callback){const out=new EventEmitter();out.destroyed=false;
  out.destroy=()=>{out.destroyed=true;};
  out.end=bytes=>{if(out.destroyed)return;
   const res=new EventEmitter();res.statusCode=200;res.headers={};
   res.writeHead=(code,headers)=>{res.statusCode=code;for(const [k,v] of Object.entries(headers))res.headers[k.toLowerCase()]=v;};
   res.resume=()=>{};let done=false;
   const drop=(dropFirstReceiptResponse&&options.path===HOST_DOWNLOAD_RECEIPT_PATH&&!shared.dropped)||
    (dropFirstIngestResponse&&options.path===HOST_INGEST_PATH&&!shared.ingestDropped);
   if(drop){if(options.path===HOST_DOWNLOAD_RECEIPT_PATH)shared.dropped=true;else shared.ingestDropped=true;}
   const finish=payload=>{if(done)return;done=true;const c=new EventEmitter();
    c.statusCode=res.statusCode;c.headers={...res.headers};c.destroy=()=>{};c.resume=()=>{};
    callback(c);setImmediate(()=>{if(payload.length)c.emit('data',payload);c.emit('end');});};
   res.destroy=()=>finish(Buffer.alloc(0));
   res.end=payload=>drop?finish(Buffer.alloc(0)):finish(payload??Buffer.alloc(0));
   const req=Readable.from([Buffer.from(bytes)]);
   req.httpVersion='1.1';req.method='POST';req.url=options.path;
   req.rawHeaders=['host','h','content-type','application/json','content-length',String(Buffer.byteLength(bytes))];
   req.socket={authorized:true,getPeerCertificate:()=>({raw:Buffer.from('peer')})};
   captured.handler(req,res);};
  return out;}};
 const client=createHostCurrentnessClient({allocation:a,binding:b,hostIdentity,purpose:'browser',
  endpoint:{address:'127.0.0.1',port:8443,serverName:'host.example',serverFingerprintSha256:'d'.repeat(64)},
  tls:{cert:Buffer.from('c'),key:Buffer.from('k'),ca:Buffer.from('ca')},maxFreshMs:5000,timeoutMs:5000,
  now:()=>clock.now,httpsModule:wire});
 const receipts=[];
 const port=createDownloadPort({binding,policy:validateBrowserPolicy({enabled:true,
   allowedOrigins:['https://files.example']}),policySha256:'a'.repeat(64),sourceScopes:scopes,
  paths:{output:dir},artifacts:clientArtifactPort(client),
  receipts:{async record(value,options){const ack=await client.recordBrowserDownloadReceipt(value,options);
   receipts.push(ack);}},
  reconcile:({filename},options={})=>client.reconcileBrowserDownload({filename},options),
  now:()=>clock.now,assertCurrent:async()=>{}});
 const recreate=()=>createDownloadPort({binding,policy:validateBrowserPolicy({enabled:true,
   allowedOrigins:['https://files.example']}),policySha256:'a'.repeat(64),sourceScopes:scopes,
  paths:{output:dir},artifacts:clientArtifactPort(client),
  receipts:{async record(value,options){const ack=await client.recordBrowserDownloadReceipt(value,options);
   receipts.push(ack);}},
  reconcile:({filename},options={})=>client.reconcileBrowserDownload({filename},options),
  now:()=>clock.now,assertCurrent:async()=>{}});
 return {port,recreate,dir,client,sql,durable,receipts,shared,conversation,producer,checks,credentialCalls,state};
}

test('a downloaded file becomes ONE canonical version and ONE durable download receipt through the joined route',{timeout:20000},async t=>{
 const f=await joinedFixture(t);
 try{
  await writeFile(join(f.dir,'filing.txt'),fileBytes);
  const ack=await f.port.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'});
  assert.equal(typeof ack.versionId,'string');
  assert.equal(f.sql.state.versions.size,1,'one projected artifact version');
  assert.equal(f.durable.state.index.decisions.length,1);
  assert.equal(f.receipts.length,1,'one receipt acknowledgement');
  assert.equal(f.receipts[0].event.data.kind,'browser.download');
  assert.equal(f.receipts[0].event.data.reference,ack.versionId);
  assert.equal(f.receipts[0].eventId,browserDownloadReceiptEventId({binding,reference:ack.versionId}));
  // The receipt is durable: an identical replay returns the stored event and timestamp.
  const replay=await f.client.recordBrowserDownloadReceipt({schema:'meri-browser-receipt/1',kind:'browser.download',
   binding,urlHost:'files.example',atMs:NOW,reference:ack.versionId,sha256:ack.sha256,bytes:ack.bytes,mimeType:ack.mimeType});
  assert.equal(replay.eventId,f.receipts[0].eventId);
  assert.equal(replay.event.createdAt,new Date(NOW).toISOString());
  assert.equal((await readdir(f.dir)).includes('filing.txt'),false);
 }finally{f.client.close();clock.now=NOW;}
});

test('a committed receipt whose ACK is lost is recovered later from the SAME operation facts',{timeout:20000},async t=>{
 const f=await joinedFixture(t,{dropFirstReceiptResponse:true});
 try{
  await writeFile(join(f.dir,'filing.txt'),fileBytes);
  await assert.rejects(()=>f.port.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'}),
   error=>error.code==='BROWSER_DOWNLOAD_RECEIPT_UNKNOWN');
  assert.equal(f.sql.state.versions.size,1,'the version committed');
  assert.equal(f.durable.state.index.decisions.length,1);
  assert.equal(f.receipts.length,0,'the acknowledgement was lost');
  assert.ok((await readdir(f.dir)).includes('filing.txt'));
  clock.now=NOW+5000;
  const [expectedId]=[...f.sql.state.versions.keys()];
  const done=await f.port.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'});
  assert.equal(done.versionId,expectedId,'the retry reconciles the ORIGINAL version');
  assert.equal(f.sql.state.versions.size,1,'no second version');
  assert.equal(f.durable.state.index.decisions.length,1,'no second publication');
  assert.equal(f.receipts.length,1,'one durable receipt');
  assert.equal(f.receipts[0].event.data.atMs,NOW,'the ORIGINAL operation timestamp is preserved');
  assert.equal(f.receipts[0].event.createdAt,new Date(NOW).toISOString(),'the stored event time is the original');
  assert.equal((await readdir(f.dir)).includes('filing.txt'),false);
 }finally{f.client.close();clock.now=NOW;}
});

test('a RECREATED worker with the original file gone recovers the ORIGINAL version and receipt read-only',{timeout:20000},async t=>{
 const f=await joinedFixture(t);
 try{
  await writeFile(join(f.dir,'filing.txt'),fileBytes);
  const first=await f.port.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'});
  assert.equal((await readdir(f.dir)).includes('filing.txt'),false);
  const before=f.receipts.length;
  const restarted=f.recreate();
  const again=await restarted.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'});
  assert.equal(again.recovered,true);
  assert.equal(again.versionId,first.versionId,'the SAME original version');
  assert.equal(again.sha256,first.sha256);
  assert.equal(f.sql.state.versions.size,1,'no republish');
  assert.equal(f.durable.state.index.decisions.length,1);
  assert.equal(f.receipts.length,before,'no second receipt was appended');
 }finally{f.client.close();clock.now=NOW;}
});

test('after the ORIGINAL write window expired, discovery is allowed read-only and writes nothing',{timeout:20000},async t=>{
 const f=await joinedFixture(t);
 try{
  await writeFile(join(f.dir,'filing.txt'),fileBytes);
  const first=await f.port.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'});
  clock.now=NOW+301000; // original facts deadline passed, current authority and lease still live
  const found=await f.client.reconcileBrowserDownload({filename:'filing.txt'});
  assert.equal(f.credentialCalls.at(-1).selectedClientId,scopes[0].resourceId,'client recovery uses the SAME selected client');
  assert.equal(found.versionId,first.versionId);
  assert.equal(found.receipt.eventId,f.receipts[0].eventId);
  assert.equal(f.sql.state.versions.size,1);
  assert.equal(f.durable.state.index.decisions.length,1);
  assert.equal(f.receipts.length,1,'no append after expiry');
 }finally{f.client.close();clock.now=NOW;}
});

test('a committed version with NO receipt is reported as an accurate partial, never completed after expiry',{timeout:20000},async t=>{
 const f=await joinedFixture(t);
 try{
  await writeFile(join(f.dir,'filing.txt'),fileBytes);
  // A refusal AFTER the canonical ingest commits (before any receipt) leaves version + unknown receipt.
  const partial=createDownloadPort({binding,policy:validateBrowserPolicy({enabled:true,
    allowedOrigins:['https://files.example']}),policySha256:'a'.repeat(64),sourceScopes:scopes,
   paths:{output:f.dir},artifacts:clientArtifactPort(f.client),
   receipts:{async record(){throw Object.assign(new Error('BROWSER_DOWNLOAD_RECEIPT_UNKNOWN'),
    {code:'BROWSER_DOWNLOAD_RECEIPT_UNKNOWN'});}},now:()=>clock.now,assertCurrent:async()=>{}});
  await assert.rejects(()=>partial.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'}),
   error=>error.code==='BROWSER_DOWNLOAD_RECEIPT_UNKNOWN');
  assert.equal(f.sql.state.versions.size,1);
  await rm(join(f.dir,'filing.txt'),{force:true});
  await assert.rejects(()=>f.recreate().accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'}),
   error=>error.code==='BROWSER_DOWNLOAD_RECEIPT_PARTIAL');
  assert.equal(f.receipts.length,0,'no receipt was invented');
  assert.equal(f.sql.state.versions.size,1);
 }finally{f.client.close();clock.now=NOW;}
});

test('a revoked authority discovered during the owner read refuses the answer without writes',{timeout:20000},async t=>{
 const f=await joinedFixture(t,{onResolve:input=>{if(input.body?.filename&&!input.body?.sha256)f.state.browserAdmitted=false;}});
 try{
  await writeFile(join(f.dir,'filing.txt'),fileBytes);
  const first=await f.port.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'});
  assert.equal(f.sql.state.versions.size,1);
  await assert.rejects(()=>f.recreate().accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'}),
   error=>error.code==='BROWSER_DOWNLOAD_RECOVERY');
  assert.equal(f.receipts.length,1,'no late positive');
  assert.equal(f.sql.state.versions.size,1);
 }finally{f.client.close();clock.now=NOW;}
});

test('a fabricated version reference or foreign binding never yields a receipt',{timeout:20000},async t=>{
 const f=await joinedFixture(t);
 try{
  await assert.rejects(()=>f.client.recordBrowserDownloadReceipt({schema:'meri-browser-receipt/1',
   kind:'browser.download',binding,urlHost:'files.example',atMs:NOW,
   reference:'00000000-0000-4000-8000-0000000000ff',sha256:'0'.repeat(64),bytes:4,
   mimeType:'text/plain; charset=utf-8'}),/HOST_CONTROL_UNAVAILABLE/u);
  assert.equal(f.receipts.length,0);
 }finally{f.client.close();clock.now=NOW;}
});

test('two synchronous retries of one unknown filename leave only one in-flight operation',{timeout:20000},async t=>{
 const f=await joinedFixture(t);
 try{
  await writeFile(join(f.dir,'filing.txt'),fileBytes);
  const first=f.port.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'});
  const second=f.port.accept({filename:'filing.txt',url:'https://files.example/f/filing.txt'});
  await assert.rejects(()=>second,/BROWSER_DOWNLOAD_DUPLICATE/u);
  await first;
  assert.equal(f.sql.state.versions.size,1);
  assert.equal(f.receipts.length,1);
 }finally{f.client.close();clock.now=NOW;}
});

test('two workers at maxFiles 1 create ONE publication; the same delivery replays at capacity',{timeout:20000},async t=>{
 const f=await joinedFixture(t,{reservations:true,maxFiles:1});
 try{
  await writeFile(join(f.dir,'a.txt'),Buffer.from('first body\n'));
  await writeFile(join(f.dir,'b.txt'),Buffer.from('second body\n'));
  const a=await f.port.accept({filename:'a.txt',url:'https://files.example/a.txt'});
  await assert.rejects(()=>f.recreate().accept({filename:'b.txt',url:'https://files.example/b.txt'}),
   error=>/UNAVAILABLE|LIMIT/u.test(error.code||error.message));
  assert.equal(f.sql.state.versions.size,1);
  const again=await f.recreate().accept({filename:'a.txt',url:'https://files.example/a.txt'});
  assert.equal(again.versionId,a.versionId);
  assert.equal(f.sql.state.versions.size,1);
  assert.equal(f.receipts.length,1,'no second receipt');
 }finally{f.client.close();clock.now=NOW;}
});
test('changed bytes under the same original run+filename are refused as a conflict',{timeout:20000},async t=>{
 const f=await joinedFixture(t,{reservations:true,maxFiles:2});
 try{
  await writeFile(join(f.dir,'a.txt'),Buffer.from('original body\n'));
  await f.port.accept({filename:'a.txt',url:'https://files.example/a.txt'});
  await writeFile(join(f.dir,'a.txt'),Buffer.from('changed body\n'));
  await assert.rejects(()=>f.recreate().accept({filename:'a.txt',url:'https://files.example/a.txt'}),
   error=>/CONFLICT|UNAVAILABLE|UNKNOWN/u.test(error.code||error.message));
  assert.equal(f.sql.state.versions.size,1);
 }finally{f.client.close();clock.now=NOW;}
});

test('a lost INGEST acknowledgement leaves one committed version and recovers read-only on retry',{timeout:20000},async t=>{
 const f=await joinedFixture(t,{reservations:true,maxFiles:2,dropFirstIngestResponse:true});
 try{
  await writeFile(join(f.dir,'a.txt'),Buffer.from('ingest ack loss\n'));
  await assert.rejects(()=>f.port.accept({filename:'a.txt',url:'https://files.example/a.txt'}),
   error=>/INGEST|UNAVAILABLE|UNKNOWN/u.test(error.code||error.message));
  assert.equal(f.sql.state.versions.size,1,'publication committed exactly once');
  assert.equal(f.receipts.length,0,'no receipt acknowledged yet');
  const done=await f.recreate().accept({filename:'a.txt',url:'https://files.example/a.txt'});
  assert.equal(typeof done.versionId,'string');
  assert.equal(f.sql.state.versions.size,1,'no second publication');
  assert.equal(f.durable.state.index.decisions.length,1,'no second decision');
  assert.equal(f.receipts.length,1,'exactly one durable receipt');
  assert.equal((await readdir(f.dir)).includes('a.txt'),false);
 }finally{f.client.close();clock.now=NOW;}
});

test('receipt ACK loss + recreated worker with the file still present keeps the ORIGINAL receipt facts',{timeout:20000},async t=>{
 const f=await joinedFixture(t,{dropFirstReceiptResponse:true});
 try{
  await writeFile(join(f.dir,'a.txt'),Buffer.from('receipt ack loss with file\n'));
  await assert.rejects(()=>f.port.accept({filename:'a.txt',url:'https://files.example/a.txt'}),
   error=>error.code==='BROWSER_DOWNLOAD_RECEIPT_UNKNOWN');
  assert.equal(f.sql.state.versions.size,1);
  assert.equal(f.receipts.length,0,'the receipt committed but its reply was dropped');
  assert.equal((await readdir(f.dir)).includes('a.txt'),true);
  clock.now=NOW+10;
  const done=await f.recreate().accept({filename:'a.txt',url:'https://files.example/a.txt'});
  assert.equal(done.versionId,f.sql.state.versions.keys().next().value);
  assert.equal(f.sql.state.versions.size,1,'one version');
  assert.equal(f.durable.state.index.decisions.length,1,'one publication');
  assert.equal(f.receipts.length,1,'the committed receipt acknowledgement was recovered');
  assert.equal(f.receipts[0].event.data.atMs,NOW,'the ORIGINAL immutable receipt timestamp');
  assert.equal(f.receipts[0].event.createdAt,new Date(NOW).toISOString());
 }finally{f.client.close();clock.now=NOW;}
});

test('lost INGEST ack + clock advance: the receipt uses the committed acquisition, not the retry clock',{timeout:20000},async t=>{
 const f=await joinedFixture(t,{reservations:true,maxFiles:1,dropFirstIngestResponse:true});
 try{
  await writeFile(join(f.dir,'a.txt'),Buffer.from('ingest ack timestamp\n'));
  await assert.rejects(()=>f.port.accept({filename:'a.txt',url:'https://files.example/a.txt'}),
   error=>/INGEST|UNAVAILABLE|UNKNOWN/u.test(error.code||error.message));
  const row=[...f.sql.state.versions.values()][0];
  const acquired=row.record.spec.source.acquiredAtMs;
  assert.equal(Number.isSafeInteger(acquired),true);
  assert.equal(f.receipts.length,0);
  clock.now=NOW+10;
  const done=await f.recreate().accept({filename:'a.txt',url:'https://files.example/a.txt'});
  assert.equal(done.versionId,row.record.version.versionId);
  assert.equal(f.sql.state.versions.size,1);
  assert.equal(f.durable.state.index.decisions.length,1);
  assert.equal(f.receipts.length,1);
  assert.equal(f.receipts[0].event.data.atMs,acquired,'the committed acquisition is authoritative');
 }finally{f.client.close();clock.now=NOW;}
});

test('a definite admission refusal releases its new capacity claim without publishing',{timeout:20000},async t=>{
 let refused=false;
 const f=await joinedFixture(t,{reservations:true,maxFiles:1,onRecheck(value){
  if(!refused&&value.intent==='browser-import'&&value.phase==='admission'){refused=true;throw Error('synthetic admission refusal');}
 }});
 try{
  await writeFile(join(f.dir,'a.txt'),fileBytes);await writeFile(join(f.dir,'b.txt'),fileBytes);
  await assert.rejects(f.port.accept({filename:'a.txt',url:'https://files.example/a.txt'}),/UNAVAILABLE/u);
  assert.equal(f.sql.state.versions.size,0);assert.equal(f.receipts.length,0);
  const ack=await f.recreate().accept({filename:'b.txt',url:'https://files.example/b.txt'});
  assert.equal(typeof ack.versionId,'string');assert.equal(f.sql.state.versions.size,1);assert.equal(f.receipts.length,1);
 }finally{f.client.close();clock.now=NOW;}
});

test('postcommit release refusal retains capacity and recovers the original publication without another effect',{timeout:20000},async t=>{
 let refused=false;
 const f=await joinedFixture(t,{reservations:true,maxFiles:1,onRecheck(value){
  if(!refused&&value.intent==='browser-import'&&value.phase==='release'){refused=true;throw Error('synthetic postcommit authority refusal');}
 }});
 try{
  await writeFile(join(f.dir,'a.txt'),fileBytes);await writeFile(join(f.dir,'b.txt'),fileBytes);
  await assert.rejects(f.port.accept({filename:'a.txt',url:'https://files.example/a.txt'}),/UNAVAILABLE/u);
  assert.equal(f.sql.state.versions.size,1);assert.equal(f.receipts.length,0);
  const original=f.sql.state.versions.keys().next().value;
  await assert.rejects(f.recreate().accept({filename:'b.txt',url:'https://files.example/b.txt'}),/UNAVAILABLE|LIMIT/u);
  assert.equal(f.sql.state.versions.size,1,'unknown publication still consumes the only slot');
  const recovered=await f.recreate().accept({filename:'a.txt',url:'https://files.example/a.txt'});
  assert.equal(recovered.versionId,original);assert.equal(f.sql.state.versions.size,1);
  assert.equal(f.durable.state.index.decisions.length,1);assert.equal(f.receipts.length,1);
 }finally{f.client.close();clock.now=NOW;}
});

test('an ingest dependency refusal before a claim preserves the closed error without entering a transaction',async()=>{
 const {createPostgresHostCurrentnessStore}=await import('./postgres-store.mjs');let transactions=0;
 const store=createPostgresHostCurrentnessStore({transact:async()=>{transactions++;throw Error('unexpected transaction');},
  readCanonicalRun:async()=>{},maxLeaseMs:5000});
 await assert.rejects(store.ingestBrowserArtifact(),error=>error.code==='HOST_CONTROL_UNAVAILABLE'&&
  error.cause?.code==='HOST_CONTROL_UNAVAILABLE');
 assert.equal(transactions,0);
});

test('uppercase and long original filenames recover after lost ingestion acknowledgement without normalizing identity',{timeout:20000},async t=>{
 for(const filename of ['Report.TXT','x'.repeat(130)+'.txt']){
  const f=await joinedFixture(t,{reservations:true,maxFiles:1,dropFirstIngestResponse:true});
  try{
   await writeFile(join(f.dir,filename),fileBytes);
   await assert.rejects(f.port.accept({filename,url:'https://files.example/input'}),/INGEST|UNAVAILABLE|UNKNOWN/u);
   const record=[...f.sql.state.versions.values()][0].record;
   assert.equal(record.spec.originalFilename,filename);assert.notEqual(record.version.filename,filename);
   const ack=await f.recreate().accept({filename,url:'https://files.example/input'});
   assert.equal(ack.versionId,record.version.versionId);assert.equal(f.sql.state.versions.size,1);
   assert.equal(f.durable.state.index.decisions.length,1);assert.equal(f.receipts.length,1);
   const afterUnlink=await f.recreate().accept({filename,url:'https://files.example/input'});
   assert.equal(afterUnlink.versionId,ack.versionId);assert.equal(f.receipts.length,1);
  }finally{f.client.close();clock.now=NOW;}
 }
});

test('distinct original names with the same display filename retain separate exact recovery identities',{timeout:20000},async t=>{
 const f=await joinedFixture(t,{reservations:true,maxFiles:2}),names=['x'.repeat(120)+'A.txt','x'.repeat(120)+'B.txt'];
 try{
  const original=[];
  for(const filename of names){await writeFile(join(f.dir,filename),fileBytes);
   original.push(await f.recreate().accept({filename,url:'https://files.example/input'}));}
  const records=[...f.sql.state.versions.values()].map(v=>v.record);
  assert.equal(records.length,2);assert.equal(records[0].version.filename,records[1].version.filename);
  assert.notEqual(original[0].versionId,original[1].versionId);
  for(const [i,filename] of names.entries()){
   const recovered=await f.recreate().accept({filename,url:'https://files.example/input'});
   assert.equal(recovered.versionId,original[i].versionId);
  }
  assert.equal(f.sql.state.versions.size,2);assert.equal(f.receipts.length,2);
 }finally{f.client.close();clock.now=NOW;}
});
