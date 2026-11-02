/** Explicit existing local PostgreSQL qualification; Core and native effects
 * are scripted, canonical custody and routing use actual SQL transactions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {lifecycleFixture,id,allocateOriginal} from '../../apps/control/conversations/test/lifecycle-fixture.mjs';
import {createBrowserCustodyCurrentness} from '../../apps/control/browser-hosts/custody-currentness.mjs';
import {createBrowserHostCurrentness} from '../../apps/control/browser-hosts/currentness.mjs';
import {createPostgresHostCurrentnessStore} from '../../apps/worker/conversation/host/control/postgres-store.mjs';
import {HOST_CONTROL_REQUEST_SCHEMA} from '../../apps/worker/conversation/host/control/protocol.mjs';
import {validateBrowserPolicy} from '../../apps/worker/conversation/browser/policy.mjs';
import {createRunCapabilityPolicy} from '../../apps/runtime/product-ports/capability-policy.mjs';
import {transact} from '../../apps/control/product-persistence/transaction.mjs';
import {createPostgresHostAllocationWriter,createPostgresHostAllocationReader} from '../../apps/control/browser-hosts/postgres-allocations.mjs';
import {publicCertificates} from '../../apps/control/browser-hosts/test/certificates.mjs';
if(process.env.MERI_HOST_ALLOCATIONS_PG_ATTEST!=='isolated-local')throw Error('HOST_ALLOCATION_PG_ATTESTATION_REQUIRED');
const connection={host:'127.0.0.1',port:55487,database:'wave6_browser_custody_20261030',connectionTimeoutMillis:1500};

test('canonical custody routing uses actual PostgreSQL and fresh logical-run Core authority',async t=>{
 const admin=new pg.Pool({...connection,user:'office_fixture_admin',max:1});t.after(()=>admin.end());
 // This fixture already exists from allocation qualification. The runtime
 // composition needs both canonical conversation and readonly host privileges.
 await admin.query('GRANT meri_control_runtime TO wave6_host_reader_20261030');
 const pool=new pg.Pool({...connection,user:'wave6_host_reader_20261030',max:4});t.after(()=>pool.end());
 const writePool=new pg.Pool({...connection,user:'wave6_host_writer_20261030',max:1});t.after(()=>writePool.end());
 const role=(await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.deepEqual(role,{rolsuper:false,rolbypassrls:false});
 const binding={tenantId:'browser-route-'+randomUUID(),actorId:'actor-'+randomUUID(),conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:id(5),policyRevision:'policy1'}];
 const settings={defaultTimezone:'UTC',capabilityPolicy:{},model:{monthlyCapMicroUsd:10000000,maxTurns:20,maxBudgetMicroUsd:2000000}};
 await admin.query('INSERT INTO meri_settings.tenant_settings(tenant_id,revision,document,document_sha256,updated_at,updated_by,monthly_cap_micro_usd,sdk_max_turns,sdk_max_budget_micro_usd) VALUES($1,1,$2,$3,clock_timestamp(),$4,10000000,20,2000000)',[binding.tenantId,settings,hash(settings),binding.actorId]);
 const f=await lifecycleFixture({pool,binding,scopes,browserSessions:true});t.after(()=>f.close());f.input.requestId=randomUUID();await f.running();
 f.state.checkCurrentBinding=b=>f.store.nextRuns.current(b,()=>{});
 const hostId=randomUUID(),ownerInstanceId=randomUUID(),allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,hostId,imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:Date.now()+600000};
 const names={hostCertificate:`h-${hostId.replaceAll('-','')}-g1.host.meri.internal`,serverCertificate:`v-${hostId.replaceAll('-','')}.host.meri.internal`};
 const admitted=await createPostgresHostAllocationWriter({pool:writePool}).admit({record:{allocation,originalBinding:binding,hostIdentity:{schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef0',bootId:randomUUID(),conversationId:binding.conversationId,hostId},ownerInstanceId,endpoint:{address:'127.0.0.1',port:49152,serverName:names.serverCertificate},...publicCertificates(names)}});
 const browserPolicy=validateBrowserPolicy({enabled:true});let allowBash=true,disableBrowser=false,rotateAfterPolicy=false,credentialAfterPolicy=false;
 const controlId=randomUUID(),custody={schema:'meri-browser-custody/1',binding,controlId,ownerInstanceId,hostId,generation:1,leaseEpoch:1,policySha256:hash(browserPolicy),expiresAtMs:Date.now()+60000};
 let expected=binding,denied=false,foreign=false,stale=false,rotate=false,nativeReads=0,coreReads=0;
 const authorityPorts={
  nativeCredentials:{nativeCredentialFor({binding:b,selectedClientId}){assert.deepEqual(b,expected);assert.equal(selectedClientId,id(5));nativeReads++;return {credential:credentialAfterPolicy||rotate&&nativeReads%2===0?'changed':'fixture-credential',expiresAtMs:Date.now()+30000};}},
  core:{async readCurrent({credential,conversationId,clientId}){coreReads++;assert.equal(credential,'fixture-credential');assert.equal(conversationId,binding.conversationId);assert.equal(clientId,id(5));if(denied)throw Error('Core denied');
   return {principal:{tenantId:binding.tenantId,actorId:foreign?'foreign':binding.actorId},role:'standard_user',permissions:[],clientIds:[id(5)],identityRevision:'1'.repeat(64),membershipRevision:'2'.repeat(64),contextRevision:'3'.repeat(64),conversationId,selectedClientId:clientId,checkedAtMs:Date.now()-(stale?10000:0),expiresAtMs:Date.now()+15000};}},
 };
 const currentness=createBrowserCustodyCurrentness({journal:f.store.lifecycle.browserCustody,...authorityPorts});
 const capabilityPolicy=createRunCapabilityPolicy({platform:{maximum:{bash:true},defaults:{bash:true},roleCeilings:{standard_user:{bash:true}}},readTenantSettings:async()=>({capabilities:{bash:allowBash}})});
 const full=createBrowserHostCurrentness({store:f.store,...authorityPorts,capabilityPolicy,readBrowserPolicy:async({binding:b,actorRole})=>{
  assert.deepEqual(b,expected);assert.equal(actorRole,'standard_user');if(rotateAfterPolicy)credentialAfterPolicy=true;return disableBrowser?{enabled:false}:browserPolicy;
 }});
 const fullRead=b=>transact(pool,client=>full.readHost(client,{allocation,binding:b}));
 const hostStore=createPostgresHostCurrentnessStore({transact:body=>transact(pool,body),readCanonicalRun:full.readHost,maxLeaseMs:5000});
 const hostRead=(b,policySha256,purpose='sdk')=>hostStore.readCurrent({request:{schema:HOST_CONTROL_REQUEST_SCHEMA,allocation,binding:b,hostIdentity:admitted.hostIdentity,purpose,policySha256,nonce:hash(randomUUID())},fingerprintSha256:admitted.hostCertificate.fingerprintSha256,peerDnsName:admitted.hostCertificate.dnsName});
 const active=await fullRead(binding);assert.equal(active.sdkAdmitted,true);assert.equal(active.bashAdmitted,true);
 assert.equal(active.browserAdmitted,false,'no browserActivation record is configured, so the browser stays held');assert.ok(active.currentUntilMs>Date.now()+3000,'request timeout does not shorten durable authority');
 assert.deepEqual((await hostRead(binding,active.capabilityPolicySha256)).receipt.binding,binding);
 rotateAfterPolicy=true;await assert.rejects(fullRead(binding));rotateAfterPolicy=credentialAfterPolicy=false;
 allowBash=false;await assert.rejects(hostRead(binding,active.capabilityPolicySha256));assert.equal((await fullRead(binding)).bashAdmitted,false);allowBash=true;
 await f.store.executions.record({binding,executionId:hash(binding),phase:'unknown',native:null},()=>{});await assert.rejects(fullRead(binding));
 await f.store.executions.record({binding,executionId:hash(binding),phase:'started',native:null},()=>{});
 await f.control({controlId,intent:'takeover.begin'});await f.claim(controlId);await f.checkpoint(controlId,custody);
 assert.equal((await fullRead(binding)).sdkAdmitted,false);await assert.rejects(hostRead(binding,active.capabilityPolicySha256));
 disableBrowser=true;await assert.rejects(fullRead(binding));disableBrowser=false;
 const reader=createPostgresHostAllocationReader({pool,readCanonicalRun:currentness.readRoute});
 const held=await reader.resolve({binding,custody});assert.deepEqual(held.binding,binding);assert.equal(held.ownerInstanceId,ownerInstanceId);assert.ok(held.expiresAtMs<=Date.now()+15000);
 await assert.rejects(reader.resolve({binding,custody:{...custody,leaseEpoch:2}}));
 for(const mode of ['denied','foreign','stale','rotated']){
  denied=mode==='denied';foreign=mode==='foreign';stale=mode==='stale';rotate=mode==='rotated';nativeReads=0;
  await assert.rejects(reader.resolve({binding,custody}),undefined,mode+' authority must refuse');
 }
 denied=foreign=stale=rotate=false;
 const pause=await f.service.readTakeover({credential:f.credential});
 await f.service.returnTakeover({credential:f.credential,returned:{ownerInstanceId,leaseEpoch:2,snapshotSha256:'b'.repeat(64)}});
 const resumed=await f.control({controlId:randomUUID(),intent:'takeover.end',checkpointId:pause.checkpointId,checkpointSha256:pause.checkpointSha256});
 expected=resumed.targetBinding;
 await assert.rejects(fullRead(expected),'a successor with no execution record cannot gain SDK authority');
 await allocateOriginal(f.store,expected);
 const targetState=await fullRead(expected);assert.equal(targetState.sdkAdmitted,true);assert.deepEqual(targetState.binding,expected);
 assert.deepEqual((await hostRead(expected,targetState.capabilityPolicySha256)).receipt.binding,expected);
 await assert.rejects(hostRead(binding,active.capabilityPolicySha256),'retired original SDK stays denied');
 await assert.rejects(reader.resolve({binding,custody}));
 const successor=await reader.resolve({binding:expected});assert.deepEqual(successor.binding,expected);assert.equal(successor.ownerInstanceId,ownerInstanceId);assert.equal(successor.recordSha256,held.recordSha256);
 const client=await pool.connect();try{await client.query('BEGIN');const physical=await currentness.readHost(client,{allocation,binding});
  assert.deepEqual(physical.binding,binding);assert.deepEqual(physical.browserSuccessor.binding,expected);assert.equal(physical.sdkAdmitted,false);assert.equal(physical.bashAdmitted,false);await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 await f.store.append(expected,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}},()=>{});
 const before=coreReads;await assert.rejects(reader.resolve({binding:expected}));assert.equal(coreReads,before,'terminal successor refuses before Core or native access');
 await assert.rejects(fullRead(expected));
 await assert.rejects(pool.query("UPDATE meri_host_control.host_allocations SET state='revoked' WHERE host_id=$1",[hostId]),{code:'42501'});
 t.diagnostic('Actual PG custody/route and execution/currentness chain; active and successor SDK, policy change, unknown execution and retired/terminal refusal covered. Browser activation remains held. Core, policy input, SDK and native host effects are scripted; no live acceptance.');
});
