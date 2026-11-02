import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRenderFixture} from './render-material.fixture.mjs';
import {nativeProcessingInputs} from './native-processing-material.fixture.mjs';
import {renderMaterial,readPrivateDirectory} from './render-material.mjs';
import {parseNativeProcessing,NATIVE_PATHS} from './native-processing-material.mjs';
import {PINNED_CONTROL_LIFETIME_MS} from '../../../apps/worker/conversation/host/control/tls.mjs';
import {compileUploadNativeConfiguration} from '../../../apps/runtime/uploads/control-lifecycle.mjs';
import {validateConfiguration} from '../../../apps/runtime/config.mjs';
import {execFileSync} from 'node:child_process';
import {python} from './render-material.fixture.mjs';
import {compileNativeWatchdogDefinition} from '../../browser-enforcement/workflow.mjs';
import {compileNativeWatchdogTemplate} from '../../browser-enforcement/native-template.mjs';
import {createManagedWatchdogReadback} from '../../../apps/runtime/native-watchdog-readback.mjs';
import {canonicalJson,canonicalSha256} from '../../../packages/contracts/validate.mjs';
const fixture=createRenderFixture();after(()=>fixture.cleanup());
const sha=b=>createHash('sha256').update(b).digest('hex');
const inputs=()=>nativeProcessingInputs(fixture);
test('existing renderer emits complete native /2 role configs and exact private inventories',async()=>{
 const i=await inputs(),r=renderMaterial(i),c=r.roles.control.config,w=r.roles['temporal-worker'].config;
 assert.equal(c.uploads.native.host.observer.keyPath,NATIVE_PATHS.observerKey);
 assert.equal(c.uploads.native.agentcore,undefined);assert.equal(w.nativeProvisioning.enabled,true);
 assert.equal(w.nativeProvisioning.deployment.physicalObserver.bridgeFunctionVersionArn,i.deployment.features.nativeProcessing.deployment.physicalObserver.bridgeFunctionVersionArn);
 // The browser-only host purpose rides beside the native one: its own image/AMI/bootstrap, the same placement and control connection.
 const bd=w.nativeProvisioning.browserDeployment,fb=i.deployment.features.nativeProcessing.browserDeployment;
 assert.equal(bd.imageDigest,fb.imageDigest);assert.equal(bd.launch.ImageId,fb.launch.ImageId);assert.equal(bd.bootstrapSpec.document.name,'synthetic-browser-bootstrap');
 assert.deepEqual(bd.placement,w.nativeProvisioning.deployment.placement);assert.equal(bd.bootstrapSpec.control.policySha256,w.nativeProvisioning.deployment.bootstrapSpec.control.policySha256);
 assert.deepEqual(c.uploads.native.host.browserDeployment,{...c.uploads.native.host.deployment,amiId:fb.launch.ImageId},'one exact teardown placement per purpose');
 const withoutBrowser={...i,deployment:structuredClone(i.deployment)};delete withoutBrowser.deployment.features.nativeProcessing.browserDeployment;
 const r2=renderMaterial(withoutBrowser);assert.equal(r2.roles['temporal-worker'].config.nativeProvisioning.browserDeployment,undefined);assert.equal(r2.roles.control.config.uploads.native.host.browserDeployment,undefined);
 for(const k of ['issuerCaCertificate','controlClientCertificate','controlClientKey','observerKey'])assert.ok(r.roles.control.expected.sha256ByPath[NATIVE_PATHS[k]]);
 for(const k of ['issuerCaCertificate','issuerCaKey','databaseConnection'])assert.ok(r.roles['temporal-worker'].expected.sha256ByPath[NATIVE_PATHS[k]]);
 assert.equal(r.roles.control.expected.sha256ByPath[NATIVE_PATHS.issuerCaKey],undefined);
 assert.equal(r.roles['temporal-worker'].expected.sha256ByPath[NATIVE_PATHS.observerKey],undefined);
 assert.ok(!JSON.stringify(r.summary).includes('synthetic-password'));
 const secret=JSON.parse(r.nativeObserverMaterial);assert.equal(secret.keyId,c.uploads.native.host.observer.keyId);
 assert.deepEqual(Buffer.from(secret.keyBase64,'base64'),i.nativeMaterial.observerKey);
 assert.equal(r.summary.nativeProcessing.observerMaterialSha256,sha(r.nativeObserverMaterial));
 assert.equal(r.summary.nativeProcessing.observerCaSha256,sha(Buffer.from(secret.caCertificate)));
});
test('missing, extra, modified or foreign native material refuses before render',async()=>{
 for(const mutate of [i=>delete i.nativeMaterial.issuerCaKey,i=>i.nativeMaterial.extra=Buffer.from('x'),
  i=>i.nativeMaterial.observerKey[0]^=1,i=>i.deployment.features.nativeProcessing.deployment.sourceCommit='0'.repeat(40),
  i=>i.deployment.features.nativeProcessing.watchdog.definitionSha256='0'.repeat(64),
  i=>i.deployment.database.roles.nativeWorker=i.deployment.database.roles.control,
  i=>delete i.deployment.foundation.WorkerTaskRoleArn,
  i=>delete i.deployment.features.nativeProcessing.deployment.physicalObserver,
  i=>{i.deployment.features.nativeProcessing.browserDeployment.placement={...i.deployment.features.nativeProcessing.browserDeployment.placement,availabilityZone:'us-east-1b'};},
  i=>{const b=i.deployment.features.nativeProcessing.browserDeployment;b.bootstrapSpec={...b.bootstrapSpec,control:{...b.bootstrapSpec.control,policySha256:'0'.repeat(64)}};},
  i=>{i.deployment.features.nativeProcessing.browserDeployment.imageDigest=i.deployment.features.nativeProcessing.deployment.imageDigest;},
  i=>{i.deployment.features.nativeProcessing.browserDeployment.launch.ImageId=i.deployment.features.nativeProcessing.deployment.launch.ImageId;},
  i=>{i.deployment.features.nativeProcessing.browserDeployment.sourceCommit='1'.repeat(40);}]){
  const i=await inputs();mutate(i);assert.throws(()=>renderMaterial(i));
 }
});
test('repinning a foreign long-lived Control client cannot bypass real certificate, issuer and lifetime checks',async()=>{
 const i=await inputs(),f=i.deployment.features.nativeProcessing;
 i.nativeMaterial.controlClientCertificate=i.private.certs['temporal-client-control'];i.nativeMaterial.controlClientKey=i.private.keys['temporal-client-control'];
 f.deployment.bootstrapSpec.control.clientCertificate=i.nativeMaterial.controlClientCertificate.toString();
 for(const k of ['controlClientCertificate','controlClientKey'])f.materialSha256[k]=sha(i.nativeMaterial[k]);
 assert.throws(()=>renderMaterial(i),/RENDER_NATIVE_PROCESSING_REFUSED/u);
});
test('disabled and absent native processing never add host, observer, issuer or native worker DB material',async()=>{
 const base=await fixture.render();assert.equal(base.roles['temporal-worker'].config.nativeProvisioning,undefined);
 const r=await fixture.render(i=>{i.deployment.features={nativeProcessing:{enabled:false}};});
 assert.deepEqual(r.roles['temporal-worker'].config.nativeProvisioning,{enabled:false});
 for(const role of Object.values(r.roles))for(const path of Object.values(NATIVE_PATHS))assert.equal(role.expected.sha256ByPath[path],undefined);
 assert.throws(()=>parseNativeProcessing({enabled:false,observerKeyId:'leftover'}));
 const i=await inputs();i.deployment.features.uploads.enabled=false;assert.throws(()=>renderMaterial(i));
});

test('template bytes, observed numeric-version definition, full renderer and unchanged worker share one exact byte contract',async()=>{
 const i=await inputs(),feature=i.deployment.features.nativeProcessing,d=feature.deployment;
 const template=compileNativeWatchdogTemplate({enabled:true,name:'synthetic-native',deployment:d});
 const properties=template.Resources.NativeWatchdog.Properties,definition=properties.DefinitionString;
 const graph=compileNativeWatchdogDefinition({physicalObserver:d.physicalObserver});
 assert.equal(properties.Definition,undefined);assert.deepEqual(JSON.parse(definition),graph);
 assert.equal(definition,canonicalJson(graph));assert.equal(template.Outputs.NativeWatchdogDefinitionSha256.Value,sha(definition));
 // Simulated service readback preserves the exact published string; only transport is mocked below.
 feature.watchdog.definitionReadback.definition=definition;
 const rendered=renderMaterial(i),watchdog=rendered.roles['temporal-worker'].config.nativeProvisioning.watchdog;
 assert.deepEqual(Object.keys(watchdog).sort(),['definitionSha256','qualificationEvidenceSha256','stateMachineVersionArn']);
 assert.equal(watchdog.definitionSha256,sha(definition));
 const owner=createManagedWatchdogReadback({...watchdog,now:()=>1001});
 const intent=await owner.makeIntent({hostId:'00000000-0000-4000-8000-000000000007',generation:1,t0Ms:1000,
  deadlineMs:61000,leaseDeadlineMs:61000,cleanupCeilingMs:86000,allocationSha256:'a'.repeat(64),
  sourceCommit:d.sourceCommit,imageDigest:d.imageDigest,bootstrapSha256:d.bootstrapSha256,
  placementSha256:canonicalSha256(d.placement),launchSha256:canonicalSha256(d.launch),controlPolicySha256:d.bootstrapSpec.control.policySha256,
  provisionToken:'f'.repeat(64),physicalObserver:d.physicalObserver,placement:d.placement,launch:d.launch});
 class DescribeStateMachineCommand {constructor(input){this.input=input;}}
 class DescribeExecutionCommand {constructor(input){this.input=input;}}
 async function arm(raw,version=watchdog.stateMachineVersionArn){
  const calls=[],stepFunctions={sdk:{DescribeStateMachineCommand,DescribeExecutionCommand},send:async command=>{
   calls.push(command.constructor.name);
   if(command instanceof DescribeStateMachineCommand){assert.equal(command.input.stateMachineArn,watchdog.stateMachineVersionArn);
    return {...feature.watchdog.definitionReadback,stateMachineArn:version,definition:raw};}
   return {executionArn:intent.executionArn,stateMachineArn:watchdog.stateMachineVersionArn.replace(/:\d+$/u,''),
    stateMachineVersionArn:watchdog.stateMachineVersionArn,status:'RUNNING',input:JSON.stringify(intent.input),startDate:new Date(1000)};
  }};
  return {calls,result:owner.arm({stepFunctions,intent})};
 }
 const positive=await arm(definition);assert.equal((await positive.result).armed,true);
 assert.ok(positive.calls.includes('DescribeExecutionCommand'));
 // Same parsed graph, different service bytes: reject both at render and at the unchanged worker before execution access.
 for(const raw of [JSON.stringify(graph),JSON.stringify(graph,null,2)]){
  assert.deepEqual(JSON.parse(raw),graph);assert.notEqual(sha(raw),sha(definition));
  feature.watchdog.definitionReadback.definition=raw;
  assert.throws(()=>renderMaterial(i),/RENDER_NATIVE_PROCESSING_REFUSED/u);
  feature.watchdog.definitionSha256=sha(raw);assert.throws(()=>renderMaterial(i),/RENDER_NATIVE_PROCESSING_REFUSED/u);
  feature.watchdog.definitionSha256=sha(definition);
  const negative=await arm(raw);await assert.rejects(negative.result,/NATIVE_WATCHDOG_REFUSED/u);
  assert.deepEqual(negative.calls,['DescribeStateMachineCommand']);
 }
 feature.watchdog.definitionReadback.definition=definition;
 const changed=structuredClone(graph);changed.States.PrearmWait.Seconds='1';
 feature.watchdog.definitionReadback.definition=canonicalJson(changed);feature.watchdog.definitionSha256=sha(canonicalJson(changed));
 assert.throws(()=>renderMaterial(i),/RENDER_NATIVE_PROCESSING_REFUSED/u,'repinning a changed full graph is not provenance');
 feature.watchdog.definitionReadback.definition=definition;feature.watchdog.definitionSha256=sha(definition);
 const readback=structuredClone(feature.watchdog.definitionReadback);
 for(const mutation of [r=>r.stateMachineArn=r.stateMachineArn.replace(/:4$/u,':alias'),r=>r.stateMachineArn=r.stateMachineArn.replace(/:4$/u,':5'),
  r=>r.type='EXPRESS',r=>r.status='DELETING',r=>r.revisionId='',r=>delete r.definition]){
  feature.watchdog.definitionReadback=structuredClone(readback);mutation(feature.watchdog.definitionReadback);
  assert.throws(()=>renderMaterial(i),/RENDER_NATIVE_PROCESSING_REFUSED/u);
 }
 delete feature.watchdog.definitionReadback;assert.throws(()=>renderMaterial(i),/RENDER_NATIVE_PROCESSING_REFUSED/u);
 feature.watchdog.definitionReadback=readback;
 const wrongVersion=await arm(definition,watchdog.stateMachineVersionArn.replace(/:4$/u,':5'));
 await assert.rejects(wrongVersion.result,/NATIVE_WATCHDOG_REFUSED/u);assert.deepEqual(wrongVersion.calls,['DescribeStateMachineCommand']);
});

test('browser-only provisioning needs no native deployment and keeps upload inspection on AgentCore',async()=>{
 const i=await inputs(),f=i.deployment.features.nativeProcessing;delete f.deployment;
 const r=renderMaterial(i),c=r.roles.control.config,w=r.roles['temporal-worker'].config;
 // Uploads stay exactly the AgentCore declaration; the host block beside it carries only the browser-only placement.
 assert.deepEqual(c.uploads.native.agentcore,{imageDigest:r.roles.control.expected.imageDigest});
 assert.deepEqual(Object.keys(c.uploads.native.host).sort(),['browserDeployment','maxRequestMs','observer','tls']);
 assert.equal(c.uploads.native.host.browserDeployment.amiId,f.browserDeployment.launch.ImageId);
 assert.deepEqual(compileUploadNativeConfiguration(c).agentcore,c.uploads.native.agentcore);
 assert.doesNotThrow(()=>validateConfiguration(c,'control'));
 assert.ok(c.browserHosts.tls.hostServer,'the router and the host-currentness listener are rendered for the browser purpose');
 assert.equal(w.nativeProvisioning.deployment,undefined);assert.equal(w.nativeProvisioning.browserDeployment.launch.ImageId,f.browserDeployment.launch.ImageId);
 assert.doesNotThrow(()=>validateConfiguration(w,'temporal-worker'));
 assert.equal(r.summary.nativeProcessing.observerCaSha256,sha(Buffer.from(f.browserDeployment.bootstrapSpec.control.caCertificate)));
 // A host block beside AgentCore never declares a native-processing placement; native processing needs uploads enabled.
 assert.throws(()=>compileUploadNativeConfiguration({uploads:{native:{...c.uploads.native,host:{...c.uploads.native.host,deployment:c.uploads.native.host.browserDeployment}}}}),{code:'UPLOAD_NATIVE_CONFIGURATION'});
 const disabled=await inputs();delete disabled.deployment.features.nativeProcessing.deployment;disabled.deployment.features.uploads.enabled=false;
 assert.throws(()=>renderMaterial(disabled),/nativeProcessing requires sourceEnabled and uploads/u);
 const none=await inputs();delete none.deployment.features.nativeProcessing.deployment;delete none.deployment.features.nativeProcessing.browserDeployment;
 assert.throws(()=>renderMaterial(none),/RENDER_NATIVE_PROCESSING_REFUSED/u);
});

test('the pinned Control client leaf must outlast the rendered material and live at most 31 days',async()=>{
 const issue=minutes=>JSON.parse(execFileSync(python,['-I','-c','import sys,json,pathlib,datetime\nfrom cryptography import x509\nfrom cryptography.hazmat.primitives import serialization,hashes\nfrom cryptography.hazmat.primitives.asymmetric import rsa\nfrom cryptography.x509.oid import ExtendedKeyUsageOID\np=pathlib.Path(sys.argv[1]); ca=x509.load_pem_x509_certificate((p/"server-ca.pem").read_bytes()); ck=serialization.load_pem_private_key((p/"server-ca.key.pem").read_bytes(),None); k=rsa.generate_private_key(public_exponent=65537,key_size=2048); n=datetime.datetime.now(datetime.timezone.utc)\nc=x509.CertificateBuilder().subject_name(x509.Name([])).issuer_name(ca.subject).public_key(k.public_key()).serial_number(x509.random_serial_number()).not_valid_before(n-datetime.timedelta(seconds=1)).not_valid_after(n+datetime.timedelta(minutes=int(sys.argv[2]))).add_extension(x509.BasicConstraints(ca=False,path_length=None),True).add_extension(x509.SubjectAlternativeName([x509.DNSName("native-control.synthetic.internal")]),False).add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CLIENT_AUTH]),False).sign(ck,hashes.SHA256())\nprint(json.dumps({"cert":c.public_bytes(serialization.Encoding.PEM).decode(),"key":k.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode()}))',fixture.pkiDir,String(minutes)],{timeout:30000,windowsHide:true}));
 const withLeaf=async minutes=>{const i=await inputs(),f=i.deployment.features.nativeProcessing,leaf=issue(minutes);
  i.nativeMaterial.controlClientCertificate=Buffer.from(leaf.cert);i.nativeMaterial.controlClientKey=Buffer.from(leaf.key);
  for(const d of [f.deployment,f.browserDeployment])d.bootstrapSpec.control.clientCertificate=leaf.cert;
  for(const k of ['controlClientCertificate','controlClientKey'])f.materialSha256[k]=sha(i.nativeMaterial[k]);
  return {...i,nowMs:Date.now()};};
 assert.equal(PINNED_CONTROL_LIFETIME_MS.client,31*86400000);
 // The former 15-minute leaf ends long before the 7-day material: refused. A leaf beyond 31 days: refused.
 const short=await withLeaf(15),long=await withLeaf(32*24*60);
 assert.throws(()=>renderMaterial(short),/RENDER_NATIVE_PROCESSING_REFUSED/u);
 assert.throws(()=>renderMaterial(long),/RENDER_NATIVE_PROCESSING_REFUSED/u);
 const ok=renderMaterial(await withLeaf(8*24*60));
 assert.ok(ok.summary.nativeProcessing.materialNotAfterMs>Date.now()+7*86400000,'the leaf outlasts the material validity');
 // Shorter material validity admits a leaf that outlasts it.
 assert.ok(renderMaterial({...(await withLeaf(3*24*60)),validityDays:2}));
});
