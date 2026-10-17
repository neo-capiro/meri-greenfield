import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileProductMaterialPlan,productMaterialPolicy} from '../material-init-plan.mjs';
import {validateStaticProductDelivery} from '../material-init.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';

const role='temporal-issuer',runtimeUser='1000:1000',refused={code:'PRODUCT_MATERIAL_REFUSED'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const paths=['/run/meri/issuer.json','/run/meri/issuer-database.uri','/run/meri/issuer-server.key',
 '/run/meri/issuer-server.crt','/run/meri/issuer-client-ca.pem','/run/meri/issuer-client-ca.key'].sort();
const database=Buffer.from('postgresql://meri_temporal_issuer@database.synthetic.invalid/meri?sslmode=verify-full');

/** Parser-only public metadata and inert in-memory bytes. These tests generate
 * no certificate/key pair or credential, and perform no material filesystem IO. */
function configuration(){
 const kid='synthetic-public-metadata',publicJwk={kty:'RSA',kid,alg:'RS256',use:'sig',n:Buffer.alloc(256,0xa5).toString('base64url'),e:'AQAB'};
 const account='967807252336',region='us-east-1',cluster='capiro-dev';
 function pin(worker){const name=worker?'worker':'control';return {subject:'meri-temporal-'+name+':v1',workloadPrincipal:'meri-workload-'+name+':v1',
  peerSubjectCn:'meri-temporal-'+name,peerUriBase:'spiffe://issuer.synthetic.invalid/temporal/'+name+'/',
  serviceArn:`arn:aws:ecs:${region}:${account}:service/${cluster}/synthetic-${name}`,taskDefinitionArn:`arn:aws:ecs:${region}:${account}:task-definition/synthetic-${name}:1`,
  containerName:name,imageUri:`${account}.dkr.ecr.${region}.amazonaws.com/synthetic/${name}@sha256:${'b'.repeat(64)}`,
  taskRoleArn:`arn:aws:iam::${account}:role/synthetic-${name}`,executionRoleArn:`arn:aws:iam::${account}:role/synthetic-${name}-execution`,revision:'synthetic-v1'};}
 return {schemaVersion:1,database:{connectionFile:'/run/meri/issuer-database.uri',connectionSha256:sha(database)},issuer:{schemaVersion:1,registrationRole:'meri_temporal_issuer',startupTimeoutMs:1000,
  service:{schemaVersion:1,issuerOrigin:'https://issuer.synthetic.invalid',kid,namespace:'meri',audience:'meri-temporal',maxRequestMs:5000,bootstrapMaxRequestMs:10000,maxBodyBytes:4096,currentnessLeaseMs:20000},
  taskAuthority:{schemaVersion:1,clusterArn:`arn:aws:ecs:${region}:${account}:cluster/${cluster}`,vpcId:'vpc-0ac26cfac7ed972be',privateSubnetIds:['subnet-12345678'],securityGroupIds:['sg-12345678'],maxLeaseMs:10000,
   roles:{control:pin(false),'temporal-worker':pin(true)}},
  signer:{schemaVersion:1,keyArn:`arn:aws:kms:${region}:${account}:key/11111111-1111-4111-8111-111111111111`,kid,publicJwk,publicJwkSha256:sha(Buffer.from(JSON.stringify(publicJwk)))},
  listen:{host:'0.0.0.0',port:8445},tls:{keyFile:'/run/meri/issuer-server.key',certFile:'/run/meri/issuer-server.crt',caFile:'/run/meri/issuer-client-ca.pem'},
  bootstrap:{caKeyFile:'/run/meri/issuer-client-ca.key',caSha256:'a'.repeat(64)}}};
}
const compile=(c=configuration(),user=runtimeUser)=>compileProductMaterialPlan({role,configuration:c,runtimeUser:user});
function delivery({configurationBytes=Buffer.from(JSON.stringify(configuration()))}={}){
 const material=new Map(paths.map(path=>[path,path==='/run/meri/issuer.json'?configurationBytes:path==='/run/meri/issuer-database.uri'?database:Buffer.from('SYNTHETIC INERT MATERIAL '+path)]));
 const expected={schemaVersion:1,role,runtimeUser,sourceCommit:'c'.repeat(40),imageDigest:'sha256:'+'d'.repeat(64),sha256ByPath:Object.fromEntries([...material].map(([path,bytes])=>[path,sha(bytes)]))};
 expected.materialContractSha256=canonicalSha256(expected);
 return {expected,bundle:{files:[...material].map(([path,bytes])=>({path,base64:bytes.toString('base64')}))}};
}
function repin(expected){const {materialContractSha256,...value}=expected;expected.materialContractSha256=canonicalSha256(value);}

test('canonical issuer plan uses exactly six static files and the existing owner/mode policy',()=>{
 assert.equal(productMaterialPolicy.configurationNames[role],'issuer.json');
 const c=configuration(),plan=compile(c);
 assert.deepEqual(plan.requiredFiles.map(file=>file.path),paths);assert.equal(plan.requiredFiles.length,6);
 assert.equal(plan.role,role);assert.equal(plan.containerName,role);assert.equal(plan.configurationPath,'/run/meri/issuer.json');
 assert.equal(plan.materialDirectory,'/run/meri');assert.equal(plan.directoryMode,'0700');assert.equal(plan.uid,1000);assert.equal(plan.gid,1000);
 assert.equal(plan.requiresTokenRotation,false);assert.equal(plan.dynamicMaterialDirectory,null);assert.equal(Object.hasOwn(plan,'temporalTokenWriter'),false);
 for(const file of plan.requiredFiles){assert.equal(file.mode,'0600');assert.equal(file.maxBytes,32768);assert.equal(file.purposes.length,1);assert.ok(Object.isFrozen(file));assert.ok(Object.isFrozen(file.purposes));}
 assert.ok(Object.isFrozen(plan));assert.ok(Object.isFrozen(plan.requiredFiles));c.database.connectionFile='/run/meri/changed.uri';assert.deepEqual(plan.requiredFiles.map(file=>file.path),paths);
});

test('issuer material is confined to UID 1000 and direct canonical paths without shared authority files',()=>{
 for(const user of ['0:0','1001:1000','100:100','1000','1000:0'])assert.throws(()=>compile(configuration(),user),refused);
 for(const change of [c=>{c.database.connectionFile='/run/meri-temporal/issuer/database.uri';},c=>{c.database.connectionFile='/run/meri/nested/database.uri';},
  c=>{c.database.connectionFile='/run/meri/issuer.json';},c=>{c.database.connectionFile=c.issuer.tls.certFile;},
  c=>{c.issuer.tls.keyFile='/run/meri-temporal/issuer/server.key';},c=>{c.issuer.tls.caFile=c.issuer.bootstrap.caKeyFile;},
  c=>{c.issuer.listen.port=443;},c=>{c.issuer.listen.host='127.0.0.1';},c=>{c.issuer.unreviewedAuthority=true;}]){
  const c=configuration();change(c);assert.throws(()=>compile(c),refused);
 }
});

test('existing static receiver accepts issuer role and emits only the canonical sanitized receipt',()=>{
 const d=delivery(),receipt=validateStaticProductDelivery(d);
 assert.deepEqual(receipt,{ready:true,role,runtimeUser,sourceCommit:d.expected.sourceCommit,imageDigest:d.expected.imageDigest,
  materialContractSha256:d.expected.materialContractSha256,configurationPath:'/run/meri/issuer.json',fileCount:6});
 assert.ok(Object.isFrozen(receipt));assert.equal(JSON.stringify(receipt).includes(database.toString()),false);
 assert.equal(Object.hasOwn(receipt,'sha256ByPath'),false);assert.equal(Object.hasOwn(receipt,'files'),false);
});

test('static issuer receiver pins the exact raw JSON bytes rather than a parsed/reformatted equivalent',()=>{
 const d=delivery(),config=d.bundle.files.find(file=>file.path==='/run/meri/issuer.json');
 const formatted=Buffer.from(JSON.stringify(configuration(),null,2)+'\n');config.base64=formatted.toString('base64');
 assert.throws(()=>validateStaticProductDelivery(d),{code:'STATIC_INIT_CONTENT_REFUSED'});
 d.expected.sha256ByPath[config.path]=sha(formatted);repin(d.expected);
 assert.equal(validateStaticProductDelivery(d).fileCount,6);
});

test('authenticated issuer inventory cannot omit or add a file outside the canonical plan',()=>{
 for(const change of [d=>{const [file]=d.bundle.files.splice(d.bundle.files.findIndex(file=>file.path==='/run/meri/issuer-server.crt'),1);delete d.expected.sha256ByPath[file.path];},
  d=>{const path='/run/meri/extra.key',bytes=Buffer.from('SYNTHETIC EXTRA');d.bundle.files.push({path,base64:bytes.toString('base64')});d.expected.sha256ByPath[path]=sha(bytes);}]){
  const d=delivery();change(d);repin(d.expected);assert.throws(()=>validateStaticProductDelivery(d),{code:'STATIC_INIT_INVENTORY_REFUSED'});
 }
 const d=delivery();d.bundle.files[0].base64=Buffer.from('SYNTHETIC CHANGED').toString('base64');
 assert.throws(()=>validateStaticProductDelivery(d),{code:'STATIC_INIT_CONTENT_REFUSED'});
});

test('issuer configuration and receiving runtime user are rechecked even with recomputed bundle hashes',()=>{
 const bad=configuration();bad.database.connectionFile='/run/meri/issuer.json';
 assert.throws(()=>validateStaticProductDelivery(delivery({configurationBytes:Buffer.from(JSON.stringify(bad))})),{code:'STATIC_INIT_REFUSED'});
 const d=delivery();d.expected.runtimeUser='1001:1000';repin(d.expected);assert.throws(()=>validateStaticProductDelivery(d),{code:'STATIC_INIT_REFUSED'});
});
