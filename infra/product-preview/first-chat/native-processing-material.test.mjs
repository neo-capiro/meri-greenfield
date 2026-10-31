import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRenderFixture,python} from './render-material.fixture.mjs';
import {execFileSync} from 'node:child_process';
import {renderMaterial,readPrivateDirectory} from './render-material.mjs';
import {parseNativeProcessing,NATIVE_PATHS} from './native-processing-material.mjs';
import {compileNativeWatchdogDefinition} from '../../browser-enforcement/workflow.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
const fixture=createRenderFixture();after(()=>fixture.cleanup());
const sha=b=>createHash('sha256').update(b).digest('hex');
let nativeClient;
async function inputs(){
 const i=structuredClone(await fixture.setup()),p=await readPrivateDirectory(fixture.pkiDir);
 if(!nativeClient){
  const code='import sys,json,pathlib,datetime\nfrom cryptography import x509\nfrom cryptography.hazmat.primitives import serialization,hashes\nfrom cryptography.hazmat.primitives.asymmetric import rsa\nfrom cryptography.x509.oid import ExtendedKeyUsageOID\np=pathlib.Path(sys.argv[1]); ca=x509.load_pem_x509_certificate((p/"server-ca.pem").read_bytes()); ck=serialization.load_pem_private_key((p/"server-ca.key.pem").read_bytes(),None); k=rsa.generate_private_key(public_exponent=65537,key_size=2048); n=datetime.datetime.now(datetime.timezone.utc)\nc=x509.CertificateBuilder().subject_name(x509.Name([])).issuer_name(ca.subject).public_key(k.public_key()).serial_number(x509.random_serial_number()).not_valid_before(n-datetime.timedelta(seconds=1)).not_valid_after(n+datetime.timedelta(minutes=12)).add_extension(x509.BasicConstraints(ca=False,path_length=None),True).add_extension(x509.SubjectAlternativeName([x509.DNSName("native-control.synthetic.internal")]),False).add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CLIENT_AUTH]),False).sign(ck,hashes.SHA256())\nprint(json.dumps({"cert":c.public_bytes(serialization.Encoding.PEM).decode(),"key":k.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode()}))';
  nativeClient=JSON.parse(execFileSync(python,['-I','-c',code,fixture.pkiDir],{timeout:30000,windowsHide:true}));
 }
 const observer={schema:'meri-native-managed-observer/1',protocol:'native-observer-around-managed/1',route:'/v1/execution/native/physical-observer',
  authenticationPrincipal:'native-watchdog-observer-v1',bridgeFunctionVersionArn:'arn:aws:lambda:us-east-1:967807252336:function:synthetic-observer:3'};
 const material={controlClientCertificate:Buffer.from(nativeClient.cert),controlClientKey:Buffer.from(nativeClient.key),
  issuerCaCertificate:p.certs['server-ca'],issuerCaKey:await readFile(join(fixture.pkiDir,'server-ca.key.pem')),observerKey:Buffer.alloc(32,7)};
 const db=i.deployment.database;db.roles.nativeWorker='synthetic_native_worker';
 i.deployment.foundation.WorkerTaskRoleArn='arn:aws:iam::967807252336:role/synthetic-native-worker';
 material.databaseConnection=Buffer.from(`postgresql://${db.roles.nativeWorker}:synthetic-password@${db.host}:${db.port}/${db.database}?sslmode=verify-full`);
 const placement={availabilityZone:'us-east-1a',vpcId:i.deployment.vpcId,subnetId:i.deployment.privateSubnetIds[0],securityGroupIds:['sg-0123456789abcdef0'],iamInstanceProfile:'synthetic-native'};
 const deployment={accountId:'967807252336',region:'us-east-1',placement,
  launch:{ImageId:'ami-0123456789abcdef0',InstanceType:'c7g.large',SubnetId:placement.subnetId,SecurityGroupIds:placement.securityGroupIds,IamInstanceProfile:{Name:placement.iamInstanceProfile}},
  imageDigest:'sha256:'+'c'.repeat(64),sourceCommit:i.deployment.images.nodeRuntimeSourceCommit,bootstrapSha256:'a'.repeat(64),
  launchTagPolicy:'instance-and-root-volume-owner-tags/1',physicalObserver:observer,
  bootstrapSpec:{schema:'meri-native-bootstrap-spec/1',document:{name:'synthetic-native-bootstrap',version:'1',sha256:'a'.repeat(64),pluginName:'nativeBootstrap'},
   programSha256:'b'.repeat(64),profileSha256:'c'.repeat(64),hostEndpoint:{port:9443,serverName:'native.synthetic.internal'},
   control:{endpoint:{address:'10.0.0.7',port:443,serverName:i.deployment.names.control_private},clientName:'native-control.synthetic.internal',
    serverCertificate:p.certs['control-private'].toString(),clientCertificate:material.controlClientCertificate.toString(),caCertificate:p.certs['server-ca'].toString(),policySha256:'d'.repeat(64)},
   issuerCaCertificate:material.issuerCaCertificate.toString()}};
 i.deployment.features={sourceEnabled:true,uploads:{enabled:true},nativeProcessing:{enabled:true,deployment,
  watchdog:{stateMachineVersionArn:'arn:aws:states:us-east-1:967807252336:stateMachine:synthetic-native:4',
   definitionSha256:canonicalSha256(compileNativeWatchdogDefinition({physicalObserver:observer})),qualificationEvidenceSha256:'e'.repeat(64)},
  observerKeyId:'synthetic-key',maxRequestMs:3000,materialSha256:Object.fromEntries(Object.entries(material).map(([k,v])=>[k,sha(v)]))}};
 return {...i,private:p,nativeMaterial:material};
}
test('existing renderer emits complete native /2 role configs and exact private inventories',async()=>{
 const i=await inputs(),r=renderMaterial(i),c=r.roles.control.config,w=r.roles['temporal-worker'].config;
 assert.equal(c.uploads.native.host.observer.keyPath,NATIVE_PATHS.observerKey);
 assert.equal(c.uploads.native.agentcore,undefined);assert.equal(w.nativeProvisioning.enabled,true);
 assert.equal(w.nativeProvisioning.deployment.physicalObserver.bridgeFunctionVersionArn,i.deployment.features.nativeProcessing.deployment.physicalObserver.bridgeFunctionVersionArn);
 for(const k of ['issuerCaCertificate','controlClientCertificate','controlClientKey','observerKey'])assert.ok(r.roles.control.expected.sha256ByPath[NATIVE_PATHS[k]]);
 for(const k of ['issuerCaCertificate','issuerCaKey','databaseConnection'])assert.ok(r.roles['temporal-worker'].expected.sha256ByPath[NATIVE_PATHS[k]]);
 assert.equal(r.roles.control.expected.sha256ByPath[NATIVE_PATHS.issuerCaKey],undefined);
 assert.equal(r.roles['temporal-worker'].expected.sha256ByPath[NATIVE_PATHS.observerKey],undefined);
 assert.ok(!JSON.stringify(r.summary).includes('synthetic-password'));
});
test('missing, extra, modified or foreign native material refuses before render',async()=>{
 for(const mutate of [i=>delete i.nativeMaterial.issuerCaKey,i=>i.nativeMaterial.extra=Buffer.from('x'),
  i=>i.nativeMaterial.observerKey[0]^=1,i=>i.deployment.features.nativeProcessing.deployment.sourceCommit='0'.repeat(40),
  i=>i.deployment.features.nativeProcessing.watchdog.definitionSha256='0'.repeat(64),
  i=>i.deployment.database.roles.nativeWorker=i.deployment.database.roles.control,
  i=>delete i.deployment.foundation.WorkerTaskRoleArn,
  i=>delete i.deployment.features.nativeProcessing.deployment.physicalObserver]){
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
