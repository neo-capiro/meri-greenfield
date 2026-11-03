import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,X509Certificate} from 'node:crypto';
import {createServer as httpServer,request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {once} from 'node:events';
import {operatorCaseFixture,operatorAllocationFixture,cleanupOperatorFixture} from '../../../apps/runtime/test/browser-operator-fixture.mjs';
import {binding} from '../../../apps/control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {tlsServer,localRequest} from '../../../apps/runtime/test/operator-callback.fixture.mjs';
import {createOperatorCallbackTransport} from '../../../apps/runtime/operator-callback-transport.mjs';
import {createNativeCapabilityClient} from '../../../apps/runtime/native-client.mjs';
import {createAgentCoreControlApplication} from '../../../apps/runtime/agentcore-control-http.mjs';
import {createControlRouteApplications} from '../../../apps/runtime/control-route-boundary.mjs';
import {createNativeObserverHttpApplication} from '../../../apps/runtime/native-observer-http.mjs';
import {createNativeObserverHandler} from '../../../apps/runtime/native-observer-entrypoint.mjs';
import {createOperatorObserverPost} from '../../../apps/runtime/native-observer-transport.mjs';
import {createHostCurrentnessServer} from '../../../apps/worker/conversation/host/control/server.mjs';
import {createHostCurrentnessClient} from '../../../apps/worker/conversation/host/control/client.mjs';
import {HOST_CONTROL_PATH,HOST_CONTROL_RESPONSE_SCHEMA,hostClientDnsName} from '../../../apps/worker/conversation/host/control/protocol.mjs';
import {createNativeHostCertificateIssuerFromMaterial} from '../../../apps/runtime/native-authority/native-host-certificate-issuer.mjs';
import {createRunnerPoststartCsr} from '../../../apps/runtime/native-authority/runner-poststart-csr.mjs';
import {renderOperatorCaseMaterial} from './render-material.mjs';
import {operatorCaseStage3Input,composeOperatorCaseStartup,compileOperatorCaseBindings} from './operator-case-bindings.mjs';
import {operatorCaseNames,createOperatorControlAdmission} from '../../../apps/runtime/operator-control-configuration.mjs';
import {startControl} from '../../../apps/runtime/control.mjs';
import {renderMaterial} from './render-material.mjs';
import {synthesizeOperatorAgentCoreRuntime} from '../agentcore-runtime.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),caseId='a123456789ab',n=operatorCaseNames(caseId),account='967807252336';
const arn=name=>`arn:aws:secretsmanager:us-east-1:${account}:secret:synthetic/${name}-Abc123`;
const tg=name=>`arn:aws:elasticloadbalancing:us-east-1:${account}:targetgroup/${name}/${'a'.repeat(16)}`;
const capability=Buffer.from('synthetic-case-control-capability-'.repeat(2)),productionHash=sha('synthetic-production-capability-'.repeat(2));
after(cleanupOperatorFixture);
async function fixture(selectedBinding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:'synthetic-conversation'}){
 const c=await operatorCaseFixture({binding:selectedBinding});
 const i={...c.inputs,deployment:structuredClone(c.inputs.deployment)},d=i.deployment;
 const production={temporal:{...d.temporal,address:d.origins.temporalAddress},secretArns:[...Object.values(d.secrets)],
  trafficSecurityGroupIds:[d.foundation.ControlSecurityGroupId,d.foundation.WorkerSecurityGroupId],targetGroupArns:[d.privateEdge.controlPrivateTargetGroupArn,tg('production-host')],runtimeArn:d.agentcore.runtimeArn,
  controlCaSha256:sha('synthetic-production-ca'),controlCapabilitySha256:productionHash};
 const edge={CaseControlSecurityGroupId:'sg-11111111111111111',CaseClientSecurityGroupId:'sg-22222222222222222',ControlPrivateTargetGroupArn:tg(`${n.prefix}-8082`),HostListenerTargetGroupArn:tg(`${n.prefix}-host`)};
 d.temporal.taskQueue=n.queue;d.agentcore={...d.agentcore,runtimeArn:`arn:aws:bedrock-agentcore:us-east-1:${account}:runtime/${n.runtime}-synthetic`,qualifier:'case'};
 d.features.browserActivation={state:'held'};
 Object.assign(d.foundation,{ControlTaskRoleArn:`arn:aws:iam::${account}:role/MeriCase-${caseId}-control`,WorkerTaskRoleArn:`arn:aws:iam::${account}:role/MeriCase-${caseId}-worker`});
 Object.assign(d.foundation,{ControlExecutionRoleArn:`arn:aws:iam::${account}:role/MeriCase-${caseId}-control-execution`,WorkerExecutionRoleArn:`arn:aws:iam::${account}:role/MeriCase-${caseId}-worker-execution`});
 d.secrets['control/material']=arn('case-control');d.secrets['worker/material']=arn('case-worker');
 i.stage3=operatorCaseStage3Input({caseId,deployment:d,edge,revisions:{control:1,'temporal-worker':1}});
 const rendered=renderOperatorCaseMaterial({...i,nowMs:Date.now(),validityDays:1/24},{caseId,controlCapability:capability,productionControlCapabilitySha256:productionHash,observerMaterial:c.material});
 const startup=composeOperatorCaseStartup({caseId,rendered,observerMaterial:c.material,selection:c.selection,expiresAtMs:c.expiresAtMs,productionControlCapabilitySha256:productionHash});
 return {caseId,deployment:d,rendered,startup,edge,production,versions:{control:'1'.repeat(32),'temporal-worker':'2'.repeat(32),'operator-control':'3'.repeat(32),'operator-worker':'4'.repeat(32)},
  operatorSecrets:{control:arn('case-control-startup'),'temporal-worker':arn('case-worker-callback')},network:{temporalFrontendSecurityGroupId:'sg-33333333333333333'},inputs:i,case:c};
}
test('real renderer reaches protected Control startup and isolated once-only task definitions',async()=>{
 const f=await fixture(),b=compileOperatorCaseBindings(f),r=Object.values(b.template.Resources);
 assert.equal(r.filter(x=>x.Type==='AWS::ECS::TaskDefinition').length,2);assert.equal(r.filter(x=>x.Type==='AWS::ECS::Service').length,0);
 for(const task of r.filter(x=>x.Type==='AWS::ECS::TaskDefinition').map(x=>x.Properties)){
  assert(task.Family.startsWith(n.prefix));const app=task.ContainerDefinitions.find(x=>x.Essential),init=task.ContainerDefinitions.find(x=>x.Name==='operator-material-init');
  assert.deepEqual(app.EntryPoint,['node','apps/runtime/operator-case-entrypoint.mjs']);
  assert.deepEqual(app.MountPoints.find(m=>m.ContainerPath==='/run/meri-operator'),{ContainerPath:'/run/meri-operator',SourceVolume:'operator-material',ReadOnly:true});
  assert.deepEqual(init.MountPoints,[{ContainerPath:'/run/meri-operator',SourceVolume:'operator-material',ReadOnly:false}]);
  assert.equal(app.Secrets,undefined);assert(!app.Environment.some(e=>e.Name==='MERI_OPERATOR_MATERIAL_BUNDLE'));
  assert.equal(init.Secrets.length,1);assert(!init.MountPoints.some(m=>m.ContainerPath==='/run/meri'));
 }
 assert.equal(f.rendered.roles.control.config.temporal.taskQueue,n.queue);assert.equal(f.rendered.roles['temporal-worker'].config.temporal.taskQueue,n.queue);
 assert.deepEqual(f.rendered.summary.wiring.control.entryPoint,['node','apps/runtime/operator-case-entrypoint.mjs']);
 assert.equal(b.execution.automaticReplacement,false);assert(!JSON.stringify(b.template).includes('meri-product-preview-control'));
 assert.equal(b.execution.receivers.callback.targetPort,8082);assert.equal(b.execution.receivers.hostCurrentness.targetPort,8443);
 assert.notEqual(b.execution.receivers.callback.endpoint.address,b.execution.receivers.hostCurrentness.endpoint.address);
});
test('refuses ordinary queue, credentials, targets, groups, runtime and secret references',async()=>{
 const f=await fixture();
 for(const mutate of [x=>x.production.temporal.taskQueue=n.queue,x=>x.production.controlCapabilitySha256=sha(capability),
  x=>x.production.targetGroupArns.push(x.edge.ControlPrivateTargetGroupArn),x=>x.production.trafficSecurityGroupIds.push(x.edge.CaseClientSecurityGroupId),
  x=>x.production.secretArns.push(x.operatorSecrets.control),x=>x.production.runtimeArn=x.rendered.roles.control.config.agentcore.runtimeArn,
  x=>x.startup.control.expected.sha256ByPath['/run/meri/control.json']='a'.repeat(64),x=>x.deployment.foundation.ControlTaskRoleArn=`arn:aws:iam::${account}:role/MeriPreview-control-task`,
  x=>x.deployment.foundation.DbClientSecurityGroupId=x.production.trafficSecurityGroupIds[0],x=>x.deployment.foundation.ControlExecutionRoleArn=`arn:aws:iam::${account}:role/MeriPreview-control-execution`]){
  const {case:unused,inputs,...plain}=f,x=structuredClone(plain);mutate(x);assert.throws(()=>compileOperatorCaseBindings(x));
 }
 assert.throws(()=>renderOperatorCaseMaterial(f.inputs,{caseId,controlCapability:capability,productionControlCapabilitySha256:sha(capability)}));
 assert.throws(()=>renderMaterial(f.inputs));assert.throws(()=>startControl(f.rendered.roles.control.config));
});
test('runtime Control join refuses a changed queue, credential, source or stale admission before startup',async()=>{
 const f=await fixture(),descriptor=JSON.parse(Buffer.from(f.startup.control.bundle.files[0].base64,'base64')),c=f.rendered.roles.control.config;
 assert.throws(()=>createOperatorControlAdmission(descriptor,c,Buffer.from('foreign-control-capability-'.repeat(2)),descriptor.sourceCommit));
 assert.throws(()=>createOperatorControlAdmission(descriptor,c,capability,'0'.repeat(40)));
 const wrong=structuredClone(c);wrong.temporal.taskQueue=f.production.temporal.taskQueue;
 assert.throws(()=>createOperatorControlAdmission(descriptor,wrong,capability,descriptor.sourceCommit));
 assert.throws(()=>createOperatorControlAdmission({...descriptor,expiresAtMs:1},c,capability,descriptor.sourceCommit));
});

test('case renderer and startup refuse mismatched observer secret, callback target and material pins',async()=>{
 const f=await fixture(),options={caseId,controlCapability:capability,productionControlCapabilitySha256:productionHash};
 const inputs={...f.inputs,nowMs:Date.now(),validityDays:1/24};
 for(const mutate of [m=>m.callback.endpoint.address=m.native.worker.browserDeployment.bootstrapSpec.control.endpoint.address,
  m=>m.configuration.secretSha256='0'.repeat(64),m=>m.configuration.caSha256='0'.repeat(64),m=>m.native.worker.browserDeployment.sourceCommit='0'.repeat(40)]){
  const observerMaterial={...f.case.material,configuration:structuredClone(f.case.material.configuration),callback:structuredClone(f.case.material.callback),
   native:{...f.case.material.native,worker:structuredClone(f.case.material.native.worker)}};mutate(observerMaterial);
  assert.throws(()=>renderOperatorCaseMaterial(inputs,{...options,observerMaterial}));
 }
 const wrongKey={...inputs,nativeMaterial:{...inputs.nativeMaterial,observerKey:Buffer.alloc(32,8)}};
 assert.throws(()=>renderOperatorCaseMaterial(wrongKey,{...options,observerMaterial:f.case.material}));
 for(const rendered of [{...f.rendered,nativeObserverMaterial:Buffer.from('{}')},
  {...f.rendered,summary:{...f.rendered.summary,nativeProcessing:{...f.rendered.summary.nativeProcessing,observerCaSha256:'0'.repeat(64)}}}]){
  assert.throws(()=>composeOperatorCaseStartup({caseId,rendered,observerMaterial:f.case.material,selection:f.case.selection,expiresAtMs:f.case.expiresAtMs,productionControlCapabilitySha256:productionHash}));
 }
});

test('rendered case reaches private HTTP callback/observer and separate host mTLS; destination swaps refuse',async t=>{
 const f=await fixture(binding),c=f.case,material=c.material,bootstrap=material.native.worker.browserDeployment.bootstrapSpec;
 const callback=JSON.parse(Buffer.from(f.startup.temporalWorker.bundle.files[0].base64,'base64'));
 assert.deepEqual(callback,JSON.parse(Buffer.from(f.startup.agentcore.bundle.files[0].base64,'base64')));
 assert.notEqual(callback.endpoint.address,bootstrap.control.endpoint.address);
 const secret=JSON.parse(f.rendered.nativeObserverMaterial),counts={ready:0,stop:0,observer:0,host:0,delegated:0};
 assert.equal(secret.caCertificate,callback.caCertificate);assert.notEqual(secret.caCertificate,bootstrap.control.caCertificate);
 const owner={readiness:async()=>{counts.ready++;return {service:'meri-native-capability-provider/1',ready:true};},
  stop:async input=>{counts.stop++;return {...input,stopped:true};},kickoff:async()=>assert.fail('no kickoff'),status:async()=>assert.fail('no status'),
  admitted:async()=>assert.fail('no execution'),settle:async()=>assert.fail('no settlement')};
 const candidate=createAgentCoreControlApplication({owner,controlCredential:capability.toString()});
 const nativeObserver=createNativeObserverHttpApplication({readKey:async keyId=>{assert.equal(keyId,secret.keyId);return Buffer.from(secret.keyBase64,'base64');},
  observeIntent:async()=>{counts.observer++;return {disposition:'pending'};}});
 const app=createControlRouteApplications({assembly:{handle:()=>assert.fail('no public fallback')},
  candidate:{handle:r=>{counts.delegated++;return candidate.handle(r);}},nativeObserver}).private;
 // Actual existing application behind plaintext HTTP, as the private TLS443 edge
 // forwards to HTTP8082. Only physical ports are ephemeral in this local test.
 const privateHttp=httpServer(async(req,res)=>{
  const chunks=[];for await(const part of req)chunks.push(part);
  const reply=await app.handle(new Request(callback.origin+req.url,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)}));
  const bytes=Buffer.from(await reply.arrayBuffer());res.writeHead(reply.status,{...Object.fromEntries(reply.headers),'content-length':String(bytes.length)}).end(bytes);
 });
 privateHttp.listen(0,'127.0.0.1');await once(privateHttp,'listening');
 t.after(()=>{privateHttp.closeAllConnections();return new Promise(resolve=>privateHttp.close(resolve));});
 const edge=await tlsServer(t,c.callbackTls,(req,res)=>{
  const downstream=httpRequest({hostname:'127.0.0.1',port:privateHttp.address().port,path:req.url,method:req.method,headers:req.headers},reply=>{
   res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);
  });downstream.on('error',()=>res.destroy());req.pipe(downstream);
 });
 const requests=[],transport=createOperatorCallbackTransport(callback,{request:localRequest(edge,requests,callback.endpoint.address)});
 t.after(()=>transport.close());
 const native=credential=>createNativeCapabilityClient({configuration:{origin:callback.origin,maxResponseBytes:1048576},credential,fetch:transport.fetch});
 await native(capability.toString()).readiness();assert.equal(counts.ready,1);
 await assert.rejects(native('synthetic-production-capability-'.repeat(2)).readiness());assert.equal(counts.ready,1);
 c.capability.revoke();
 assert.equal((await native(capability.toString()).call('execution/kickoff/stop',{binding,executionId:hash(binding)})).stopped,true);assert.equal(counts.stop,1);
 const allocation=await operatorAllocationFixture({binding,material,nowMs:Date.now()}),watchdog=allocation.row.declaration_json.watchdog;
 const event={schema:'meri-native-observer-invocation/1',mode:'prepare',originalInput:watchdog.input,executionArn:watchdog.executionArn};
 const config=material.configuration,context={functionName:config.functionArn.split(':').at(-1),functionVersion:'3',invokedFunctionArn:config.functionArn+':3',getRemainingTimeInMillis:()=>10000};
 const observe=(post,bytes=f.rendered.nativeObserverMaterial,configuration=config)=>createNativeObserverHandler({configuration,post,fetchSecret:async()=>({ARN:config.secretArn,VersionId:config.secretVersionId,SecretString:bytes.toString()})})(event,context);
 const observerPost=createOperatorObserverPost(config.endpoint,{request:localRequest(edge,requests,callback.endpoint.address)});
 assert.deepEqual(await observe(observerPost),{disposition:'pending'});assert.equal(counts.observer,1);
 const wrongKey=Buffer.from(JSON.stringify({...secret,keyBase64:Buffer.alloc(32,8).toString('base64')}));
 await assert.rejects(observe(observerPost,wrongKey,{...config,secretSha256:sha(wrongKey)}));assert.equal(counts.observer,1);
 // Use the case's real rendered server cert/key and issuer CA, plus the existing
 // short-lived host certificate issuer. No host credential reaches callback code.
 const ca=c.inputs.nativeMaterial.issuerCaCertificate,issuer=createNativeHostCertificateIssuerFromMaterial({caPem:ca,keyPem:c.inputs.nativeMaterial.issuerCaKey});
 const csr=createRunnerPoststartCsr(),leaf=await issuer.issue({kind:'client',san:hostClientDnsName(allocation.allocation),csrPem:csr.csrPem,
  notAfterMs:allocation.allocation.leaseDeadlineMs,leaseDeadlineMs:allocation.allocation.leaseDeadlineMs});
 const host=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:0},tls:{...c.serverTls,clientCa:ca,serverName:bootstrap.control.endpoint.serverName},
  store:{readFacts:async()=>assert.fail('no facts'),resolveBrowserWorkflow:async()=>assert.fail('no workflow'),holdBrowser:async()=>assert.fail('no hold'),
   readCurrent:async({request,peerDnsName})=>{counts.host++;assert.equal(peerDnsName,hostClientDnsName(allocation.allocation));return {
   schema:HOST_CONTROL_RESPONSE_SCHEMA,nonce:request.nonce,purpose:request.purpose,receipt:{allocation:allocation.allocation,binding,policySha256:request.policySha256,
    phase:'active',checkedAtMs:Date.now(),currentUntilMs:Date.now()+800}};}},maxFreshMs:2000,requestMs:1000});
 const hostAddress=await host.start();t.after(()=>host.close());
 const hostEndpoint={...bootstrap.control.endpoint,serverFingerprintSha256:sha(new X509Certificate(bootstrap.control.serverCertificate).raw)};
 const hostOptions={allocation:allocation.allocation,binding,hostIdentity:allocation.record.hostIdentity,purpose:'browser',endpoint:hostEndpoint,
  tls:{cert:Buffer.from(leaf.certPem),key:Buffer.from(csr.keyPem),ca:Buffer.from(bootstrap.control.caCertificate)},maxFreshMs:2000,timeoutMs:1000};
 const hostRequest=port=>({request:(options,done)=>{assert.equal(options.host,hostEndpoint.address);assert.equal(options.port,443);assert.equal(options.servername,hostEndpoint.serverName);
  assert.equal(options.rejectUnauthorized,true);return httpsRequest({...options,host:'127.0.0.1',port},done);}});
 const current=options=>{const client=createHostCurrentnessClient(options);t.after(()=>client.close());return client.readCurrent({allocation:allocation.allocation,binding,policySha256:bootstrap.control.policySha256});};
 assert.equal((await current({...hostOptions,httpsModule:hostRequest(hostAddress.port)})).phase,'active');assert.equal(counts.host,1);
 const hostDestination={address:()=>hostAddress},beforeSwap={...counts};
 const swapped=createOperatorCallbackTransport(callback,{request:localRequest(hostDestination,[],callback.endpoint.address)});t.after(()=>swapped.close());
 await assert.rejects(createNativeCapabilityClient({configuration:{origin:callback.origin,maxResponseBytes:1048576},credential:capability.toString(),fetch:swapped.fetch}).readiness());
 await assert.rejects(observe(createOperatorObserverPost(config.endpoint,{request:localRequest(hostDestination,[],callback.endpoint.address)})));
 await assert.rejects(current({...hostOptions,httpsModule:hostRequest(edge.address().port)}));assert.deepEqual(counts,beforeSwap);
 // Even aligning server trust to the wrong receiver cannot bypass its contract:
 // callback still lacks a host mTLS credential; the private app has no host route.
 const aligned=createOperatorCallbackTransport({...callback,caCertificate:bootstrap.control.caCertificate,endpoint:{...callback.endpoint,serverFingerprintSha256:hostEndpoint.serverFingerprintSha256}},
  {request:localRequest(hostDestination,[],callback.endpoint.address)});t.after(()=>aligned.close());
 await assert.rejects(createNativeCapabilityClient({configuration:{origin:callback.origin,maxResponseBytes:1048576},credential:capability.toString(),fetch:aligned.fetch}).readiness(),
  error=>error.code==='NATIVE_UNAVAILABLE'&&error.cause?.code==='ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED');
 await assert.rejects(current({...hostOptions,endpoint:{...hostEndpoint,serverFingerprintSha256:callback.endpoint.serverFingerprintSha256},
  tls:{...hostOptions.tls,ca:Buffer.from(callback.caCertificate)},httpsModule:hostRequest(edge.address().port)}));
 assert.equal((await app.handle(new Request(callback.origin+HOST_CONTROL_PATH))).status,404);assert.deepEqual(counts,beforeSwap);
 assert(requests.every(r=>r.cert===undefined&&r.key===undefined&&r.rejectUnauthorized===true));
});
test('case AgentCore is separate and carries only pinned public callback material',async()=>{
 const f=await fixture(),callback=JSON.parse(Buffer.from(f.startup.agentcore.bundle.files[0].base64,'base64'));
 const b={imageUri:f.deployment.images.nodeRuntime,sourceCommit:f.deployment.images.nodeRuntimeSourceCommit,vpcId:f.deployment.vpcId,privateSubnetIds:f.deployment.privateSubnetIds,
  controlTaskRoleName:`MeriCase-${caseId}-control`,controlOrigin:callback.origin,controlCaBase64:Buffer.from(callback.caCertificate).toString('base64'),controlCaSha256:sha(callback.caCertificate),
  bedrock:[{inferenceProfileArn:`arn:aws:bedrock:us-east-1:${account}:inference-profile/us.anthropic.claude-sonnet-4-6`,foundationModelArns:['arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6'],countTokensModelArn:'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6'}],claudeApiSecretArn:null};
 const o={caseId,clientSecurityGroupId:f.edge.CaseClientSecurityGroupId,delivery:f.startup.agentcore,commonImageUri:b.imageUri.replace(/@sha256:.+$/u,'@sha256:'+'8'.repeat(64))};
 const t=synthesizeOperatorAgentCoreRuntime(b,o),runtime=t.Resources.Runtime.Properties;
 assert.equal(runtime.AgentRuntimeName,n.runtime);assert(runtime.NetworkConfiguration.NetworkModeConfig.SecurityGroups.includes(o.clientSecurityGroupId));
 assert.equal(runtime.EnvironmentVariables.MERI_CONTROL_ORIGIN,undefined);assert(!JSON.stringify(t).includes(capability.toString()));
 const policy=Object.values(t.Resources).find(x=>x.Type==='AWS::IAM::Policy'&&x.Properties.PolicyName===`MeriCase-${caseId}-Invocation`);
 assert.deepEqual(policy.Properties.Roles,[b.controlTaskRoleName]);
 assert.throws(()=>synthesizeOperatorAgentCoreRuntime({...b,controlTaskRoleName:'MeriPreview-control-task'},o));
 assert.throws(()=>synthesizeOperatorAgentCoreRuntime(b,{...o,commonImageUri:b.imageUri}));
});
