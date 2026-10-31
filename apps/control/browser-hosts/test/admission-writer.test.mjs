import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../../../../',import.meta.url).href;
const tls=await import(root+'apps/worker/conversation/host/control/tls.mjs');
mock.module(root+'apps/worker/conversation/host/control/tls.mjs',{exports:{...tls,
 checkedCertificate:(raw,{nowMs,notAfterMs})=>({fingerprintSha256:(raw==='synthetic-client'?'a':'b').repeat(64),notAfterMs})}});
const {canonicalSha256:hash}=await import(root+'packages/contracts/validate.mjs');
const {prepareHostAllocation}=await import(root+'apps/control/browser-hosts/allocation.mjs');
const {createPostgresHostAllocationWriter,HOST_ALLOCATION_SQL:S}=await import(root+'apps/control/browser-hosts/postgres-allocations.mjs');
globalThis.__allocations={HOST_ALLOCATION_SQL:S};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.now(),binding={tenantId:'synthetic',actorId:'reviewer',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
function source(mode='native-processing',host=7){
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,
  generation:1,hostId:id(host),...(mode===null?{}:{hostMode:mode}),imageDigest:'sha256:'+'c'.repeat(64),leaseDeadlineMs:now+60000};
 return {allocation,originalBinding:binding,hostIdentity:{schema:'meri-d005-host-identity/1',hostId:id(host),conversationId:binding.conversationId,
  instanceId:'i-0123456789abcdef0',bootId:id(8)},ownerInstanceId:id(9),endpoint:{address:'10.1.2.3',port:9443,serverName:'host.example'},
  hostCertificate:'synthetic-client',serverCertificate:'synthetic-server'};
}
function row(raw,state='active'){
 const r=prepareHostAllocation(raw,now),a=r.allocation;return {host_id:a.hostId,generation:a.generation,tenant_id:a.tenantId,
  conversation_id:a.conversationId,allocation_json:a,allocation_sha256:hash(a),original_binding_json:r.originalBinding,
  host_identity_json:r.hostIdentity,host_identity_sha256:hash(r.hostIdentity),owner_instance_id:r.ownerInstanceId,endpoint_json:r.endpoint,
  record_sha256:hash(r),client_cert_sha256:r.hostCertificate.fingerprintSha256,client_dns_name:r.hostCertificate.dnsName,
  client_cert_not_after_ms:r.hostCertificate.notAfterMs,server_cert_not_after_ms:r.serverCertificateNotAfterMs,
  credential_revision:1,lease_deadline_ms:a.leaseDeadlineMs,state,host_mode:a.hostMode??null};
}
function fixture(raw,existing=[],isolation='read committed'){
 const log=[],saved=row(raw);let inserted=0;
 const client={async query(sql,args){log.push(sql);
  if(sql==='SHOW transaction_isolation')return {rows:[{transaction_isolation:isolation}]};
  if(sql===S.admission){assert.deepEqual(args,[binding.tenantId,binding.conversationId]);return {rows:[]};}
  if(sql===S.purposeRows)return {rows:structuredClone(existing)};
  if(sql===S.insert){inserted++;assert.deepEqual(args[4],saved.allocation_json);assert.equal(args[11],saved.record_sha256);return {rows:[]};}
  if(sql===S.lock)return {rows:[saved]};
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL '))return {rows:[]};
  throw Error('UNEXPECTED_SQL '+sql);
 },release(){}};
 const writer=createPostgresHostAllocationWriter({pool:{connect:async()=>client},now:()=>now,
  readCurrentNativeAuthority:async(_client,{allocation,binding})=>({currentUntilMs:allocation.leaseDeadlineMs,allocation,binding})});
 return {admit:()=>writer.admit({record:raw}),log,inserted:()=>inserted,expected:prepareHostAllocation(raw,now)};
}
for(const [name,mode,existingMode] of [['empty','native-processing',undefined],['browser then native','native-processing','browser-only'],
 ['native then browser','browser-only','native-processing']])test('actual writer '+name,async()=>{
 const raw=source(mode),f=fixture(raw,existingMode===undefined?[]:[row(source(existingMode,10))]);
 if(mode==='native-processing'){
  // A native admission is same-row only; without a reservation it must refuse and never INSERT.
  await assert.rejects(()=>f.admit(),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});
  assert.equal(f.inserted(),0);
 }else{
  assert.deepEqual(await f.admit(),f.expected);assert.equal(f.inserted(),1);
  assert.ok(f.log.indexOf(S.admission)<f.log.indexOf(S.purposeRows));assert.ok(f.log.indexOf(S.purposeRows)<f.log.indexOf(S.insert));
 }
});
for(const [name,mode,other,state] of [['same purpose','native-processing','native-processing','active'],
 ['legacy existing','native-processing',null,'active'],['legacy requested',null,'native-processing','active'],
 ['revoked reservation','native-processing','native-processing','revoked'],['quarantined reservation','native-processing','native-processing','quarantined']])test('actual writer refuses '+name,async()=>{
 const f=fixture(source(mode),[row(source(other,10),state)]);await assert.rejects(f.admit(),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});assert.equal(f.inserted(),0);
});
test('actual writer exact one-row replay succeeds',async()=>{const raw=source(),f=fixture(raw,[row(raw)]);assert.deepEqual(await f.admit(),f.expected);});
test('POSITIVE: exact replay alongside another explicit purpose is idempotent',async()=>{
 const raw=source(),f=fixture(raw,[row(raw),row(source('browser-only',10))]);
 assert.deepEqual(await f.admit(),f.expected);assert.equal(f.inserted(),0,'exact native replay returns the existing row without INSERT');
});
for(const mutation of ['hash','state'])test('actual writer refuses changed replay '+mutation,async()=>{
 const raw=source(),saved=row(raw);if(mutation==='hash')saved.record_sha256='f'.repeat(64);else saved.state='revoked';
 const f=fixture(raw,[saved]);await assert.rejects(f.admit(),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});assert.equal(f.inserted(),0);
});
for(const iso of ['repeatable read','serializable'])test('actual writer refuses '+iso,async()=>{
 const f=fixture(source(),[],iso);await assert.rejects(f.admit(),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});assert.equal(f.inserted(),0);
});

test('TEARDOWN: the 0004 legacy/browser branch keeps the exact browserEgress+bashEgress closed conjuncts',()=>{
 const sql=readFileSync(fileURLToPath(new URL('../migrations/0004_native_processing.sql',import.meta.url)),'utf8');
 const legacy=sql.slice(sql.indexOf("(NOT allocation_json ? 'hostMode')"),sql.indexOf("OR (allocation_json->>'hostMode'='browser-only'"));
 assert.match(legacy,/'browserEgress'='closed'/u,'legacy teardown requires browserEgress closed');
 assert.match(legacy,/'bashEgress'='closed'/u,'legacy teardown requires bashEgress closed');
 assert.match(sql,/\)\) IS TRUE/u,'the outer constraint stays IS TRUE');
 // Mutating the conjunct out must break the assertion (guards a comment-only "fix").
 assert.throws(()=>{const broken=sql.replace("teardown_json->>'browserEgress'='closed' AND ","");
  assert.match(broken.slice(broken.indexOf("(NOT allocation_json ? 'hostMode')"),broken.indexOf("OR (allocation_json->>'hostMode'='browser-only'")),/'browserEgress'='closed'/u);});
});

test('TEARDOWN: the browser-only branch also requires browserEgress closed',()=>{
 const sql=readFileSync(fileURLToPath(new URL('../migrations/0004_native_processing.sql',import.meta.url)),'utf8');
 const branch=sql.slice(sql.indexOf("OR (allocation_json->>'hostMode'='browser-only'"),
  sql.indexOf("OR (allocation_json->>'hostMode'='native-processing'"));
 assert.match(branch,/'browserEgress'='closed'/u,'browser-only teardown requires browserEgress closed');
 assert.match(branch,/'processScope'='browser-host-descendants'/u);
 assert.match(branch,/'bashEgress'='not-applicable'/u);
 assert.throws(()=>{const broken=sql.replace(/OR \(allocation_json->>'hostMode'='browser-only'\)[\s\S]*?'browserEgress'='closed'/u,
  "OR (allocation_json->>'hostMode'='browser-only'");assert.match(t.slice(t.indexOf("browser-only'"),t.indexOf("'native-processing'")),/'browserEgress'='closed'/u);});
});

test('PURPOSE FILTER: both readers select through the definer lock with a SQL purpose filter',()=>{
 const {HOST_ALLOCATION_SQL}=globalThis.__allocations;
 const native=HOST_ALLOCATION_SQL.nativeConversation,browser=HOST_ALLOCATION_SQL.browserConversation;
 assert.match(native,/lock_conversation\(\$1,\$2\)/u);
 assert.match(native,/allocation_json->>'hostMode'='native-processing'/u);
 assert.equal(native.includes('FOR UPDATE'),false);
 assert.match(browser,/lock_conversation\(\$1,\$2\)/u);
 assert.match(browser,/IN \('legacy','browser-only'\)/u);
 assert.equal(browser.includes("'native-processing'"),false,'the browser read never selects a native row');
});
