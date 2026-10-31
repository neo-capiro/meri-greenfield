/** Actual worker adapter -> actual private Control gateway -> actual external host-authority producer.
 * Only the canonical local execution reader and Core/credential/retention fixtures are synthetic. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
const binding={tenantId:'tenant',actorId:'00000000-0000-4000-8000-000000000001',conversationId:'00000000-0000-4000-8000-000000000002',runId:'00000000-0000-4000-8000-000000000003',attemptId:'00000000-0000-4000-8000-000000000004',workerId:'00000000-0000-4000-8000-000000000005',writerFence:1};
const policy='a'.repeat(64),controlCredential='synthetic-control-credential-for-canonical-test';
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,hostId:'00000000-0000-4000-8000-000000000006',hostMode:'native-processing',imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:301000};
let clock=1000,localDeadline=601000;
const tx={async query(){return {rows:[]};},release(){}};
mock.module(new URL('../../control/conversations/execution-currentness.mjs',import.meta.url).href,{exports:{createExecutionCurrentnessReader(){return {async readCurrentOnClient(client){assert.equal(client,tx);return {binding,run:{state:'queued'},executionPhase:'launching',scopes:[{kind:'private-user',resourceId:binding.actorId}],deadlineMs:localDeadline};}};}}});
const {createNativeWorkerAuthority}=await import('../native-worker-authority.mjs');
const {createCanonicalHostAuthority}=await import('../../control/browser-hosts/native-currentness.mjs');
const {createAgentCoreControlApplication}=await import('../agentcore-control-http.mjs');
const good=()=>({binding,selectedClientId:null,policySha256:policy,currentUntilMs:6000});
const make=(remote,pool={async connect(){return tx;}})=>createNativeWorkerAuthority({pool,remote,now:()=>clock,policySha256:policy,maxFreshMs:30000});
function actual(producer){const unrelated=async()=>assert.fail('Unrelated operation');return createAgentCoreControlApplication({owner:{readiness:unrelated,kickoff:unrelated,status:unrelated,stop:unrelated,admitted:unrelated,settle:unrelated,
 hostAuthority:input=>producer.verify(undefined,input)},controlCredential,now:()=>clock});}
test('actual worker request traverses the actual gateway and external producer',async()=>{
 clock=1000;localDeadline=601000;
 const core={async readCurrent(){return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},role:'standard_user',
  permissions:['chat'],clientIds:[],identityRevision:'c'.repeat(64),membershipRevision:'d'.repeat(64),
  contextRevision:'e'.repeat(64),conversationId:binding.conversationId,selectedClientId:null,checkedAtMs:1000,expiresAtMs:6000};}};
 const producer=createCanonicalHostAuthority({core,nativeCredentials:{async nativeCredentialFor(){return {credential:'synthetic-user-credential',expiresAtMs:6000};}},
  retentionGate:{async assertServable(){}},now:()=>clock,policySha256:policy});
 const app=actual(producer);
 const worker=make(async({signal,...wire})=>{
  const response=await app.handle(new Request('https://synthetic.invalid/v1/execution/native/host-authority',{method:'POST',
   headers:{authorization:'Bearer '+controlCredential,'content-type':'application/json'},body:JSON.stringify(wire),signal}));
  assert.equal(response.status,200,await response.clone().text());return response.json();
 });
 const value=await worker.preflight({binding,deadlineMs:31000});
 assert.deepEqual(Object.keys(value).sort(),['binding','currentUntilMs','executionDeadlineMs','policySha256','selectedClientId']);
 assert.equal(value.currentUntilMs,6000);assert.equal(value.executionDeadlineMs,601000);
});
test('actual gateway refuses wrong authority and a request without the trusted policy pin',async()=>{
 clock=1000;localDeadline=601000;
 const producer=createCanonicalHostAuthority({core:{async readCurrent(){return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},
  role:'standard_user',permissions:['chat'],clientIds:[],identityRevision:'c'.repeat(64),membershipRevision:'d'.repeat(64),
  contextRevision:'e'.repeat(64),conversationId:binding.conversationId,selectedClientId:null,checkedAtMs:1000,expiresAtMs:6000};}},
  nativeCredentials:{async nativeCredentialFor(){return {credential:'synthetic-user-credential',expiresAtMs:6000};}},
  retentionGate:{async assertServable(){}},now:()=>clock,policySha256:policy});
 const app=actual(producer),url='https://synthetic.invalid/v1/execution/native/host-authority';
 const denied=await app.handle(new Request(url,{method:'POST',headers:{authorization:'Bearer wrong','content-type':'application/json'},
  body:JSON.stringify({binding,selectedClientId:null,expectedPolicySha256:policy,deadlineMs:31000})}));
 assert.equal(denied.status,403);
 let effects=0;
 const countedProducer=createCanonicalHostAuthority({core:{async readCurrent(){effects++;return {principal:{tenantId:binding.tenantId,
   actorId:binding.actorId},role:'standard_user',permissions:['chat'],clientIds:[],identityRevision:'c'.repeat(64),
   membershipRevision:'d'.repeat(64),contextRevision:'e'.repeat(64),conversationId:binding.conversationId,selectedClientId:null,
   checkedAtMs:1000,expiresAtMs:6000};}},
  nativeCredentials:{async nativeCredentialFor(){effects++;return {credential:'synthetic-user-credential',expiresAtMs:6000};}},
  retentionGate:{async assertServable(){effects++;}},now:()=>clock,policySha256:policy});
 const badDeadline=await actual(countedProducer).handle(new Request(url,{method:'POST',headers:{authorization:'Bearer '+controlCredential,
  'content-type':'application/json'},body:JSON.stringify({binding,selectedClientId:null,expectedPolicySha256:policy,deadlineMs:'31000'})}));
 assert.equal(badDeadline.status,400);assert.equal(effects,0,'malformed deadline is refused before Core/credential/retention effects');
 const malformed=await app.handle(new Request(url,{method:'POST',headers:{authorization:'Bearer '+controlCredential,'content-type':'application/json'},
  body:JSON.stringify({binding,selectedClientId:null,deadlineMs:31000})}));
 assert.equal(malformed.status,400);
});
test('writer callback returns exactly three fields and clamps to local execution and allocation',async()=>{
 clock=1000;localDeadline=2000;
 try{const value=await make(async()=>good()).verifyInTransaction(tx,{binding,allocation:{...allocation,leaseDeadlineMs:1500},deadlineMs:31000});
  assert.deepEqual(Object.keys(value).sort(),['allocation','binding','currentUntilMs']);assert.equal(value.currentUntilMs,1500);
 }finally{localDeadline=601000;}
});
test('cancelled preflight releases a connected client with an error and never waits for a noncooperative query',async()=>{
 clock=1000;localDeadline=601000;
 let released,rollback=0;
 const stuck={async query(sql){if(sql==='BEGIN'||sql==='ROLLBACK'){if(sql==='ROLLBACK')rollback++;return {rows:[]};}return new Promise(()=>{});},release(error){released=error;}};
 const worker=createNativeWorkerAuthority({pool:{async connect(){return stuck;}},remote:async()=>good(),now:()=>clock,policySha256:policy,maxFreshMs:30000});
 const controller=new AbortController();const started=Date.now();
 const pending=worker.preflight({binding,signal:controller.signal,deadlineMs:60000});
 setTimeout(()=>controller.abort(new Error('test-cancel')),10);
 await assert.rejects(()=>pending,error=>['NATIVE_WORKER_AUTHORITY_CANCELLED','NATIVE_WORKER_AUTHORITY_REFUSED','NATIVE_WORKER_AUTHORITY_DEADLINE'].includes(error?.code));
 assert.ok(Date.now()-started<100,'cancellation does not wait for the noncooperative local query');
 assert.ok(released instanceof Error,'tainted client is released with an error rather than returned to the pool as clean');
 assert.equal(rollback,1,'an opened transaction is rolled back before release');
});
