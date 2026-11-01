/** Shared synthetic native /2 render inputs: one throwaway Control client leaf issued by the fixture PKI, synthetic
 * observer/placement/watchdog facts and exact material hashes. Used by the native material and browser enablement
 * render tests. Needs MERI_REVIEW_SOURCE_ROOT and Python `cryptography`; nothing here is a live readback. */
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {python} from './render-material.fixture.mjs';
import {readPrivateDirectory} from './render-material.mjs';
import {compileNativeWatchdogDefinition} from '../../browser-enforcement/workflow.mjs';
import {canonicalJson,canonicalSha256} from '../../../packages/contracts/validate.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
let nativeClient;
export async function nativeProcessingInputs(fixture){
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
   definitionSha256:canonicalSha256(compileNativeWatchdogDefinition({physicalObserver:observer})),qualificationEvidenceSha256:'e'.repeat(64),
   definitionReadback:{stateMachineArn:'arn:aws:states:us-east-1:967807252336:stateMachine:synthetic-native:4',type:'STANDARD',status:'ACTIVE',revisionId:'synthetic-revision',
    definition:canonicalJson(compileNativeWatchdogDefinition({physicalObserver:observer}))}},
  observerKeyId:'synthetic-key',maxRequestMs:3000,materialSha256:Object.fromEntries(Object.entries(material).map(([k,v])=>[k,sha(v)]))}};
 return {...i,private:p,nativeMaterial:material};
}
