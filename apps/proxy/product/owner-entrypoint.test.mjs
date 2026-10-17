import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {NOW} from '../../gateway/budget/product-scripted-fixture.mjs';
import {productControlFixture} from './test/control-fixture.mjs';
import {compileNativeTaskRequest} from '../../runtime/native-authority/task-request.mjs';
import {compilePreparedRunConfigurationSha256} from '../../runtime/prepared-run-configuration.mjs';
import {createProductOwnerAdmissionChannel} from './owner-channel.mjs';
import {validateProductOwnerConfiguration,startProductOwner,runProductOwnerMain} from './owner-entrypoint.mjs';
import {servicePairFixture} from './test/service-pair-fixture.mjs';
import {PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS} from '../../gateway/model-proxy/product-envelope.mjs';

const sha=v=>createHash('sha256').update(v).digest('hex'),id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const refused={message:'PRODUCT_OWNER_STARTUP_UNAVAILABLE'},prefix='arn:aws:ecs:us-east-1:967807252336:';

/** Real internal owners, scripted canonical PostgreSQL rows and constructor
 * seams only. No key generation, listener, PostgreSQL, AWS or provider call. */
function fixture(){
 const {configuration,seed,model,binding,clientId,qualification:q}=productControlFixture(),c=configuration.nativeCandidate;
 const task={...structuredClone(model),grantId:id(44),capabilitySha256:'c'.repeat(64)},request={requestId:id(45),prompt:'synthetic accepted prompt',skill:null,window:null},expiresAtMs=NOW+8000,key=hash(binding),createdAt=new Date(NOW).toISOString();
 const run={binding,state:'running',scopes:[{kind:'client',tenantId:binding.tenantId,resourceId:clientId,policyRevision:q.policyRevision}],policyRevision:q.policyRevision,versions:configuration.versions,createdAt};
 const original={binding,executionKey:key,executionId:key,planSha256:'d'.repeat(64),expiresAtMs,versions:configuration.versions};
 const resource={taskArn:q.workerArn,createdAtMs:NOW,clusterArn:c.taskRequest.cluster,taskDefinitionArn:c.taskRequest.taskDefinition,containerName:'worker',grantFactsJsons:[model,task].map(JSON.stringify)};
 const record={binding,allocationKey:key,original,allocationSha256:model.allocationSha256,qualification:{attempt:q.attempt,policyRevision:q.policyRevision},grantIntents:[model,task].map(g=>({grantId:g.grantId,capabilitySha256:g.capabilitySha256,expiresAtMs})),taskRequestSha256:compileNativeTaskRequest({original,taskRequest:c.taskRequest,containerName:'worker'}).taskRequestSha256,expiresAtMs,state:'ADMITTED',resource};
 const admission={schemaVersion:1,state:'ADMITTED',binding,selectedClientId:clientId,policyRevision:q.policyRevision,versions:configuration.versions,configurationSha256:compilePreparedRunConfigurationSha256(configuration),expiresAtMs,createdAtMs:NOW-1000};
 const state={
  budget:{id:1,cap_micro_usd:'10000',consumed_micro_usd:'0',quarantined:false},budgetRun:{run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision},
  grants:[model,task].map(g=>({grant_id:g.grantId,run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision,capability_sha256:g.capabilitySha256,state:'ACTIVE',expires_at:new Date(expiresAtMs)})),
  facts:[model,task].map(g=>({grant_id:g.grantId,run_id:binding.runId,facts:g})),allocation:{run_id:binding.runId,allocation:seed.allocation,allocation_sha256:model.allocationSha256,max_tool_calls:String(seed.allocation.budgets.maxToolCalls),max_cost_micro_usd:String(seed.allocation.budgets.maxCostMicroUSD),started_at:new Date(NOW)},
  issuance:{issuance_key:key,binding,request_sha256:hash(request),expires_at_ms:String(expiresAtMs),state:'ISSUED',claim_fence:id(46),version:'1',grant_id:model.grantId,capability_sha256:model.capabilitySha256,material_ref:'model-material:v1:'+key,facts_sha256:null,claimed_at:new Date(NOW),issued_at:new Date(NOW)},
  run:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,request_id:request.requestId,request,request_sha256:hash(request),projection:run,projection_sha256:hash(run),last_sequence:1,sequence_base:0,sequence_end:null},
  native:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,intent_key:key,record,record_sha256:hash(record)},
  initial:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,record:admission,record_sha256:hash(admission)},
  event:{sequence:1,event_id:id(47),event:{contractVersion:'0.1.0',eventId:id(47),binding,sequence:1,createdAt,scopes:run.scopes,type:'run.status',data:{state:'running',reasonCode:null}}},
 };
 state.event.event_sha256=hash(state.event.event);
 const calls=[],lifecycle=[],reads=[],materialBuffers=[],fetches=[],awsCalls=[];let captured,serverFailure=null,listenFailure=null;
 async function query(sql,p=[]){
  calls.push({sql,p});const rows=v=>({rows:structuredClone(v),rowCount:v.length});
  if(sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory')||sql==='COMMIT'||sql==='ROLLBACK')return rows([]);
  assert.equal(/(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\s/iu.test(sql.replace(/FOR UPDATE/gu,'')),false);
  assert.equal(sql.includes('meri_qualification.'),false);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(NOW)}]);
  for(const [prefix,values,match]of [
   ['SELECT * FROM meri_product_budget.grants WHERE capability_sha256=',state.grants,g=>g.capability_sha256===p[0]],
   ['SELECT * FROM meri_product_budget.grants WHERE grant_id=',state.grants,g=>g.grant_id===p[0]],
   ['SELECT * FROM meri_product_budget.grants WHERE run_id=',state.grants,g=>g.run_id===p[0]],
   ['SELECT * FROM meri_product_budget.tool_grant_bindings WHERE grant_id=',state.facts,g=>g.grant_id===p[0]],
   ['SELECT * FROM meri_product_budget.tool_grant_bindings WHERE run_id=',state.facts,g=>g.run_id===p[0]],
  ])if(sql.startsWith(prefix))return rows(values.filter(match).sort((a,b)=>a.grant_id.localeCompare(b.grant_id)));
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_run_allocations WHERE'))return rows([state.allocation]);
  if(sql==='SELECT * FROM meri_product_budget.budget WHERE id=1')return rows([state.budget]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.runs WHERE'))return rows([state.budgetRun]);
  if(sql.includes('FROM meri_conversations.model_run_issuances WHERE'))return rows([state.issuance]);
  if(sql.startsWith('SELECT * FROM meri_conversations.runs WHERE'))return rows([state.run]);
  if(sql.startsWith('SELECT * FROM meri_conversations.native_allocations WHERE'))return rows([state.native]);
  if(sql.startsWith('SELECT * FROM meri_conversations.events WHERE'))return rows([state.event]);
  if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings WHERE'))return rows(state.initial?[state.initial]:[]);
  if(sql.startsWith('SELECT * FROM meri_conversations.next_runs WHERE'))return rows([]);
  assert.fail('Unexpected owner startup scripted SQL: '+sql);
 }
 const pool={async connect(){return {query,release(){}};},async end(){lifecycle.push('pool.end');}};
 const pair=servicePairFixture({now:NOW});
 const nativeBytes=Buffer.from('synthetic-existing-native-session\n'),controlBytes=Buffer.from(JSON.stringify(configuration));
 const runtime={schemaVersion:1,sourceEnabled:false,enabled:true,controlConfigurationFile:resolve('synthetic-control.json'),controlConfigurationSha256:sha(controlBytes),nativeCredentialFileSha256:sha(nativeBytes),
  tls:{origin:'https://owner.synthetic.invalid:8444',serverName:'owner.synthetic.invalid',caFile:resolve('synthetic-root.pem'),certFile:resolve('synthetic-owner.pem'),keyFile:resolve('synthetic-owner-key.pem'),certSha256:'a'.repeat(64),issuerSha256:'b'.repeat(64)},
  clientPolicy:{clientCertSha256:'c'.repeat(64),clientSubject:'proxy-task-v1',deploymentRevision:'preview-v1',issuerSha256:'b'.repeat(64),selectedClientId:clientId},
  serviceTasks:{...pair.pins,deploymentRevision:'preview-v1',proxyCertSha256:'c'.repeat(64)},
  pricing:{modelId:'anthropic.claude-sonnet-4-6',profileId:'us.anthropic.claude-sonnet-4-6',revision:'d'.repeat(64),validUntilMs:NOW+60000,actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256},
  limits:{maxRequestMs:1000,maxFactBytes:131072,maxLeaseMs:30000}};
 const material=new Map([[runtime.controlConfigurationFile,controlBytes],[configuration.database.connectionFile,Buffer.from('postgres://synthetic:synthetic@database.synthetic.invalid/meri?sslmode=verify-full')],
  [c.identity.credentialFile,nativeBytes],[runtime.tls.caFile,Buffer.from('synthetic-root')],[runtime.tls.certFile,Buffer.from('synthetic-leaf')],[runtime.tls.keyFile,Buffer.from('synthetic-key')]]);
 const dependencies={now:()=>NOW,async readMaterial(path){reads.push(path);assert.ok(material.has(path),'known constructor material only');const bytes=Buffer.from(material.get(path));materialBuffers.push(bytes);return bytes;},
  createPool(options){lifecycle.push('pool.create');assert.equal(options.max,10);assert.equal(options.connectionTimeoutMillis,runtime.limits.maxRequestMs);return pool;},
  createAwsClients(options){lifecycle.push('clients.create');assert.deepEqual(options.ecs,{region:'us-east-1',maxAttempts:1,ignoreConfiguredEndpointUrls:true,useFipsEndpoint:false,useDualstackEndpoint:false,endpoint:'https://ecs.us-east-1.amazonaws.com'});assert.equal(options.ec2.endpoint,'https://ec2.us-east-1.amazonaws.com');
   return Object.fromEntries(['ecs','ec2'].map(service=>[service+'Client',{async send(command,options){awsCalls.push({service,command});return pair.configuration[service+'Client'].send(command,options);},destroy(){lifecycle.push(service+'.destroy');}}]));},
  createServer(value){captured=value;lifecycle.push('server.create');if(serverFailure)throw serverFailure;return {available:true,async listen(address){lifecycle.push(['listen',address]);if(listenFailure)throw listenFailure;},async close(){lifecycle.push('server.close');return {listenerStopped:true,pendingRequests:0,physicalStopProven:false};}};},
  async fetchImpl(url,init){fetches.push({url,init});const body=JSON.parse(init.body),principal={tenantId:binding.tenantId,actorId:binding.actorId},identity={principal,identityRevision:'native-v1',checkedAtMs:NOW,expiresAtMs:NOW+5000};
   return Response.json(url.endsWith('/identity')?identity:{identitySha256:body.identitySha256,principal,identityRevision:identity.identityRevision,conversationId:body.conversationId,selectedClientId:body.clientId,contextRevision:'core-context-v1',checkedAtMs:NOW,expiresAtMs:NOW+5000});}};
 return {runtime,configuration,binding,clientId,model,state,pool,dependencies,material,materialBuffers,reads,calls,lifecycle,fetches,awsCalls,pair,captured:()=>captured,
  failServer:()=>{serverFailure=Error('synthetic-private-failure-detail');},failListen:()=>{listenFailure=Error('synthetic-private-listener-detail');}};
}

test('omitted enablement is inert before material, clients, pool or server constructors',async()=>{
 const f=fixture();delete f.runtime.enabled;const runtime=await startProductOwner(f.runtime,new Proxy({},{get(){assert.fail('disabled must not inspect dependencies');}}));
 assert.equal(runtime.available,false);await assert.rejects(runtime.start(),refused);await runtime.close();assert.deepEqual(f.reads,[]);assert.deepEqual(f.lifecycle,[]);
});

test('runtime schema is closed and joins reviewed server/client/service/pricing identities before IO',async()=>{
 for(const change of [
  c=>{c.sourceEnabled=true;},c=>{c.enabled='true';},c=>{c.module='other';},c=>{c.controlConfigurationFile='relative';},
  c=>{c.controlConfigurationSha256='bad';},c=>{c.tls.origin+='?redirect=1';},c=>{c.tls.keyFile='relative';},
  c=>{c.clientPolicy.selectedClientId='other';},c=>{c.serviceTasks.proxy.taskArn='prelaunch-task';},
  c=>{c.clientPolicy.ownerTaskArn='prelaunch-task';},c=>{c.serviceTasks.schemaVersion=1;},
  c=>{c.serviceTasks.ownerCertSha256='f'.repeat(64);},c=>{c.serviceTasks.proxy.vpcId='vpc-ffffffff';},
  c=>{c.pricing.maxOutputTokens=PRODUCT_MAX_OUTPUT_TOKENS+1;},c=>{c.pricing.maxInputTokens=PRODUCT_MAX_INPUT_TOKENS+1;},c=>{c.limits.maxLeaseMs=30001;},c=>{c.serviceTasks.proxy.endpoint='https://foreign.invalid';},
 ]){const f=fixture();change(f.runtime);await assert.rejects(startProductOwner(f.runtime,f.dependencies),refused);assert.deepEqual(f.reads,[]);assert.deepEqual(f.lifecycle,[]);}
 const f=fixture(),v=validateProductOwnerConfiguration(f.runtime);assert.ok(Object.isFrozen(v.tls));assert.ok(Object.isFrozen(v.serviceTasks.proxy.securityGroupIds));
});

test('whole original control raw bytes are pinned before parsing, including independently committed VPC',async()=>{
 const f=fixture();f.material.set(f.runtime.controlConfigurationFile,Buffer.from('{not-json private synthetic value'));
 await assert.rejects(startProductOwner(f.runtime,f.dependencies),refused);assert.deepEqual(f.reads,[f.runtime.controlConfigurationFile]);assert.deepEqual(f.lifecycle,[]);assert.ok(f.materialBuffers.every(b=>b.every(n=>n===0)));
 const g=fixture(),changed=structuredClone(g.configuration);changed.taskRouter.vpcId='vpc-ffffffff';
 assert.equal(compilePreparedRunConfigurationSha256(changed),compilePreparedRunConfigurationSha256(g.configuration));
 g.material.set(g.runtime.controlConfigurationFile,Buffer.from(JSON.stringify(changed)));await assert.rejects(startProductOwner(g.runtime,g.dependencies),refused);assert.deepEqual(g.lifecycle,[]);
});

test('verify-full-only DSN refuses duplicate and alternate parser controls before pool/client allocation',async()=>{
 for(const dsn of ['postgres://a:b@synthetic.invalid/db?sslmode=verify-full&sslmode=disable','postgres://a:b@synthetic.invalid/db?sslmode=verify-full&host=foreign.invalid','postgres://a:b@synthetic.invalid/db?sslmode=require','postgres://a:b@synthetic.invalid/db?sslmode=verify-full#fragment']){
  const f=fixture();f.material.set(f.configuration.database.connectionFile,Buffer.from(dsn));await assert.rejects(startProductOwner(f.runtime,f.dependencies),refused);assert.deepEqual(f.lifecycle,[]);assert.ok(f.materialBuffers.every(b=>b.every(n=>n===0)));
 }
});

test('actual assembly mounts genuine canonical owners against one pool and freshly joins native Core context',async()=>{
 const f=fixture(),runtime=await startProductOwner(f.runtime,f.dependencies),ports=f.captured();
 assert.equal(runtime.available,true);assert.equal(f.calls.length,0);assert.equal(f.fetches.length,0);assert.equal(f.awsCalls.length,10);assert.equal(ports.ownerPorts.pool,f.pool);
 assert.equal(ports.clientPolicy.ownerTaskArn,f.pair.id('owner'));assert.equal(ports.clientPolicy.proxyTaskArn,f.pair.id('proxy'));
 assert.equal('ownerTaskArn' in f.runtime.clientPolicy,false,'raw policy never contains observed task IDs');
 assert.equal(ports.serviceGate.available,true);assert.equal(ports.nativeCurrentness.available,true);assert.equal(ports.placement.available,true);assert.equal(ports.taskLeaseReader.available,true);
 assert.equal(f.reads.includes(f.configuration.nativeCandidate.identity.credentialFile),false,'native material is lazy, never loaded just for configuration hash');
 assert.ok(f.reads.every(path=>![f.configuration.nativeCandidate.controlCapabilityFile,f.configuration.nativeCandidate.taskCapabilityFile,f.configuration.nativeCandidate.proxyCredentialFile].includes(path)));
 assert.ok(f.materialBuffers.every(b=>b.every(n=>n===0)),'startup material is cleared after constructors');
 const query={capabilitySha256:f.model.capabilitySha256,deadlineMs:NOW+5000},facts=await ports.persistedFacts.resolve(query),placement=await ports.placement.resolve(query);
 assert.equal(facts.modelGrantId,f.model.grantId);assert.equal(placement.issuedTaskNetwork.vpc_id,f.configuration.taskRouter.vpcId);assert.equal(placement.issuedTaskNetwork.expires_at_ms,NOW+8000);
 const current=await ports.ownerPorts.checkCurrentConversation({binding:f.binding,deadlineMs:NOW+900});assert.equal(current.selectedClientId,f.clientId);assert.deepEqual(current.binding,f.binding);
 assert.equal(f.fetches.length,2);assert.ok(f.fetches.every(x=>x.init.headers.authorization==='Bearer synthetic-existing-native-session'&&x.init.cache==='no-store'));
 assert.ok(f.calls.some(x=>x.sql.includes('initial_run_bindings')));assert.ok(f.calls.some(x=>x.sql.includes('model_run_issuances')));
 const channel=createProductOwnerAdmissionChannel({clientPolicy:ports.clientPolicy,persistedFacts:ports.persistedFacts,ownerPorts:ports.ownerPorts,serviceGate:ports.serviceGate,now:ports.now,maxExchangeMs:1000});
 const peer={clientCertSha256:f.runtime.clientPolicy.clientCertSha256,clientSubject:f.runtime.clientPolicy.clientSubject,deploymentRevision:f.runtime.clientPolicy.deploymentRevision,issuerSha256:f.runtime.clientPolicy.issuerSha256,proxyTaskArn:ports.clientPolicy.proxyTaskArn,tlsVersion:'TLSv1.3',connectionId:'direct-operation'};
 const response=JSON.parse(await channel.read(Buffer.from(JSON.stringify(['meri.proxy.admission-read/1','admission_A',f.model.capabilitySha256,null,NOW+900])),peer));assert.equal(response[0],'meri.proxy.admission/1');
 await runtime.start();assert.deepEqual(f.lifecycle.at(-1),['listen',{host:'0.0.0.0',port:8444}]);await runtime.close();await runtime.close();assert.equal(runtime.available,false);assert.equal(ports.nativeCurrentness.available,false);assert.equal(ports.serviceGate.available,false);
 assert.deepEqual(f.lifecycle.slice(-4),['server.close','pool.end','ecs.destroy','ec2.destroy']);assert.ok(f.materialBuffers.every(b=>b.every(n=>n===0)));
});

test('mounted real currentness denies rotated native material and missing original journal without fallback',async()=>{
 const f=fixture(),runtime=await startProductOwner(f.runtime,f.dependencies),p=f.captured();f.material.set(f.configuration.nativeCandidate.identity.credentialFile,Buffer.from('other-native-session'));
 await assert.rejects(p.ownerPorts.checkCurrentConversation({binding:f.binding,deadlineMs:NOW+900}),/PRODUCT_OWNER_NATIVE_UNAVAILABLE/);assert.equal(f.fetches.length,0);
 f.state.initial=null;await assert.rejects(p.placement.resolve({capabilitySha256:f.model.capabilitySha256,deadlineMs:NOW+900}),/PRODUCT_PROXY_PLACEMENT_UNAVAILABLE/);await runtime.close();
});

test('partial startup and listener failure close every allocated resource with content-free errors',async()=>{
 const f=fixture();f.failServer();await assert.rejects(startProductOwner(f.runtime,f.dependencies),refused);assert.equal(f.captured().nativeCurrentness.available,false);assert.equal(f.captured().serviceGate.available,false);assert.deepEqual(f.lifecycle.slice(-3),['pool.end','ecs.destroy','ec2.destroy']);assert.ok(f.materialBuffers.every(b=>b.every(n=>n===0)));
 const g=fixture();g.failListen();const runtime=await startProductOwner(g.runtime,g.dependencies);await assert.rejects(runtime.start(),refused);assert.equal(runtime.available,false);assert.deepEqual(g.lifecycle.slice(-4),['server.close','pool.end','ecs.destroy','ec2.destroy']);
});

test('listening deadline retires assembly; cleanup failure attempts all owners and stays explicit',async()=>{
 const f=fixture();f.runtime.limits.maxRequestMs=300;const createServer=f.dependencies.createServer;
 f.dependencies.createServer=value=>({...createServer(value),listen:()=>new Promise(()=>{})});
 const runtime=await startProductOwner(f.runtime,f.dependencies);await assert.rejects(runtime.start(),refused);assert.equal(runtime.available,false);assert.equal(f.captured().serviceGate.available,false);
 assert.deepEqual(f.lifecycle.slice(-4),['server.close','pool.end','ecs.destroy','ec2.destroy']);
 const g=fixture(),originalServer=g.dependencies.createServer;g.dependencies.createServer=value=>({...originalServer(value),async close(){g.lifecycle.push('server.close');throw Error('synthetic secret exception detail');}});
 const broken=await startProductOwner(g.runtime,g.dependencies);await assert.rejects(broken.close(),{message:'PRODUCT_OWNER_CLEANUP_UNKNOWN'});assert.equal(broken.available,false);
 assert.deepEqual(g.lifecycle.slice(-4),['server.close','pool.end','ecs.destroy','ec2.destroy']);
});

test('fulfilled listener close with stopped=false or pending work stays cleanup unknown',async()=>{
 for(const receipt of [{listenerStopped:false,pendingRequests:0,physicalStopProven:false},{listenerStopped:true,pendingRequests:1,physicalStopProven:false},undefined]){
  const f=fixture(),createServer=f.dependencies.createServer;f.dependencies.createServer=value=>{
   const server=createServer(value);return {...server,async close(){await server.close();return receipt;}};
  };
  const runtime=await startProductOwner(f.runtime,f.dependencies);await assert.rejects(runtime.close(),{message:'PRODUCT_OWNER_CLEANUP_UNKNOWN'});
  assert.equal(runtime.available,false);assert.equal(f.captured().nativeCurrentness.available,false);assert.equal(f.captured().serviceGate.available,false);
  assert.deepEqual(f.lifecycle.slice(-4),['server.close','pool.end','ecs.destroy','ec2.destroy']);
 }
});

test('TLS key completing at the startup deadline or exceeding the material cap is always erased',async()=>{
 for(const mode of ['deadline','oversize']){
  const f=fixture(),readMaterial=f.dependencies.readMaterial;let at=NOW,key;
  f.dependencies.now=()=>at;
  if(mode==='oversize')f.material.set(f.runtime.tls.keyFile,Buffer.alloc(32769,107));
  f.dependencies.readMaterial=async path=>{
   const bytes=await readMaterial(path);
   if(path===f.runtime.tls.keyFile){key=bytes;assert.ok(key.some(n=>n!==0));if(mode==='deadline')at+=f.runtime.limits.maxRequestMs;}
   return bytes;
  };
  await assert.rejects(startProductOwner(f.runtime,f.dependencies),refused);
  assert.ok(Buffer.isBuffer(key),'key read completed');assert.ok(key.every(n=>n===0),'returned key bytes are owned before deadline/cap rejection');
  assert.ok(f.materialBuffers.every(bytes=>bytes.every(n=>n===0)));assert.equal(f.captured(),undefined,'no TLS server after rejected material');
  assert.deepEqual(f.lifecycle.slice(-3),['pool.end','ecs.destroy','ec2.destroy']);
 }
});

test('main requires explicit required flag, exact config hash and absolute path before material IO',async()=>{
 let reads=0;const dependencies={readMaterial:async()=>{reads++;throw Error('private');}},env={MERI_PRODUCT_OWNER_REQUIRED:'1',MERI_PRODUCT_OWNER_CONFIG_SHA256:'a'.repeat(64)};
 for(const [args,vars]of [[['--config','relative'],env],[['--config',resolve('synthetic-config.json')],{}],[['--config',resolve('synthetic-config.json')],{...env,MERI_PRODUCT_OWNER_REQUIRED:'0'}],[['--config',resolve('synthetic-config.json')],{...env,MERI_PRODUCT_OWNER_CONFIG_SHA256:'bad'}]])assert.equal(await runProductOwnerMain(args,vars,dependencies),3);
 assert.equal(reads,0);
 const f=fixture(),file=resolve('synthetic-runtime.json');f.material.set(file,Buffer.from(JSON.stringify(f.runtime)));
 assert.equal(await runProductOwnerMain(['--config',file],env,f.dependencies),3);assert.deepEqual(f.lifecycle,[]);assert.deepEqual(f.reads,[file]);assert.ok(f.materialBuffers.every(b=>b.every(n=>n===0)));
});

test('real main hashes runtime source, starts the actual assembly and closes on the owned stop signal',async()=>{
 const f=fixture(),path=resolve('synthetic-owner-runtime.json'),bytes=Buffer.from(JSON.stringify(f.runtime));f.material.set(path,bytes);
 const createServer=f.dependencies.createServer;f.dependencies.createServer=value=>{
  const server=createServer(value);return {...server,async listen(address){await server.listen(address);process.emit('SIGTERM');}};
 };
 assert.equal(await runProductOwnerMain(['--config',path],{MERI_PRODUCT_OWNER_REQUIRED:'1',MERI_PRODUCT_OWNER_CONFIG_SHA256:sha(bytes)},f.dependencies),0);
 assert.equal(f.lifecycle.filter(x=>x==='pool.create').length,1);assert.equal(f.lifecycle.filter(x=>Array.isArray(x)&&x[0]==='listen').length,1);
 assert.deepEqual(f.lifecycle.slice(-4),['server.close','pool.end','ecs.destroy','ec2.destroy']);assert.equal(f.captured().nativeCurrentness.available,false);assert.ok(f.materialBuffers.every(b=>b.every(n=>n===0)));
});
